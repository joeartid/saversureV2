package migrationjob

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"saversure/internal/config"
)

var errJobCancelled = errors.New("migration job cancelled")

type sourceDB struct {
	pool *pgxpool.Pool
}

func (s *sourceDB) Close() {
	if s != nil && s.pool != nil {
		s.pool.Close()
	}
}

type Service struct {
	db      *pgxpool.Pool
	cfg     *config.Config
	mu      sync.Mutex
	running map[string]struct{}
}

func NewService(db *pgxpool.Pool, cfg *config.Config) *Service {
	return &Service{
		db:      db,
		cfg:     cfg,
		running: make(map[string]struct{}),
	}
}

func (s *Service) RecoverInterruptedJobs(ctx context.Context) error {
	_, err := s.db.Exec(ctx,
		`UPDATE migration_jobs
		 SET status = 'failed',
		     current_step = 'interrupted',
		     last_error = COALESCE(last_error, 'interrupted by server restart'),
		     finished_at = NOW(),
		     updated_at = NOW()
		 WHERE status = 'running'`,
	)
	return err
}

func (s *Service) GetSourceConfig() SourceConfig {
	return SourceConfig{
		Label:       "Saversure V1 Backup",
		Host:        s.cfg.LegacyV1.Host,
		Port:        s.cfg.LegacyV1.Port,
		Database:    s.cfg.LegacyV1.Name,
		User:        s.cfg.LegacyV1.User,
		SSLMode:     s.cfg.LegacyV1.SSLMode,
		HasPassword: s.cfg.LegacyV1.Password != "",
	}
}

func (s *Service) CreateJob(ctx context.Context, tenantID, requestedBy string, input CreateJobInput) (*Job, error) {
	modules, err := normalizeModules(input.Modules)
	if err != nil {
		return nil, err
	}
	mode := input.Mode
	if mode == "" {
		mode = JobModeDryRun
	}
	if mode != JobModeDryRun && mode != JobModeExecute {
		return nil, fmt.Errorf("invalid mode: %s", mode)
	}

	chunkSize := input.ChunkSize
	if chunkSize <= 0 {
		chunkSize = 1000
	}
	if chunkSize < 100 {
		chunkSize = 100
	}
	if chunkSize > 5000 {
		chunkSize = 5000
	}

	options := JobOptions{ChunkSize: chunkSize}
	optionsJSON, _ := json.Marshal(options)
	sourceJSON, _ := json.Marshal(s.GetSourceConfig())

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin create migration job: %w", err)
	}
	defer tx.Rollback(ctx)

	var jobID string
	err = tx.QueryRow(ctx,
		`INSERT INTO migration_jobs (
			tenant_id, requested_by, mode, status, source_system,
			selected_modules, source_config_snapshot, options_json, created_at, updated_at
		) VALUES ($1, $2, $3, 'queued', 'v1_backup', $4, $5::jsonb, $6::jsonb, NOW(), NOW())
		RETURNING id`,
		tenantID, requestedBy, mode, modules, string(sourceJSON), string(optionsJSON),
	).Scan(&jobID)
	if err != nil {
		return nil, fmt.Errorf("insert migration job: %w", err)
	}

	for idx, moduleName := range modules {
		_, err = tx.Exec(ctx,
			`INSERT INTO migration_job_modules (
				job_id, module_name, dependency_order, status, created_at, updated_at
			) VALUES ($1, $2, $3, 'queued', NOW(), NOW())`,
			jobID, moduleName, idx+1,
		)
		if err != nil {
			return nil, fmt.Errorf("insert migration module %s: %w", moduleName, err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit migration job: %w", err)
	}

	s.StartJob(jobID)
	return s.GetJob(ctx, tenantID, jobID)
}

func (s *Service) StartJob(jobID string) {
	s.mu.Lock()
	if _, exists := s.running[jobID]; exists {
		s.mu.Unlock()
		return
	}
	s.running[jobID] = struct{}{}
	s.mu.Unlock()

	go func() {
		defer func() {
			s.mu.Lock()
			delete(s.running, jobID)
			s.mu.Unlock()
		}()
		s.runJob(jobID)
	}()
}

func (s *Service) ListJobs(ctx context.Context, tenantID string, limit, offset int) ([]Job, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	var total int64
	_ = s.db.QueryRow(ctx, `SELECT COUNT(*) FROM migration_jobs WHERE tenant_id = $1`, tenantID).Scan(&total)

	rows, err := s.db.Query(ctx,
		`SELECT mj.id, mj.tenant_id, mj.requested_by,
		        COALESCE(u.display_name, u.email),
		        mj.mode, mj.status, mj.source_system, mj.selected_modules,
		        mj.source_config_snapshot::text, mj.options_json::text,
		        mj.current_module, mj.current_step, mj.total_items, mj.processed_items,
		        mj.success_count, mj.failed_count, mj.warning_count, mj.percent,
		        mj.report_json::text, mj.last_error,
		        mj.started_at::text, mj.finished_at::text, mj.created_at::text
		 FROM migration_jobs mj
		 LEFT JOIN users u ON u.id = mj.requested_by
		 WHERE mj.tenant_id = $1
		 ORDER BY mj.created_at DESC
		 LIMIT $2 OFFSET $3`,
		tenantID, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list migration jobs: %w", err)
	}
	defer rows.Close()

	var jobs []Job
	for rows.Next() {
		job, err := scanJob(rows)
		if err != nil {
			return nil, 0, err
		}
		jobs = append(jobs, *job)
	}
	return jobs, total, nil
}

func (s *Service) GetJob(ctx context.Context, tenantID, jobID string) (*Job, error) {
	row := s.db.QueryRow(ctx,
		`SELECT mj.id, mj.tenant_id, mj.requested_by,
		        COALESCE(u.display_name, u.email),
		        mj.mode, mj.status, mj.source_system, mj.selected_modules,
		        mj.source_config_snapshot::text, mj.options_json::text,
		        mj.current_module, mj.current_step, mj.total_items, mj.processed_items,
		        mj.success_count, mj.failed_count, mj.warning_count, mj.percent,
		        mj.report_json::text, mj.last_error,
		        mj.started_at::text, mj.finished_at::text, mj.created_at::text
		 FROM migration_jobs mj
		 LEFT JOIN users u ON u.id = mj.requested_by
		 WHERE mj.id = $1 AND mj.tenant_id = $2`,
		jobID, tenantID,
	)
	return scanJob(row)
}

func (s *Service) GetJobDetail(ctx context.Context, tenantID, jobID string) (*JobDetail, error) {
	job, err := s.GetJob(ctx, tenantID, jobID)
	if err != nil {
		return nil, err
	}
	modules, err := s.listModules(ctx, jobID)
	if err != nil {
		return nil, err
	}
	errors, err := s.ListErrors(ctx, tenantID, jobID, 50, 0)
	if err != nil {
		return nil, err
	}
	return &JobDetail{Job: job, Modules: modules, Errors: errors}, nil
}

func (s *Service) ListErrors(ctx context.Context, tenantID, jobID string, limit, offset int) ([]JobError, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.Query(ctx,
		`SELECT e.id, e.job_id, e.module_name, e.source_entity_type, e.source_id, e.message, e.details::text, e.created_at::text
		 FROM migration_job_errors e
		 JOIN migration_jobs j ON j.id = e.job_id
		 WHERE e.job_id = $1 AND j.tenant_id = $2
		 ORDER BY e.created_at DESC
		 LIMIT $3 OFFSET $4`,
		jobID, tenantID, limit, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("list migration errors: %w", err)
	}
	defer rows.Close()

	var items []JobError
	for rows.Next() {
		var item JobError
		var detailsRaw string
		if err := rows.Scan(&item.ID, &item.JobID, &item.ModuleName, &item.SourceEntityType, &item.SourceID, &item.Message, &detailsRaw, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan migration error: %w", err)
		}
		_ = json.Unmarshal([]byte(detailsRaw), &item.Details)
		if item.Details == nil {
			item.Details = map[string]any{}
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Service) CancelJob(ctx context.Context, tenantID, jobID string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE migration_jobs
		 SET status = 'cancelled', current_step = 'cancel_requested', updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2 AND status IN ('queued', 'running')`,
		jobID, tenantID,
	)
	return err
}

func (s *Service) RetryJob(ctx context.Context, tenantID, requestedBy, jobID string) (*Job, error) {
	job, err := s.GetJob(ctx, tenantID, jobID)
	if err != nil {
		return nil, err
	}
	return s.CreateJob(ctx, tenantID, requestedBy, CreateJobInput{
		Modules:   job.SelectedModules,
		Mode:      job.Mode,
		ChunkSize: job.Options.ChunkSize,
	})
}

func (s *Service) listModules(ctx context.Context, jobID string) ([]JobModule, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, job_id, module_name, dependency_order, status, current_step,
		        estimated_count, processed_count, success_count, failed_count, warning_count, percent,
		        warnings_json::text, summary_json::text, started_at::text, finished_at::text
		 FROM migration_job_modules
		 WHERE job_id = $1
		 ORDER BY dependency_order`,
		jobID,
	)
	if err != nil {
		return nil, fmt.Errorf("list migration modules: %w", err)
	}
	defer rows.Close()

	var modules []JobModule
	for rows.Next() {
		var item JobModule
		var warningsRaw, summaryRaw string
		if err := rows.Scan(
			&item.ID, &item.JobID, &item.ModuleName, &item.DependencyOrder, &item.Status, &item.CurrentStep,
			&item.EstimatedCount, &item.ProcessedCount, &item.SuccessCount, &item.FailedCount, &item.WarningCount, &item.Percent,
			&warningsRaw, &summaryRaw, &item.StartedAt, &item.FinishedAt,
		); err != nil {
			return nil, fmt.Errorf("scan migration module: %w", err)
		}
		_ = json.Unmarshal([]byte(warningsRaw), &item.Warnings)
		_ = json.Unmarshal([]byte(summaryRaw), &item.Summary)
		if item.Warnings == nil {
			item.Warnings = []string{}
		}
		if item.Summary == nil {
			item.Summary = map[string]any{}
		}
		modules = append(modules, item)
	}
	return modules, nil
}

func scanJob(scanner interface{ Scan(dest ...any) error }) (*Job, error) {
	var item Job
	var sourceRaw, optionsRaw, reportRaw string
	if err := scanner.Scan(
		&item.ID, &item.TenantID, &item.RequestedBy, &item.RequestedByName,
		&item.Mode, &item.Status, &item.SourceSystem, &item.SelectedModules,
		&sourceRaw, &optionsRaw, &item.CurrentModule, &item.CurrentStep,
		&item.TotalItems, &item.ProcessedItems, &item.SuccessCount, &item.FailedCount, &item.WarningCount, &item.Percent,
		&reportRaw, &item.LastError, &item.StartedAt, &item.FinishedAt, &item.CreatedAt,
	); err != nil {
		return nil, fmt.Errorf("scan migration job: %w", err)
	}
	_ = json.Unmarshal([]byte(sourceRaw), &item.SourceConfigSnapshot)
	_ = json.Unmarshal([]byte(optionsRaw), &item.Options)
	_ = json.Unmarshal([]byte(reportRaw), &item.Report)
	if item.Report == nil {
		item.Report = map[string]any{}
	}
	return &item, nil
}

func normalizeModules(input []string) ([]string, error) {
	if len(input) == 0 {
		return nil, fmt.Errorf("at least one module is required")
	}
	set := map[string]bool{}
	add := func(module string) {
		switch module {
		case ModuleScanHistory:
			set[ModuleCustomer] = true
		case ModuleRedeemHistory:
			set[ModuleCustomer] = true
			set[ModuleRewards] = true
		}
		set[module] = true
	}

	for _, item := range input {
		module := strings.TrimSpace(strings.ToLower(item))
		switch module {
		case ModuleCustomer, ModuleProduct, ModuleRewards, ModuleScanHistory, ModuleRedeemHistory:
			add(module)
		default:
			return nil, fmt.Errorf("unsupported module: %s", item)
		}
	}

	var modules []string
	for _, module := range moduleOrder {
		if set[module] {
			modules = append(modules, module)
		}
	}
	return modules, nil
}

func (s *Service) runJob(jobID string) {
	ctx := context.Background()

	var tenantID, requestedBy, mode string
	var optionsRaw string
	err := s.db.QueryRow(ctx,
		`SELECT tenant_id, requested_by, mode, options_json::text
		 FROM migration_jobs WHERE id = $1`,
		jobID,
	).Scan(&tenantID, &requestedBy, &mode, &optionsRaw)
	if err != nil {
		return
	}

	options := JobOptions{ChunkSize: 1000}
	_ = json.Unmarshal([]byte(optionsRaw), &options)
	if options.ChunkSize <= 0 {
		options.ChunkSize = 1000
	}

	if err := s.setJobRunning(ctx, jobID); err != nil {
		_ = s.failJob(ctx, jobID, err.Error())
		return
	}

	source, err := s.openSourceDB(ctx)
	if err != nil {
		_ = s.failJob(ctx, jobID, err.Error())
		return
	}
	defer source.Close()

	modules, err := s.listModules(ctx, jobID)
	if err != nil {
		_ = s.failJob(ctx, jobID, err.Error())
		return
	}

	report := make(map[string]any)
	for _, module := range modules {
		if err := s.ensureNotCancelled(ctx, jobID); err != nil {
			_ = s.cancelJobInternally(ctx, jobID, module.ModuleName)
			return
		}

		if err := s.setModuleRunning(ctx, jobID, module.ModuleName); err != nil {
			_ = s.failJob(ctx, jobID, err.Error())
			return
		}

		outcome, runErr := s.runModule(ctx, moduleContext{
			JobID:       jobID,
			ModuleName:  module.ModuleName,
			TenantID:    tenantID,
			RequestedBy: requestedBy,
			Mode:        mode,
			ChunkSize:   options.ChunkSize,
			Source:      source,
			StartedAt:   time.Now(),
		})
		if runErr != nil {
			if errors.Is(runErr, errJobCancelled) {
				_ = s.cancelJobInternally(ctx, jobID, module.ModuleName)
				return
			}
			_ = s.finishModule(ctx, jobID, module.ModuleName, JobStatusFailed, &moduleOutcome{
				Warnings: []string{runErr.Error()},
			}, runErr.Error())
			_ = s.failJob(ctx, jobID, runErr.Error())
			return
		}

		if err := s.finishModule(ctx, jobID, module.ModuleName, JobStatusCompleted, outcome, ""); err != nil {
			_ = s.failJob(ctx, jobID, err.Error())
			return
		}
		report[module.ModuleName] = outcome.Summary
	}

	reportJSON, _ := json.Marshal(report)
	_, _ = s.db.Exec(ctx,
		`UPDATE migration_jobs
		 SET status = 'completed', current_module = NULL, current_step = 'completed',
		     finished_at = NOW(), updated_at = NOW(), report_json = $2::jsonb
		 WHERE id = $1`,
		jobID, string(reportJSON),
	)
}

func (s *Service) setJobRunning(ctx context.Context, jobID string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE migration_jobs
		 SET status = 'running', started_at = COALESCE(started_at, NOW()), current_step = 'initializing', updated_at = NOW()
		 WHERE id = $1`,
		jobID,
	)
	return err
}

func (s *Service) failJob(ctx context.Context, jobID, message string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE migration_jobs
		 SET status = 'failed', current_step = 'failed', last_error = $2,
		     finished_at = NOW(), updated_at = NOW()
		 WHERE id = $1`,
		jobID, message,
	)
	return err
}

func (s *Service) cancelJobInternally(ctx context.Context, jobID, moduleName string) error {
	_, _ = s.db.Exec(ctx,
		`UPDATE migration_job_modules
		 SET status = 'cancelled', current_step = 'cancelled', finished_at = NOW(), updated_at = NOW()
		 WHERE job_id = $1 AND module_name = $2 AND status IN ('queued', 'running')`,
		jobID, moduleName,
	)
	_, err := s.db.Exec(ctx,
		`UPDATE migration_jobs
		 SET status = 'cancelled', current_module = $2, current_step = 'cancelled',
		     finished_at = NOW(), updated_at = NOW()
		 WHERE id = $1`,
		jobID, moduleName,
	)
	return err
}

func (s *Service) setModuleRunning(ctx context.Context, jobID, moduleName string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE migration_job_modules
		 SET status = 'running', current_step = 'initializing', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
		 WHERE job_id = $1 AND module_name = $2`,
		jobID, moduleName,
	)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx,
		`UPDATE migration_jobs
		 SET current_module = $2, current_step = 'initializing', updated_at = NOW()
		 WHERE id = $1`,
		jobID, moduleName,
	)
	return err
}

func (s *Service) updateModuleProgress(ctx context.Context, jobID, moduleName, currentStep string, outcome moduleOutcome) error {
	percent := float64(0)
	if outcome.Estimated > 0 {
		percent = float64(outcome.Processed) / float64(outcome.Estimated) * 100
		if percent > 100 {
			percent = 100
		}
	}
	_, err := s.db.Exec(ctx,
		`UPDATE migration_job_modules
		 SET current_step = $3,
		     estimated_count = $4,
		     processed_count = $5,
		     success_count = $6,
		     failed_count = $7,
		     warning_count = $8,
		     percent = $9,
		     updated_at = NOW()
		 WHERE job_id = $1 AND module_name = $2`,
		jobID, moduleName, currentStep, outcome.Estimated, outcome.Processed, outcome.Success, outcome.Failed, len(outcome.Warnings), percent,
	)
	if err != nil {
		return err
	}
	return s.recalcJobProgress(ctx, jobID, moduleName, currentStep)
}

func (s *Service) finishModule(ctx context.Context, jobID, moduleName, status string, outcome *moduleOutcome, lastError string) error {
	if outcome == nil {
		outcome = &moduleOutcome{Summary: map[string]any{}}
	}
	warningsJSON, _ := json.Marshal(outcome.Warnings)
	summaryJSON, _ := json.Marshal(outcome.Summary)
	percent := float64(100)
	if status == JobStatusCancelled {
		percent = 0
	}
	_, err := s.db.Exec(ctx,
		`UPDATE migration_job_modules
		 SET status = $3,
		     current_step = CASE WHEN $3 = 'completed' THEN 'completed' ELSE current_step END,
		     estimated_count = $4,
		     processed_count = $5,
		     success_count = $6,
		     failed_count = $7,
		     warning_count = $8,
		     percent = $9,
		     warnings_json = $10::jsonb,
		     summary_json = $11::jsonb,
		     finished_at = NOW(),
		     updated_at = NOW()
		 WHERE job_id = $1 AND module_name = $2`,
		jobID, moduleName, status, outcome.Estimated, outcome.Processed, outcome.Success, outcome.Failed, len(outcome.Warnings), percent, string(warningsJSON), string(summaryJSON),
	)
	if err != nil {
		return err
	}
	return s.recalcJobProgress(ctx, jobID, moduleName, "completed")
}

func (s *Service) recalcJobProgress(ctx context.Context, jobID, currentModule, currentStep string) error {
	var totalEstimated, totalProcessed, totalSuccess, totalFailed, totalWarnings int64
	var moduleCount int64
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(estimated_count), 0),
		        COALESCE(SUM(processed_count), 0),
		        COALESCE(SUM(success_count), 0),
		        COALESCE(SUM(failed_count), 0),
		        COALESCE(SUM(warning_count), 0),
		        COUNT(*)
		 FROM migration_job_modules
		 WHERE job_id = $1`,
		jobID,
	).Scan(&totalEstimated, &totalProcessed, &totalSuccess, &totalFailed, &totalWarnings, &moduleCount)
	if err != nil {
		return err
	}

	percent := float64(0)
	if totalEstimated > 0 {
		percent = float64(totalProcessed) / float64(totalEstimated) * 100
	} else if moduleCount > 0 {
		var completed int64
		_ = s.db.QueryRow(ctx, `SELECT COUNT(*) FROM migration_job_modules WHERE job_id = $1 AND status = 'completed'`, jobID).Scan(&completed)
		percent = float64(completed) / float64(moduleCount) * 100
	}
	if percent > 100 {
		percent = 100
	}

	_, err = s.db.Exec(ctx,
		`UPDATE migration_jobs
		 SET current_module = $2,
		     current_step = $3,
		     total_items = $4,
		     processed_items = $5,
		     success_count = $6,
		     failed_count = $7,
		     warning_count = $8,
		     percent = $9,
		     updated_at = NOW()
		 WHERE id = $1 AND status = 'running'`,
		jobID, currentModule, currentStep, totalEstimated, totalProcessed, totalSuccess, totalFailed, totalWarnings, percent,
	)
	return err
}

func (s *Service) ensureNotCancelled(ctx context.Context, jobID string) error {
	var status string
	if err := s.db.QueryRow(ctx, `SELECT status FROM migration_jobs WHERE id = $1`, jobID).Scan(&status); err != nil {
		return err
	}
	if status == JobStatusCancelled {
		return errJobCancelled
	}
	return nil
}

func (s *Service) appendError(ctx context.Context, jobID, moduleName, entityType, sourceID, message string, details map[string]any) {
	if details == nil {
		details = map[string]any{}
	}
	raw, _ := json.Marshal(details)
	var entityTypePtr, sourceIDPtr *string
	if entityType != "" {
		entityTypePtr = &entityType
	}
	if sourceID != "" {
		sourceIDPtr = &sourceID
	}
	_, _ = s.db.Exec(ctx,
		`INSERT INTO migration_job_errors (job_id, module_name, source_entity_type, source_id, message, details)
		 VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
		jobID, moduleName, entityTypePtr, sourceIDPtr, message, string(raw),
	)
}

func (s *Service) openSourceDB(ctx context.Context) (*sourceDB, error) {
	if s.cfg.LegacyV1.Password == "" {
		return nil, fmt.Errorf("LEGACY_V1_DB_PASSWORD is required for migration jobs")
	}
	pool, err := pgxpool.New(ctx, s.cfg.LegacyV1.DSN())
	if err != nil {
		return nil, fmt.Errorf("connect legacy v1 source: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping legacy v1 source: %w", err)
	}
	return &sourceDB{pool: pool}, nil
}

func (s *Service) upsertEntityMap(ctx context.Context, tx pgx.Tx, tenantID, entityType, sourceID, targetID, jobID string, metadata map[string]any) error {
	if metadata == nil {
		metadata = map[string]any{}
	}
	raw, _ := json.Marshal(metadata)
	_, err := tx.Exec(ctx,
		`INSERT INTO migration_entity_maps (
			tenant_id, entity_type, source_system, source_id, target_id, latest_job_id, metadata, created_at, updated_at
		)
		 VALUES ($1, $2, 'v1', $3, $4, $5, $6::jsonb, NOW(), NOW())
		 ON CONFLICT (tenant_id, entity_type, source_system, source_id)
		 DO UPDATE SET target_id = EXCLUDED.target_id, latest_job_id = EXCLUDED.latest_job_id,
		               metadata = EXCLUDED.metadata, updated_at = NOW()`,
		tenantID, entityType, sourceID, targetID, jobID, string(raw),
	)
	return err
}

func (s *Service) getEntityMap(ctx context.Context, tenantID, entityType, sourceID string) (string, bool, error) {
	var targetID string
	err := s.db.QueryRow(ctx,
		`SELECT target_id
		 FROM migration_entity_maps
		 WHERE tenant_id = $1 AND entity_type = $2 AND source_system = 'v1' AND source_id = $3`,
		tenantID, entityType, sourceID,
	).Scan(&targetID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", false, nil
		}
		return "", false, err
	}
	return targetID, true, nil
}

func (s *Service) ensureMigrationCampaign(ctx context.Context, tenantID, requestedBy string) (string, error) {
	targetID, ok, err := s.getEntityMap(ctx, tenantID, "campaign", "legacy_rewards")
	if err == nil && ok {
		return targetID, nil
	}

	var campaignID string
	err = s.db.QueryRow(ctx,
		`SELECT id FROM campaigns
		 WHERE tenant_id = $1 AND type = 'legacy_migration'
		 ORDER BY created_at ASC LIMIT 1`,
		tenantID,
	).Scan(&campaignID)
	if err == nil {
		tx, txErr := s.db.Begin(ctx)
		if txErr != nil {
			return "", txErr
		}
		defer tx.Rollback(ctx)
		if err := s.upsertEntityMap(ctx, tx, tenantID, "campaign", "legacy_rewards", campaignID, "", map[string]any{
			"name": "Legacy V1 Rewards",
		}); err != nil {
			return "", err
		}
		if err := tx.Commit(ctx); err != nil {
			return "", err
		}
		return campaignID, nil
	}

	err = s.db.QueryRow(ctx,
		`INSERT INTO campaigns (
			tenant_id, name, description, type, status, settings, created_by, created_at
		) VALUES (
			$1, 'Legacy V1 Rewards', 'Auto-created by Migration Center for imported V1 rewards',
			'legacy_migration', 'draft', '{"hidden":true}'::jsonb, $2, NOW()
		)
		RETURNING id`,
		tenantID, requestedBy,
	).Scan(&campaignID)
	if err != nil {
		return "", fmt.Errorf("create migration campaign: %w", err)
	}

	tx, txErr := s.db.Begin(ctx)
	if txErr != nil {
		return "", txErr
	}
	defer tx.Rollback(ctx)
	if err := s.upsertEntityMap(ctx, tx, tenantID, "campaign", "legacy_rewards", campaignID, "", map[string]any{
		"name": "Legacy V1 Rewards",
	}); err != nil {
		return "", err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return campaignID, nil
}

func (s *Service) ensureCurrency(ctx context.Context, tenantID, code, name, icon string) error {
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return nil
	}
	_, err := s.db.Exec(ctx,
		`INSERT INTO point_currencies (tenant_id, code, name, icon, is_default, sort_order, active, exchange_rate)
		 VALUES ($1, $2, $3, $4, $5, 0, TRUE, 1.0)
		 ON CONFLICT (tenant_id, code) DO UPDATE
		 SET name = EXCLUDED.name, icon = EXCLUDED.icon, active = TRUE`,
		tenantID, code, name, icon, code == "point",
	)
	return err
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
