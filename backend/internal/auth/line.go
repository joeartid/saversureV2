package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type LINEConfig struct {
	ChannelID     string
	ChannelSecret string
	CallbackURL   string
}

type LINEService struct {
	db             *pgxpool.Pool
	auth           *Service
	fallbackConfig LINEConfig
}

func NewLINEService(db *pgxpool.Pool, authSvc *Service, cfg LINEConfig) *LINEService {
	return &LINEService{db: db, auth: authSvc, fallbackConfig: cfg}
}

func (s *LINEService) configForTenant(ctx context.Context, tenantID string) LINEConfig {
	var rawSettings string
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(settings, '{}'::jsonb)::text FROM tenants WHERE id = $1`, tenantID,
	).Scan(&rawSettings)
	if err != nil {
		return s.fallbackConfig
	}
	var settings map[string]any
	_ = json.Unmarshal([]byte(rawSettings), &settings)

	lineMap, ok := settings["line"].(map[string]any)
	if !ok {
		return s.fallbackConfig
	}
	cfg := LINEConfig{}
	if v, ok := lineMap["channel_id"].(string); ok && v != "" {
		cfg.ChannelID = v
	}
	if v, ok := lineMap["channel_secret"].(string); ok && v != "" {
		cfg.ChannelSecret = v
	}
	if v, ok := lineMap["callback_url"].(string); ok && v != "" {
		cfg.CallbackURL = v
	}
	if cfg.ChannelID == "" {
		return s.fallbackConfig
	}
	return cfg
}

func (s *LINEService) IsConfigured() bool {
	return s.fallbackConfig.ChannelID != "" && s.fallbackConfig.ChannelSecret != ""
}

func (s *LINEService) IsConfiguredForTenant(ctx context.Context, tenantID string) bool {
	cfg := s.configForTenant(ctx, tenantID)
	return cfg.ChannelID != "" && cfg.ChannelSecret != ""
}

func (s *LINEService) AuthorizationURL(state string) string {
	return s.authorizationURLWithConfig(s.fallbackConfig, state)
}

func (s *LINEService) AuthorizationURLForTenant(ctx context.Context, tenantID, state string) string {
	cfg := s.configForTenant(ctx, tenantID)
	return s.authorizationURLWithConfig(cfg, state)
}

func (s *LINEService) authorizationURLWithConfig(cfg LINEConfig, state string) string {
	params := url.Values{
		"response_type": {"code"},
		"client_id":     {cfg.ChannelID},
		"redirect_uri":  {cfg.CallbackURL},
		"state":         {state},
		"scope":         {"profile openid email"},
	}
	return "https://access.line.me/oauth2/v2.1/authorize?" + params.Encode()
}

type lineTokenResponse struct {
	AccessToken  string `json:"access_token"`
	IDToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

type lineProfile struct {
	UserID        string `json:"userId"`
	DisplayName   string `json:"displayName"`
	PictureURL    string `json:"pictureUrl"`
	StatusMessage string `json:"statusMessage"`
}

func (s *LINEService) ExchangeCode(ctx context.Context, code string) (*lineTokenResponse, error) {
	return s.exchangeCodeWithConfig(ctx, s.fallbackConfig, code)
}

func (s *LINEService) ExchangeCodeForTenant(ctx context.Context, tenantID, code string) (*lineTokenResponse, error) {
	cfg := s.configForTenant(ctx, tenantID)
	return s.exchangeCodeWithConfig(ctx, cfg, code)
}

func (s *LINEService) exchangeCodeWithConfig(ctx context.Context, cfg LINEConfig, code string) (*lineTokenResponse, error) {
	data := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {cfg.CallbackURL},
		"client_id":     {cfg.ChannelID},
		"client_secret": {cfg.ChannelSecret},
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.line.me/oauth2/v2.1/token", strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("token request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LINE token error (%d): %s", resp.StatusCode, string(body))
	}

	var tok lineTokenResponse
	if err := json.Unmarshal(body, &tok); err != nil {
		return nil, fmt.Errorf("decode token: %w", err)
	}
	return &tok, nil
}

func (s *LINEService) GetProfile(ctx context.Context, accessToken string) (*lineProfile, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.line.me/v2/profile", nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("profile request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("LINE profile error (%d): %s", resp.StatusCode, string(body))
	}

	var profile lineProfile
	if err := json.Unmarshal(body, &profile); err != nil {
		return nil, fmt.Errorf("decode profile: %w", err)
	}
	return &profile, nil
}

// LoginOrRegisterWithToken handles LIFF login (access token already obtained from LIFF SDK).
func (s *LINEService) LoginOrRegisterWithToken(ctx context.Context, tenantID, accessToken, ipAddr string) (*TokenPair, error) {
	profile, err := s.GetProfile(ctx, accessToken)
	if err != nil {
		return nil, fmt.Errorf("get profile: %w", err)
	}
	return s.upsertUser(ctx, tenantID, profile, ipAddr)
}

func (s *LINEService) LoginOrRegister(ctx context.Context, tenantID, code, ipAddr string) (*TokenPair, error) {
	tok, err := s.ExchangeCodeForTenant(ctx, tenantID, code)
	if err != nil {
		return nil, fmt.Errorf("exchange code: %w", err)
	}

	profile, err := s.GetProfile(ctx, tok.AccessToken)
	if err != nil {
		return nil, fmt.Errorf("get profile: %w", err)
	}

	return s.upsertUser(ctx, tenantID, profile, ipAddr)
}

func (s *LINEService) upsertUser(ctx context.Context, tenantID string, profile *lineProfile, ipAddr string) (*TokenPair, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var userID string
	var profileCompleted bool
	err = tx.QueryRow(ctx,
		`SELECT id, profile_completed FROM users WHERE tenant_id = $1 AND line_user_id = $2 AND status = 'active'`,
		tenantID, profile.UserID,
	).Scan(&userID, &profileCompleted)

	if err != nil {
		profileCompleted = false
		err = tx.QueryRow(ctx,
			`INSERT INTO users (tenant_id, line_user_id, line_display_name, line_picture_url, display_name, status, profile_completed)
			 VALUES ($1, $2, $3, $4, $5, 'active', false)
			 RETURNING id`,
			tenantID, profile.UserID, profile.DisplayName, profile.PictureURL, profile.DisplayName,
		).Scan(&userID)
		if err != nil {
			return nil, fmt.Errorf("create user: %w", err)
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO user_roles (user_id, tenant_id, role) VALUES ($1, $2, 'api_client')`,
			userID, tenantID,
		)
		if err != nil {
			return nil, fmt.Errorf("assign role: %w", err)
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO pdpa_consents (user_id, consent_type, ip_address) VALUES ($1, 'line_login', $2)`,
			userID, ipAddr,
		)
		if err != nil {
			return nil, fmt.Errorf("record consent: %w", err)
		}
	} else {
		_, _ = tx.Exec(ctx,
			`UPDATE users SET line_display_name = $1, line_picture_url = $2, last_login_at = NOW(), updated_at = NOW()
			 WHERE id = $3`,
			profile.DisplayName, profile.PictureURL, userID,
		)
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

// LIFFIDForTenant returns the LIFF ID configured for the tenant (from tenant settings).
func (s *LINEService) LIFFIDForTenant(ctx context.Context, tenantID string) string {
	var rawSettings string
	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE(settings, '{}'::jsonb)::text FROM tenants WHERE id = $1`, tenantID,
	).Scan(&rawSettings)
	var settings map[string]any
	_ = json.Unmarshal([]byte(rawSettings), &settings)
	if lineMap, ok := settings["line"].(map[string]any); ok {
		if v, ok := lineMap["liff_id"].(string); ok {
			return v
		}
	}
	return ""
}
