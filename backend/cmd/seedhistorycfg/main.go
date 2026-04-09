package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"saversure/internal/config"
)

// Standalone seed runner for seed_history_subpage_configs.sql
// Idempotent thanks to ON CONFLICT DO NOTHING inside the SQL.
func main() {
	godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DB.DSN())
	if err != nil {
		log.Fatalf("failed to connect: %v", err)
	}
	defer pool.Close()

	// Locate SQL file
	candidates := []string{
		"migrations/seed_history_subpage_configs.sql",
		"backend/migrations/seed_history_subpage_configs.sql",
		"../migrations/seed_history_subpage_configs.sql",
	}
	var sqlPath string
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			sqlPath = c
			break
		}
	}
	if sqlPath == "" {
		log.Fatal("seed_history_subpage_configs.sql not found")
	}

	abs, _ := filepath.Abs(sqlPath)
	fmt.Printf("running: %s\n", abs)

	sqlBytes, err := os.ReadFile(sqlPath)
	if err != nil {
		log.Fatalf("read sql: %v", err)
	}

	if _, err := pool.Exec(ctx, string(sqlBytes)); err != nil {
		log.Fatalf("exec sql: %v", err)
	}

	// Verify
	var count int
	pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM page_configs
		 WHERE page_slug IN ('history_redeems','history_coupons','history_lucky_draw')`,
	).Scan(&count)
	fmt.Printf("✓ done — %d page_configs rows matching history sub-pages\n", count)
}
