package navmenu

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

type MenuItem struct {
	Icon      string `json:"icon"`
	Label     string `json:"label"`
	Link      string `json:"link"`
	Visible   bool   `json:"visible"`
	BadgeType string `json:"badge_type,omitempty"`
	Group     string `json:"group,omitempty"`
}

type NavMenu struct {
	ID        string     `json:"id"`
	TenantID  string     `json:"tenant_id"`
	MenuType  string     `json:"menu_type"`
	Items     []MenuItem `json:"items"`
	Version   int        `json:"version"`
	UpdatedBy *string    `json:"updated_by"`
	UpdatedAt string     `json:"updated_at"`
}

type UpsertInput struct {
	TenantID string     `json:"-"`
	UserID   string     `json:"-"`
	MenuType string     `json:"menu_type" binding:"required"`
	Items    []MenuItem `json:"items" binding:"required"`
}

func (s *Service) List(ctx context.Context, tenantID string) ([]NavMenu, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, tenant_id, menu_type, items, version, updated_at::text
		 FROM nav_menus WHERE tenant_id = $1 ORDER BY menu_type`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list nav_menus: %w", err)
	}
	defer rows.Close()

	var menus []NavMenu
	for rows.Next() {
		var m NavMenu
		var itemsJSON []byte
		if err := rows.Scan(&m.ID, &m.TenantID, &m.MenuType, &itemsJSON, &m.Version, &m.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan nav_menu: %w", err)
		}
		if err := json.Unmarshal(itemsJSON, &m.Items); err != nil {
			m.Items = []MenuItem{}
		}
		menus = append(menus, m)
	}
	return menus, nil
}

func (s *Service) GetByType(ctx context.Context, tenantID, menuType string) (*NavMenu, error) {
	var m NavMenu
	var itemsJSON []byte
	err := s.db.QueryRow(ctx,
		`SELECT id, tenant_id, menu_type, items, version, updated_at::text
		 FROM nav_menus WHERE tenant_id = $1 AND menu_type = $2`,
		tenantID, menuType,
	).Scan(&m.ID, &m.TenantID, &m.MenuType, &itemsJSON, &m.Version, &m.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("nav_menu not found: %w", err)
	}
	if err := json.Unmarshal(itemsJSON, &m.Items); err != nil {
		m.Items = []MenuItem{}
	}
	return &m, nil
}

func (s *Service) Upsert(ctx context.Context, input UpsertInput) (*NavMenu, error) {
	validTypes := map[string]bool{"bottom_nav": true, "drawer": true, "header": true}
	if !validTypes[input.MenuType] {
		return nil, fmt.Errorf("invalid menu_type: %s", input.MenuType)
	}

	itemsJSON, err := json.Marshal(input.Items)
	if err != nil {
		return nil, fmt.Errorf("marshal items: %w", err)
	}

	var userIDArg interface{}
	if input.UserID != "" {
		userIDArg = input.UserID
	}

	var m NavMenu
	var outJSON []byte
	err = s.db.QueryRow(ctx,
		`INSERT INTO nav_menus (tenant_id, menu_type, items)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (tenant_id, menu_type)
		 DO UPDATE SET items = $3, version = nav_menus.version + 1, updated_at = NOW()
		 RETURNING id, tenant_id, menu_type, items, version, updated_at::text`,
		input.TenantID, input.MenuType, itemsJSON,
	).Scan(&m.ID, &m.TenantID, &m.MenuType, &outJSON, &m.Version, &m.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("upsert nav_menu: %w", err)
	}
	if err := json.Unmarshal(outJSON, &m.Items); err != nil {
		m.Items = []MenuItem{}
	}
	if userIDArg != nil {
		uid := input.UserID
		m.UpdatedBy = &uid
	}
	return &m, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, menuType string) error {
	result, err := s.db.Exec(ctx,
		`DELETE FROM nav_menus WHERE tenant_id = $1 AND menu_type = $2`,
		tenantID, menuType)
	if err != nil {
		return fmt.Errorf("delete nav_menu: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("nav_menu not found")
	}
	return nil
}
