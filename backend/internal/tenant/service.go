package tenant

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

type Tenant struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Slug      string         `json:"slug"`
	Shortcode *string        `json:"shortcode,omitempty"`
	Settings  map[string]any `json:"settings"`
	Ref2Next  int64          `json:"ref2_next"`
	Status    string         `json:"status"`
	CreatedAt string         `json:"created_at"`
}

type CreateInput struct {
	Name      string         `json:"name" binding:"required"`
	Slug      string         `json:"slug" binding:"required"`
	Shortcode *string        `json:"shortcode"`
	Settings  map[string]any `json:"settings"`
}

type UpdateInput struct {
	Name      *string         `json:"name"`
	Shortcode *string         `json:"shortcode"`
	Settings  *map[string]any `json:"settings"`
	Status    *string         `json:"status"`
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Tenant, error) {
	var t Tenant
	var rawSettings string
	err := s.db.QueryRow(ctx,
		`INSERT INTO tenants (name, slug, shortcode, settings, status)
		 VALUES ($1, $2, $3, COALESCE($4::jsonb, '{}'::jsonb), 'active')
		 RETURNING id, name, slug, shortcode, COALESCE(settings, '{}'::jsonb)::text, ref2_next, status, created_at::text`,
		input.Name, input.Slug, input.Shortcode, input.Settings,
	).Scan(&t.ID, &t.Name, &t.Slug, &t.Shortcode, &rawSettings, &t.Ref2Next, &t.Status, &t.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create tenant: %w", err)
	}
	if rawSettings != "" {
		_ = json.Unmarshal([]byte(rawSettings), &t.Settings)
	}
	return &t, nil
}

func (s *Service) List(ctx context.Context) ([]Tenant, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, name, slug, shortcode, COALESCE(settings, '{}'::jsonb)::text, ref2_next, status, created_at::text FROM tenants ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list tenants: %w", err)
	}
	defer rows.Close()

	var tenants []Tenant
	for rows.Next() {
		var t Tenant
		var rawSettings string
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.Shortcode, &rawSettings, &t.Ref2Next, &t.Status, &t.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan tenant: %w", err)
		}
		if rawSettings != "" {
			_ = json.Unmarshal([]byte(rawSettings), &t.Settings)
		}
		tenants = append(tenants, t)
	}
	return tenants, nil
}

func (s *Service) Update(ctx context.Context, id string, input UpdateInput) (*Tenant, error) {
	var t Tenant
	var rawSettings string
	err := s.db.QueryRow(ctx,
		`UPDATE tenants SET
			name = COALESCE($2, name),
			shortcode = COALESCE($3, shortcode),
			settings = COALESCE($4::jsonb, settings),
			status = COALESCE($5, status),
			updated_at = NOW()
		 WHERE id = $1
		 RETURNING id, name, slug, shortcode, COALESCE(settings, '{}'::jsonb)::text, ref2_next, status, created_at::text`,
		id, input.Name, input.Shortcode, input.Settings, input.Status,
	).Scan(&t.ID, &t.Name, &t.Slug, &t.Shortcode, &rawSettings, &t.Ref2Next, &t.Status, &t.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("update tenant: %w", err)
	}
	if rawSettings != "" {
		_ = json.Unmarshal([]byte(rawSettings), &t.Settings)
	}
	return &t, nil
}

func (s *Service) GetBySlug(ctx context.Context, slug string) (*Tenant, error) {
	var t Tenant
	var rawSettings string
	err := s.db.QueryRow(ctx,
		`SELECT id, name, slug, shortcode, COALESCE(settings, '{}'::jsonb)::text, ref2_next, status, created_at::text FROM tenants WHERE slug = $1 AND status = 'active'`,
		slug,
	).Scan(&t.ID, &t.Name, &t.Slug, &t.Shortcode, &rawSettings, &t.Ref2Next, &t.Status, &t.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get tenant by slug: %w", err)
	}
	if rawSettings != "" {
		_ = json.Unmarshal([]byte(rawSettings), &t.Settings)
	}
	return &t, nil
}

func (s *Service) GetByShortcode(ctx context.Context, shortcode string) (*Tenant, error) {
	var t Tenant
	var rawSettings string
	err := s.db.QueryRow(ctx,
		`SELECT id, name, slug, shortcode, COALESCE(settings, '{}'::jsonb)::text, ref2_next, status, created_at::text FROM tenants WHERE shortcode = $1 AND status = 'active'`,
		shortcode,
	).Scan(&t.ID, &t.Name, &t.Slug, &t.Shortcode, &rawSettings, &t.Ref2Next, &t.Status, &t.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get tenant by shortcode: %w", err)
	}
	if rawSettings != "" {
		_ = json.Unmarshal([]byte(rawSettings), &t.Settings)
	}
	return &t, nil
}

func (s *Service) GetByID(ctx context.Context, id string) (*Tenant, error) {
	var t Tenant
	var rawSettings string
	err := s.db.QueryRow(ctx,
		`SELECT id, name, slug, shortcode, COALESCE(settings, '{}'::jsonb)::text, ref2_next, status, created_at::text FROM tenants WHERE id = $1`,
		id,
	).Scan(&t.ID, &t.Name, &t.Slug, &t.Shortcode, &rawSettings, &t.Ref2Next, &t.Status, &t.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get tenant: %w", err)
	}
	if rawSettings != "" {
		_ = json.Unmarshal([]byte(rawSettings), &t.Settings)
	}
	return &t, nil
}
