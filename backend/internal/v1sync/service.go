package v1sync

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"saversure/internal/analyticscache"
	"saversure/internal/config"
)

type Service struct {
	db       *pgxpool.Pool
	cfg      *config.Config
	mu       sync.Mutex
	running  bool
	stopCh   chan struct{}
	tenantID string
	cache    *analyticscache.Store
	cachedHealth   *HealthReport
	cachedHealthAt time.Time
}

var syncEntityOrder = []string{"user", "scan_history", "redeem_history"}

func NewService(db *pgxpool.Pool, cfg *config.Config) *Service {
	return &Service{
		db:       db,
		cfg:      cfg,
		tenantID: "00000000-0000-0000-0000-000000000001",
		cache:    analyticscache.NewStore(db),
	}
}

func (s *Service) IsConfigured() bool {
	return s.cfg.V1Live.DB.Host != "" && s.cfg.V1Live.DB.User != ""
}

func (s *Service) openV1(ctx context.Context) (*pgxpool.Pool, error) {
	dsn := s.cfg.V1Live.DB.DSN()
	poolCfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse v1 live dsn: %w", err)
	}
	poolCfg.MaxConns = int32(s.cfg.V1Live.DB.MaxConns)
	poolCfg.MinConns = int32(s.cfg.V1Live.DB.MinConns)
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("connect v1 live: %w", err)
	}
	return pool, nil
}

type SyncResult struct {
	Entity     string `json:"entity"`
	RowsSynced int64  `json:"rows_synced"`
	Duration   string `json:"duration"`
	Error      string `json:"error,omitempty"`
}

func (s *Service) RunSync(ctx context.Context, entities []string, limit int) []SyncResult {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return []SyncResult{{Entity: "all", Error: "sync already running"}}
	}
	s.running = true
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()

	if !s.IsConfigured() {
		return []SyncResult{{Entity: "all", Error: "V1 live DB not configured"}}
	}
	if err := s.ensureSyncStateRows(ctx); err != nil {
		return []SyncResult{{Entity: "all", Error: err.Error()}}
	}

	if limit <= 0 {
		limit = 5000
	}

	v1, err := s.openV1(ctx)
	if err != nil {
		return []SyncResult{{Entity: "all", Error: err.Error()}}
	}
	defer v1.Close()

	if len(entities) == 0 {
		entities = append([]string(nil), syncEntityOrder...)
	}

	var results []SyncResult
	for _, entity := range entities {
		start := time.Now()
		var synced int64
		var syncErr error

		switch entity {
		case "user":
			synced, syncErr = s.syncUsers(ctx, v1, limit)
		case "scan_history":
			synced, syncErr = s.syncScanHistory(ctx, v1, limit)
		case "redeem_history":
			synced, syncErr = s.syncRedeemHistory(ctx, v1, limit)
		default:
			syncErr = fmt.Errorf("unknown entity: %s", entity)
		}

		r := SyncResult{
			Entity:     entity,
			RowsSynced: synced,
			Duration:   time.Since(start).Round(time.Millisecond).String(),
		}
		if syncErr != nil {
			r.Error = syncErr.Error()
			s.updateSyncState(ctx, entity, 0, synced, "failed", syncErr.Error())
		} else {
			s.updateSyncState(ctx, entity, 0, synced, "completed", "")
		}
		results = append(results, r)
	}
	return results
}

type SyncStatus struct {
	Entity       string  `json:"entity"`
	LastSyncedID int64   `json:"last_synced_id"`
	LastRunAt    *string `json:"last_run_at"`
	Status       string  `json:"status"`
	RowsSynced   int64   `json:"rows_synced"`
	TotalSynced  int64   `json:"total_synced"`
	ErrorMessage *string `json:"error_message,omitempty"`
}

func (s *Service) GetStatus(ctx context.Context) ([]SyncStatus, error) {
	if err := s.ensureSyncStateRows(ctx); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx,
		`SELECT entity_type, last_synced_id, last_run_at::text, last_run_status, rows_synced, total_synced, error_message
		 FROM v1_sync_state ORDER BY entity_type`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []SyncStatus
	for rows.Next() {
		var st SyncStatus
		if err := rows.Scan(&st.Entity, &st.LastSyncedID, &st.LastRunAt, &st.Status, &st.RowsSynced, &st.TotalSynced, &st.ErrorMessage); err != nil {
			return nil, err
		}
		result = append(result, st)
	}
	return result, nil
}

func (s *Service) StartScheduler(ctx context.Context) {
	if !s.cfg.V1Live.SyncEnabled || !s.IsConfigured() {
		slog.Info("v1sync scheduler disabled")
		return
	}

	s.stopCh = make(chan struct{})
	interval := s.cfg.V1Live.SyncInterval
	slog.Info("v1sync scheduler started", "interval", interval)

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				slog.Info("v1sync scheduled run starting")
				results := s.RunSync(ctx, nil, 5000)
				for _, r := range results {
					if r.Error != "" {
						slog.Warn("v1sync entity error", "entity", r.Entity, "error", r.Error)
					} else {
						slog.Info("v1sync entity done", "entity", r.Entity, "rows", r.RowsSynced, "duration", r.Duration)
					}
				}
			case <-s.stopCh:
				slog.Info("v1sync scheduler stopped")
				return
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (s *Service) StopScheduler() {
	if s.stopCh != nil {
		close(s.stopCh)
	}
}

// --- internal helpers ---

func (s *Service) getWatermark(ctx context.Context, entity string) (int64, error) {
	var id int64
	err := s.db.QueryRow(ctx,
		`SELECT last_synced_id FROM v1_sync_state WHERE entity_type = $1`, entity,
	).Scan(&id)
	if err == pgx.ErrNoRows {
		return 0, nil
	}
	return id, err
}

func (s *Service) ensureSyncStateRows(ctx context.Context) error {
	for _, entity := range syncEntityOrder {
		if _, err := s.db.Exec(ctx,
			`INSERT INTO v1_sync_state (entity_type) VALUES ($1) ON CONFLICT (entity_type) DO NOTHING`,
			entity,
		); err != nil {
			return fmt.Errorf("ensure sync state row for %s: %w", entity, err)
		}
	}
	return nil
}

func (s *Service) setWatermark(ctx context.Context, entity string, lastID int64) error {
	_, err := s.db.Exec(ctx,
		`UPDATE v1_sync_state SET last_synced_id = $2, updated_at = NOW() WHERE entity_type = $1`,
		entity, lastID,
	)
	return err
}

func (s *Service) bootstrapUserWatermark(ctx context.Context) (int64, error) {
	var lastID int64
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(MAX(v1_user_id), 0)
		 FROM users
		 WHERE tenant_id = $1 AND v1_user_id IS NOT NULL`,
		s.tenantID,
	).Scan(&lastID)
	return lastID, err
}

func (s *Service) bootstrapScanWatermark(ctx context.Context) (int64, error) {
	var lastID int64
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(MAX(source_id::bigint), 0)
		 FROM migration_entity_maps
		 WHERE tenant_id = $1
		   AND entity_type = 'scan_history'
		   AND source_system = 'v1'
		   AND source_id ~ '^[0-9]+$'`,
		s.tenantID,
	).Scan(&lastID)
	return lastID, err
}

func (s *Service) bootstrapRedeemWatermark(ctx context.Context) (int64, error) {
	var lastID int64
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(MAX(source_id::bigint), 0)
		 FROM migration_entity_maps
		 WHERE tenant_id = $1
		   AND entity_type = 'redeem_history'
		   AND source_system = 'v1'
		   AND source_id ~ '^[0-9]+$'`,
		s.tenantID,
	).Scan(&lastID)
	return lastID, err
}

func (s *Service) scanSourceExists(ctx context.Context, sourceID int64) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1
			FROM migration_entity_maps
			WHERE tenant_id = $1
			  AND entity_type = 'scan_history'
			  AND source_system = 'v1'
			  AND source_id = $2
		)`,
		s.tenantID, fmt.Sprintf("%d", sourceID),
	).Scan(&exists)
	return exists, err
}

func (s *Service) upsertScanSourceMap(ctx context.Context, sourceID int64, targetID string) error {
	_, err := s.db.Exec(ctx,
		`INSERT INTO migration_entity_maps (
			tenant_id, entity_type, source_system, source_id, target_id, metadata, created_at, updated_at
		)
		 VALUES ($1, 'scan_history', 'v1', $2, $3, '{}'::jsonb, NOW(), NOW())
		 ON CONFLICT (tenant_id, entity_type, source_system, source_id)
		 DO UPDATE SET target_id = EXCLUDED.target_id, updated_at = NOW()`,
		s.tenantID, fmt.Sprintf("%d", sourceID), targetID,
	)
	return err
}

func (s *Service) entitySourceExists(ctx context.Context, entityType string, sourceID int64) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1
			FROM migration_entity_maps
			WHERE tenant_id = $1
			  AND entity_type = $2
			  AND source_system = 'v1'
			  AND source_id = $3
		)`,
		s.tenantID, entityType, fmt.Sprintf("%d", sourceID),
	).Scan(&exists)
	return exists, err
}

func (s *Service) upsertEntitySourceMap(ctx context.Context, entityType string, sourceID int64, targetID string) error {
	_, err := s.db.Exec(ctx,
		`INSERT INTO migration_entity_maps (
			tenant_id, entity_type, source_system, source_id, target_id, metadata, created_at, updated_at
		)
		 VALUES ($1, $2, 'v1', $3, $4, '{}'::jsonb, NOW(), NOW())
		 ON CONFLICT (tenant_id, entity_type, source_system, source_id)
		 DO UPDATE SET target_id = EXCLUDED.target_id, updated_at = NOW()`,
		s.tenantID, entityType, fmt.Sprintf("%d", sourceID), targetID,
	)
	return err
}

func (s *Service) loadMappedEntityID(ctx context.Context, entityType string, sourceID int64) (string, bool, error) {
	var targetID string
	err := s.db.QueryRow(ctx,
		`SELECT target_id
		 FROM migration_entity_maps
		 WHERE tenant_id = $1
		   AND entity_type = $2
		   AND source_system = 'v1'
		   AND source_id = $3`,
		s.tenantID, entityType, fmt.Sprintf("%d", sourceID),
	).Scan(&targetID)
	if err == pgx.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return targetID, true, nil
}

func (s *Service) updateSyncState(ctx context.Context, entity string, lastID, rowsSynced int64, status, errMsg string) {
	if lastID > 0 {
		_, _ = s.db.Exec(ctx,
			`UPDATE v1_sync_state
			 SET last_synced_id = GREATEST(last_synced_id, $2),
			     last_run_at = NOW(), last_run_status = $3,
			     rows_synced = $4, total_synced = total_synced + $4,
			     error_message = NULLIF($5, ''), updated_at = NOW()
			 WHERE entity_type = $1`,
			entity, lastID, status, rowsSynced, errMsg,
		)
	} else {
		_, _ = s.db.Exec(ctx,
			`UPDATE v1_sync_state
			 SET last_run_at = NOW(), last_run_status = $2,
			     rows_synced = $3, total_synced = total_synced + $3,
			     error_message = NULLIF($4, ''), updated_at = NOW()
			 WHERE entity_type = $1`,
			entity, status, rowsSynced, errMsg,
		)
	}
}

// --- text/UUID helpers (duplicated from migrationjob to keep package independent) ---

const placeholderHash = "$2a$10$V1MiGrAtEdNoP4ssw0rd000000000000000000000000000000000"

func newUUID() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	buf[6] = (buf[6] & 0x0f) | 0x40
	buf[8] = (buf[8] & 0x3f) | 0x80
	raw := hex.EncodeToString(buf)
	return fmt.Sprintf("%s-%s-%s-%s-%s", raw[0:8], raw[8:12], raw[12:16], raw[16:20], raw[20:32])
}

func sanitizeText(value string) string {
	value = strings.ReplaceAll(value, "\x00", "")
	return strings.ToValidUTF8(value, "")
}

func legacyBytes(value []byte) *string {
	if value == nil {
		return nil
	}
	if !utf8.Valid(value) {
		s := strings.ToValidUTF8(string(value), "")
		s = sanitizeText(s)
		if s == "" {
			return nil
		}
		return &s
	}
	s := sanitizeText(string(value))
	if s == "" {
		return nil
	}
	return &s
}

func strVal(p *string) string {
	if p == nil {
		return ""
	}
	return sanitizeText(*p)
}

func truncStr(value string, max int) string {
	value = sanitizeText(value)
	runes := []rune(value)
	if len(runes) > max {
		return string(runes[:max])
	}
	return value
}

func nullStr(p *string) *string {
	if p == nil {
		return nil
	}
	v := strings.TrimSpace(sanitizeText(*p))
	if v == "" {
		return nil
	}
	return &v
}
