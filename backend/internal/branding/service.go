package branding

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

type BrandingSettings struct {
	TenantID     string `json:"tenant_id,omitempty"`
	LogoURL      string `json:"logo_url"`
	FaviconURL   string `json:"favicon_url"`
	BrandName    string `json:"brand_name"`
	PrimaryColor string `json:"primary_color"`
	AccentColor  string `json:"accent_color"`
	BGColor      string `json:"bg_color"`
	HeaderBG     string `json:"header_bg"`
	CustomCSS    string `json:"custom_css"`
	WelcomeText  string `json:"welcome_text"`
	FooterText   string `json:"footer_text"`
}

func (s *Service) Get(ctx context.Context, tenantID string) (*BrandingSettings, error) {
	var raw string
	err := s.db.QueryRow(ctx,
		"SELECT branding::text FROM tenants WHERE id = $1",
		tenantID,
	).Scan(&raw)
	if err != nil {
		return nil, fmt.Errorf("get branding: %w", err)
	}

	var settings BrandingSettings
	if raw != "" && raw != "{}" {
		json.Unmarshal([]byte(raw), &settings)
	}
	return &settings, nil
}

func (s *Service) Update(ctx context.Context, tenantID string, settings BrandingSettings) error {
	data, _ := json.Marshal(settings)
	_, err := s.db.Exec(ctx,
		"UPDATE tenants SET branding = $2::jsonb WHERE id = $1",
		tenantID, string(data),
	)
	return err
}
