package analyticscache

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	db *pgxpool.Pool
}

func NewStore(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

func (s *Store) Get(ctx context.Context, tenantID, snapshotKey string, maxAge time.Duration, dest any) (bool, error) {
	var payload []byte
	var refreshedAt time.Time
	err := s.db.QueryRow(ctx,
		`SELECT payload::text, refreshed_at
		 FROM analytics_snapshots
		 WHERE tenant_id = $1 AND snapshot_key = $2`,
		tenantID, snapshotKey,
	).Scan(&payload, &refreshedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	if maxAge > 0 && time.Since(refreshedAt) > maxAge {
		return false, nil
	}
	if err := json.Unmarshal(payload, dest); err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) Put(ctx context.Context, tenantID, snapshotKey string, payload any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx,
		`INSERT INTO analytics_snapshots (
			tenant_id, snapshot_key, payload, refreshed_at, created_at, updated_at
		) VALUES (
			$1, $2, $3::jsonb, NOW(), NOW(), NOW()
		)
		ON CONFLICT (tenant_id, snapshot_key)
		DO UPDATE SET
			payload = EXCLUDED.payload,
			refreshed_at = NOW(),
			updated_at = NOW()`,
		tenantID, snapshotKey, string(raw),
	)
	return err
}

func (s *Store) Delete(ctx context.Context, tenantID, snapshotKey string) error {
	_, err := s.db.Exec(ctx,
		`DELETE FROM analytics_snapshots
		 WHERE tenant_id = $1 AND snapshot_key = $2`,
		tenantID, snapshotKey,
	)
	return err
}
