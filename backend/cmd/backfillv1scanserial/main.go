package main

import (
	"context"
	"flag"
	"log"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"saversure/internal/config"
)

func main() {
	_ = godotenv.Load(".env", "../.env", "../../.env", "../../../.env")

	tenantID := flag.String("tenant", "00000000-0000-0000-0000-000000000001", "tenant id")
	batchSize := flag.Int("batch", 2000, "batch size")
	flag.Parse()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	ctx := context.Background()
	v2, err := pgxpool.New(ctx, cfg.DB.DSN())
	if err != nil {
		log.Fatalf("connect v2: %v", err)
	}
	defer v2.Close()

	var v1Live *pgxpool.Pool
	if cfg.V1Live.DB.Host != "" && cfg.V1Live.DB.User != "" {
		v1Live, err = pgxpool.New(ctx, cfg.V1Live.DB.DSN())
		if err != nil {
			log.Fatalf("connect v1 live: %v", err)
		}
		defer v1Live.Close()
		log.Printf("connected v1 live")
	}

	v1Backup, err := pgxpool.New(ctx, cfg.LegacyV1.DSN())
	if err != nil {
		log.Fatalf("connect v1 backup: %v", err)
	}
	defer v1Backup.Close()
	log.Printf("connected v1 backup")

	var totalUpdated int64
	var afterSourceID int64
	start := time.Now()
	for {
		pairs, err := loadTargets(ctx, v2, *tenantID, afterSourceID, *batchSize)
		if err != nil {
			log.Fatalf("load targets: %v", err)
		}
		if len(pairs) == 0 {
			break
		}

		ids := make([]int64, 0, len(pairs))
		targetBySource := make(map[int64]string, len(pairs))
		for _, p := range pairs {
			ids = append(ids, p.SourceID)
			targetBySource[p.SourceID] = p.TargetID
			afterSourceID = p.SourceID
		}

		serials, err := loadSerials(ctx, v1Live, v1Backup, ids)
		if err != nil {
			log.Fatalf("load serials: %v", err)
		}
		if len(serials) == 0 {
			log.Printf("batch with %d targets had no serials, advancing after_source_id=%d", len(pairs), afterSourceID)
			continue
		}

		updated, err := applyUpdates(ctx, v2, targetBySource, serials)
		if err != nil {
			log.Fatalf("apply updates: %v", err)
		}
		totalUpdated += updated
		log.Printf("updated=%d total=%d after_source_id=%d", updated, totalUpdated, afterSourceID)
	}

	log.Printf("done total_updated=%d elapsed=%s", totalUpdated, time.Since(start).Round(time.Second))
}

type targetPair struct {
	SourceID int64
	TargetID string
}

func loadTargets(ctx context.Context, v2 *pgxpool.Pool, tenantID string, afterSourceID int64, batchSize int) ([]targetPair, error) {
	rows, err := v2.Query(ctx,
		`SELECT m.source_id::bigint, m.target_id
		 FROM migration_entity_maps m
		 JOIN scan_history sh ON sh.id::text = m.target_id AND sh.tenant_id = m.tenant_id
		 WHERE m.tenant_id = $1
		   AND m.entity_type = 'scan_history'
		   AND m.source_system = 'v1'
		   AND m.source_id ~ '^[0-9]+$'
		   AND m.source_id::bigint > $2
		   AND (sh.legacy_qr_code_serial IS NULL OR sh.legacy_qr_code_serial = '')
		 ORDER BY m.source_id::bigint
		 LIMIT $3`,
		tenantID, afterSourceID, batchSize,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []targetPair
	for rows.Next() {
		var p targetPair
		if err := rows.Scan(&p.SourceID, &p.TargetID); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func loadSerials(ctx context.Context, v1Live *pgxpool.Pool, v1Backup *pgxpool.Pool, ids []int64) (map[int64]string, error) {
	out := make(map[int64]string, len(ids))

	if v1Live != nil {
		liveSerials, err := loadSerialsFromDB(ctx, v1Live, ids)
		if err != nil {
			return nil, err
		}
		for id, serial := range liveSerials {
			out[id] = serial
		}
	}

	if len(out) == len(ids) || v1Backup == nil {
		return out, nil
	}

	missing := make([]int64, 0, len(ids)-len(out))
	for _, id := range ids {
		if _, ok := out[id]; !ok {
			missing = append(missing, id)
		}
	}
	if len(missing) == 0 {
		return out, nil
	}

	backupSerials, err := loadSerialsFromDB(ctx, v1Backup, missing)
	if err != nil {
		return nil, err
	}
	for id, serial := range backupSerials {
		out[id] = serial
	}
	return out, nil
}

func loadSerialsFromDB(ctx context.Context, db *pgxpool.Pool, ids []int64) (map[int64]string, error) {
	rows, err := db.Query(ctx,
		`SELECT id, qr_code_serial_number
		 FROM qrcode_scan_history
		 WHERE id = ANY($1)
		   AND qr_code_serial_number IS NOT NULL
		   AND qr_code_serial_number <> ''`,
		ids,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[int64]string, len(ids))
	for rows.Next() {
		var id int64
		var serial string
		if err := rows.Scan(&id, &serial); err != nil {
			return nil, err
		}
		out[id] = serial
	}
	return out, rows.Err()
}

func applyUpdates(ctx context.Context, v2 *pgxpool.Pool, targetBySource map[int64]string, serials map[int64]string) (int64, error) {
	tx, err := v2.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var updated int64
	for sourceID, serial := range serials {
		targetID, ok := targetBySource[sourceID]
		if !ok {
			continue
		}
		ct, err := tx.Exec(ctx,
			`UPDATE scan_history
			 SET legacy_qr_code_serial = $2
			 WHERE id = $1
			   AND (legacy_qr_code_serial IS NULL OR legacy_qr_code_serial = '')`,
			targetID, serial,
		)
		if err != nil {
			return updated, err
		}
		updated += ct.RowsAffected()
	}
	if err := tx.Commit(ctx); err != nil {
		return updated, err
	}
	return updated, nil
}

var _ pgx.Tx
