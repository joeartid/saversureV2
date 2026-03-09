package linebot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db         *pgxpool.Pool
	httpClient *http.Client
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db, httpClient: &http.Client{}}
}

type TenantLINEConfig struct {
	ChannelToken string
	ChannelID    string
}

func (s *Service) configForTenant(ctx context.Context, tenantID string) (*TenantLINEConfig, error) {
	var raw []byte
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(settings, '{}'::jsonb)::text FROM tenants WHERE id = $1`, tenantID,
	).Scan(&raw)
	if err != nil {
		return nil, fmt.Errorf("fetch tenant settings: %w", err)
	}

	var settings map[string]any
	if err := json.Unmarshal(raw, &settings); err != nil {
		return nil, fmt.Errorf("parse settings: %w", err)
	}

	token, _ := settings["line_channel_token"].(string)
	chanID, _ := settings["line_channel_id"].(string)

	if token == "" {
		return nil, fmt.Errorf("LINE channel token not configured for tenant %s", tenantID)
	}

	return &TenantLINEConfig{ChannelToken: token, ChannelID: chanID}, nil
}

type TextMessage struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type PushRequest struct {
	To       string        `json:"to"`
	Messages []TextMessage `json:"messages"`
}

// PushText sends a text message to a LINE user
func (s *Service) PushText(ctx context.Context, tenantID, lineUserID, text string) error {
	cfg, err := s.configForTenant(ctx, tenantID)
	if err != nil {
		return err
	}

	payload := PushRequest{
		To: lineUserID,
		Messages: []TextMessage{
			{Type: "text", Text: text},
		},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.line.me/v2/bot/message/push", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.ChannelToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("LINE push API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("LINE push failed (status %d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// PushMulticast sends a text message to multiple LINE users
func (s *Service) PushMulticast(ctx context.Context, tenantID string, lineUserIDs []string, text string) error {
	cfg, err := s.configForTenant(ctx, tenantID)
	if err != nil {
		return err
	}

	payload := map[string]any{
		"to": lineUserIDs,
		"messages": []TextMessage{
			{Type: "text", Text: text},
		},
	}

	body, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.line.me/v2/bot/message/multicast", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.ChannelToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("LINE multicast API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("LINE multicast failed (status %d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// GetUserLineID returns the LINE user_id for a given user in a tenant
func (s *Service) GetUserLineID(ctx context.Context, tenantID, userID string) (string, error) {
	var lineUID string
	err := s.db.QueryRow(ctx,
		`SELECT line_user_id FROM users WHERE id = $1 AND tenant_id = $2 AND line_user_id IS NOT NULL`,
		userID, tenantID,
	).Scan(&lineUID)
	if err != nil {
		return "", fmt.Errorf("user has no LINE ID: %w", err)
	}
	return lineUID, nil
}
