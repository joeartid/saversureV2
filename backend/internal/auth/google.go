package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type GoogleConfig struct {
	ClientID string
}

type GoogleService struct {
	db             *pgxpool.Pool
	auth           *Service
	fallbackConfig GoogleConfig
}

type googleTokenInfo struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	Picture       string `json:"picture"`
	Audience      string `json:"aud"`
}

func NewGoogleService(db *pgxpool.Pool, authSvc *Service, cfg GoogleConfig) *GoogleService {
	return &GoogleService{db: db, auth: authSvc, fallbackConfig: cfg}
}

func (s *GoogleService) configForTenant(ctx context.Context, tenantID string) GoogleConfig {
	if tenantID == "" {
		return s.fallbackConfig
	}

	var rawSettings string
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(settings, '{}'::jsonb)::text FROM tenants WHERE id = $1`,
		tenantID,
	).Scan(&rawSettings)
	if err != nil {
		return s.fallbackConfig
	}

	var settings map[string]any
	_ = json.Unmarshal([]byte(rawSettings), &settings)

	googleMap, ok := settings["google"].(map[string]any)
	if !ok {
		return s.fallbackConfig
	}

	cfg := GoogleConfig{}
	if v, ok := googleMap["client_id"].(string); ok && v != "" {
		cfg.ClientID = v
	}
	if cfg.ClientID == "" {
		return s.fallbackConfig
	}
	return cfg
}

func (s *GoogleService) IsConfiguredForTenant(ctx context.Context, tenantID string) bool {
	return s.configForTenant(ctx, tenantID).ClientID != ""
}

func (s *GoogleService) ClientIDForTenant(ctx context.Context, tenantID string) string {
	return s.configForTenant(ctx, tenantID).ClientID
}

func (s *GoogleService) verifyIDToken(ctx context.Context, tenantID, idToken string) (*googleTokenInfo, error) {
	cfg := s.configForTenant(ctx, tenantID)
	if cfg.ClientID == "" {
		return nil, fmt.Errorf("google_login_not_configured")
	}

	verifyURL := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(idToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, verifyURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("verify token: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google verify failed (%d): %s", resp.StatusCode, string(body))
	}

	var info googleTokenInfo
	if err := json.Unmarshal(body, &info); err != nil {
		return nil, fmt.Errorf("decode token info: %w", err)
	}
	if info.Sub == "" {
		return nil, fmt.Errorf("google_sub_missing")
	}
	if cfg.ClientID != "" && info.Audience != cfg.ClientID {
		return nil, fmt.Errorf("google_audience_mismatch")
	}

	return &info, nil
}

func (s *GoogleService) LoginOrRegister(ctx context.Context, tenantID, idToken, ipAddr string) (*TokenPair, error) {
	info, err := s.verifyIDToken(ctx, tenantID, idToken)
	if err != nil {
		return nil, err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var userID string
	var profileCompleted bool

	err = tx.QueryRow(ctx,
		`SELECT id, profile_completed
		 FROM users
		 WHERE tenant_id = $1 AND google_sub = $2 AND status = 'active'`,
		tenantID, info.Sub,
	).Scan(&userID, &profileCompleted)
	if err == pgx.ErrNoRows && info.Email != "" {
		err = tx.QueryRow(ctx,
			`SELECT id, profile_completed
			 FROM users
			 WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) AND status = 'active'
			 LIMIT 1`,
			tenantID, info.Email,
		).Scan(&userID, &profileCompleted)
	}

	switch err {
	case nil:
		_, err = tx.Exec(ctx,
			`UPDATE users
			 SET google_sub = $1,
			     google_picture_url = $2,
			     avatar_url = COALESCE(NULLIF($2, ''), avatar_url),
			     email = COALESCE(NULLIF($3, ''), email),
			     display_name = COALESCE(NULLIF($4, ''), display_name),
			     first_name = COALESCE(NULLIF($5, ''), first_name),
			     last_name = COALESCE(NULLIF($6, ''), last_name),
			     last_login_at = NOW(),
			     updated_at = NOW()
			 WHERE id = $7`,
			info.Sub, info.Picture, info.Email, info.Name, info.GivenName, info.FamilyName, userID,
		)
		if err != nil {
			return nil, fmt.Errorf("update google user: %w", err)
		}
	case pgx.ErrNoRows:
		profileCompleted = false
		displayName := strings.TrimSpace(info.Name)
		if displayName == "" {
			displayName = strings.TrimSpace(info.GivenName + " " + info.FamilyName)
		}
		err = tx.QueryRow(ctx,
			`INSERT INTO users (
				tenant_id, email, display_name, first_name, last_name,
				avatar_url, google_sub, google_picture_url, status, profile_completed
			) VALUES (
				$1, NULLIF($2, ''), NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''),
				NULLIF($6, ''), $7, NULLIF($8, ''), 'active', false
			)
			RETURNING id`,
			tenantID, info.Email, displayName, info.GivenName, info.FamilyName, info.Picture, info.Sub, info.Picture,
		).Scan(&userID)
		if err != nil {
			return nil, fmt.Errorf("create google user: %w", err)
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO user_roles (user_id, tenant_id, role) VALUES ($1, $2, 'api_client')`,
			userID, tenantID,
		)
		if err != nil {
			return nil, fmt.Errorf("assign role: %w", err)
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO pdpa_consents (user_id, consent_type, ip_address) VALUES ($1, 'google_login', $2)`,
			userID, ipAddr,
		)
		if err != nil {
			return nil, fmt.Errorf("record consent: %w", err)
		}
	default:
		return nil, fmt.Errorf("lookup google user: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	tokens, err := s.auth.generateTokenPair(userID, tenantID, "api_client", nil)
	if err != nil {
		return nil, err
	}
	tokens.ProfileCompleted = &profileCompleted
	return tokens, nil
}
