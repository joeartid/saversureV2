package main

import (
	"context"
	"flag"
	"log"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"

	"saversure/internal/config"
	"saversure/internal/migrationjob"
)

func main() {
	_ = godotenv.Load()

	tenantID := flag.String("tenant", "", "tenant id")
	userID := flag.String("user", "", "requesting user id")
	modulesArg := flag.String("modules", "customer,product,rewards,scan_history,redeem_history", "comma-separated modules")
	mode := flag.String("mode", migrationjob.JobModeExecute, "dry_run or execute")
	chunkSize := flag.Int("chunk", 1000, "chunk size")
	pollEvery := flag.Duration("poll", 5*time.Second, "poll interval")
	flag.Parse()

	if *tenantID == "" || *userID == "" {
		log.Fatal("tenant and user are required")
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DB.DSN())
	if err != nil {
		log.Fatalf("connect db: %v", err)
	}
	defer pool.Close()

	svc := migrationjob.NewService(pool, cfg)
	modules := splitModules(*modulesArg)

	job, err := svc.CreateJob(ctx, *tenantID, *userID, migrationjob.CreateJobInput{
		Modules:   modules,
		Mode:      *mode,
		ChunkSize: *chunkSize,
	})
	if err != nil {
		log.Fatalf("create job: %v", err)
	}
	log.Printf("started migration job %s modules=%v mode=%s", job.ID, modules, *mode)

	for {
		time.Sleep(*pollEvery)
		current, err := svc.GetJobDetail(ctx, *tenantID, job.ID)
		if err != nil {
			log.Fatalf("get job detail: %v", err)
		}
		log.Printf("job=%s status=%s processed=%d/%d success=%d failed=%d warnings=%d current_module=%v current_step=%v",
			current.Job.ID, current.Job.Status, current.Job.ProcessedItems, current.Job.TotalItems, current.Job.SuccessCount, current.Job.FailedCount, current.Job.WarningCount, current.Job.CurrentModule, current.Job.CurrentStep)

		if current.Job.Status == migrationjob.JobStatusCompleted {
			for _, module := range current.Modules {
				log.Printf("module=%s status=%s processed=%d/%d summary=%v", module.ModuleName, module.Status, module.ProcessedCount, module.EstimatedCount, module.Summary)
			}
			return
		}
		if current.Job.Status == migrationjob.JobStatusFailed || current.Job.Status == migrationjob.JobStatusCancelled {
			for _, module := range current.Modules {
				log.Printf("module=%s status=%s processed=%d/%d summary=%v warnings=%v", module.ModuleName, module.Status, module.ProcessedCount, module.EstimatedCount, module.Summary, module.Warnings)
			}
			if current.Job.LastError != nil {
				log.Printf("last_error=%s", *current.Job.LastError)
			}
			os.Exit(1)
		}
	}
}

func splitModules(raw string) []string {
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	if len(out) == 0 {
		return []string{migrationjob.ModuleCustomer, migrationjob.ModuleProduct, migrationjob.ModuleRewards, migrationjob.ModuleScanHistory, migrationjob.ModuleRedeemHistory}
	}
	return out
}
