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

// Generic runner for any seed_*.sql file in backend/migrations
//
// Usage:
//   go run ./cmd/seedpagecfg seed_support_faq_page_config.sql
//
// Idempotent thanks to ON CONFLICT DO NOTHING inside the SQL.
func main() {
	godotenv.Load()

	if len(os.Args) < 2 {
		log.Fatal("usage: seedpagecfg <seed_file.sql>")
	}
	filename := os.Args[1]

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

	candidates := []string{
		filepath.Join("migrations", filename),
		filepath.Join("backend", "migrations", filename),
		filepath.Join("..", "migrations", filename),
	}
	var sqlPath string
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			sqlPath = c
			break
		}
	}
	if sqlPath == "" {
		log.Fatalf("%s not found in candidate dirs", filename)
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

	fmt.Println("✓ seed applied successfully")
}
