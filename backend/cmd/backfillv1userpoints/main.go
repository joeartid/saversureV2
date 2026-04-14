package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"saversure/internal/config"
)

func main() {
	_ = godotenv.Load(".env", "../.env", "../../.env", "../../../.env")

	tenantID := flag.String("tenant", "00000000-0000-0000-0000-000000000001", "tenant id")
	batchSize := flag.Int("batch", 1000, "batch size")
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

	v1, err := pgxpool.New(ctx, cfg.V1Live.DB.DSN())
	if err != nil {
		log.Fatalf("connect v1 live: %v", err)
	}
	defer v1.Close()

	var totalUpdated int64
	var afterV1UserID int64
	start := time.Now()
	for {
		users, err := loadUsers(ctx, v2, *tenantID, afterV1UserID, *batchSize)
		if err != nil {
			log.Fatalf("load users: %v", err)
		}
		if len(users) == 0 {
			break
		}

		ids := make([]int64, 0, len(users))
		targetByV1 := make(map[int64]string, len(users))
		for _, u := range users {
			ids = append(ids, u.V1UserID)
			targetByV1[u.V1UserID] = u.UserID
			afterV1UserID = u.V1UserID
		}

		points, err := loadPoints(ctx, v1, ids)
		if err != nil {
			log.Fatalf("load points: %v", err)
		}
		updated, err := applyPointSnapshots(ctx, v2, *tenantID, targetByV1, points)
		if err != nil {
			log.Fatalf("apply point snapshots: %v", err)
		}
		totalUpdated += updated
		log.Printf("updated=%d total=%d after_v1_user_id=%d", updated, totalUpdated, afterV1UserID)
	}

	log.Printf("done total_updated=%d elapsed=%s", totalUpdated, time.Since(start).Round(time.Second))
}

type userTarget struct {
	V1UserID int64
	UserID   string
}

type livePoint struct {
	Point     int32
	UpdatedAt *time.Time
}

func loadUsers(ctx context.Context, v2 *pgxpool.Pool, tenantID string, afterV1UserID int64, batchSize int) ([]userTarget, error) {
	rows, err := v2.Query(ctx,
		`SELECT u.v1_user_id, u.id
		 FROM users u
		 WHERE u.tenant_id = $1
		   AND u.v1_user_id IS NOT NULL
		   AND u.v1_user_id > $2
		   AND NOT EXISTS (
		     SELECT 1
		     FROM point_ledger pl
		     WHERE pl.tenant_id = u.tenant_id
		       AND pl.user_id = u.id
		       AND pl.currency = 'point'
		   )
		 ORDER BY u.v1_user_id
		 LIMIT $3`,
		tenantID, afterV1UserID, batchSize,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []userTarget
	for rows.Next() {
		var u userTarget
		if err := rows.Scan(&u.V1UserID, &u.UserID); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func loadPoints(ctx context.Context, v1 *pgxpool.Pool, ids []int64) (map[int64]livePoint, error) {
	rows, err := v1.Query(ctx,
		`SELECT id, point, updated_at
		 FROM users
		 WHERE id = ANY($1)
		   AND point > 0
		   AND deleted_at IS NULL`,
		ids,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[int64]livePoint, len(ids))
	for rows.Next() {
		var (
			id        int64
			point     int32
			updatedAt *time.Time
		)
		if err := rows.Scan(&id, &point, &updatedAt); err != nil {
			return nil, err
		}
		out[id] = livePoint{Point: point, UpdatedAt: updatedAt}
	}
	return out, rows.Err()
}

func applyPointSnapshots(ctx context.Context, v2 *pgxpool.Pool, tenantID string, targetByV1 map[int64]string, points map[int64]livePoint) (int64, error) {
	tx, err := v2.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	var updated int64
	for v1UserID, targetUserID := range targetByV1 {
		live, ok := points[v1UserID]
		if !ok {
			continue
		}
		_, err := tx.Exec(ctx,
			`INSERT INTO point_ledger (
				id, tenant_id, user_id, entry_type, amount, balance_after, reference_type, reference_id, description, currency, created_at
			) VALUES (
				$1, $2, $3, 'credit', $4, $4, 'v1_live_sync_balance', $5, $6, 'point', COALESCE($7, NOW())
			)`,
			newUUID(), tenantID, targetUserID, int(live.Point), int64ToString(v1UserID), pointDescription(live.Point), live.UpdatedAt,
		)
		if err != nil {
			return updated, err
		}
		updated++
	}

	if err := tx.Commit(ctx); err != nil {
		return updated, err
	}
	return updated, nil
}

func int64ToString(v int64) string {
	return fmt.Sprintf("%d", v)
}

func pointDescription(point int32) string {
	return fmt.Sprintf("V1 live point snapshot (%d pts)", point)
}

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
