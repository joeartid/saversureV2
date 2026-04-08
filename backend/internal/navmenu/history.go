package navmenu

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type VersionEntry struct {
	Version   int        `json:"version"`
	Items     []MenuItem `json:"items"`
	UpdatedBy *string    `json:"updated_by"`
	UpdatedAt string     `json:"updated_at"`
}

type HistoryService struct {
	db *pgxpool.Pool
}

func NewHistoryService(db *pgxpool.Pool) *HistoryService {
	return &HistoryService{db: db}
}

func (h *HistoryService) SaveSnapshot(ctx context.Context, nm *NavMenu) error {
	itemsJSON, err := json.Marshal(nm.Items)
	if err != nil {
		return fmt.Errorf("marshal snapshot items: %w", err)
	}

	_, err = h.db.Exec(ctx,
		`INSERT INTO nav_menu_history (nav_menu_id, tenant_id, menu_type, version, items, updated_by)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		nm.ID, nm.TenantID, nm.MenuType, nm.Version, itemsJSON, nm.UpdatedBy)
	if err != nil {
		return fmt.Errorf("save snapshot: %w", err)
	}
	return nil
}

func (h *HistoryService) ListVersions(ctx context.Context, tenantID, menuType string) ([]VersionEntry, error) {
	rows, err := h.db.Query(ctx,
		`SELECT version, items, updated_by, updated_at::text
		 FROM nav_menu_history
		 WHERE tenant_id = $1 AND menu_type = $2
		 ORDER BY version DESC LIMIT 50`, tenantID, menuType)
	if err != nil {
		return nil, fmt.Errorf("list versions: %w", err)
	}
	defer rows.Close()

	var versions []VersionEntry
	for rows.Next() {
		var v VersionEntry
		var itemsJSON []byte
		if err := rows.Scan(&v.Version, &itemsJSON, &v.UpdatedBy, &v.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan version: %w", err)
		}
		if err := json.Unmarshal(itemsJSON, &v.Items); err != nil {
			v.Items = []MenuItem{}
		}
		versions = append(versions, v)
	}
	return versions, nil
}

func (h *HistoryService) GetVersion(ctx context.Context, tenantID, menuType string, version int) (*VersionEntry, error) {
	var v VersionEntry
	var itemsJSON []byte
	err := h.db.QueryRow(ctx,
		`SELECT version, items, updated_by, updated_at::text
		 FROM nav_menu_history
		 WHERE tenant_id = $1 AND menu_type = $2 AND version = $3`,
		tenantID, menuType, version,
	).Scan(&v.Version, &itemsJSON, &v.UpdatedBy, &v.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("version not found: %w", err)
	}
	if err := json.Unmarshal(itemsJSON, &v.Items); err != nil {
		v.Items = []MenuItem{}
	}
	return &v, nil
}
