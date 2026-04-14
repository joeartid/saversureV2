package analyticswarm

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"saversure/internal/crm"
	"saversure/internal/dashboard"
	"saversure/internal/opsdigest"
	"saversure/internal/v1sync"
)

type Scheduler struct {
	db        *pgxpool.Pool
	dashboard *dashboard.Service
	ops       *opsdigest.Service
	v1        *v1sync.Service
	crm       *crm.Service
}

func NewScheduler(db *pgxpool.Pool, dashboardSvc *dashboard.Service, opsSvc *opsdigest.Service, v1SyncSvc *v1sync.Service, crmSvc *crm.Service) *Scheduler {
	return &Scheduler{
		db:        db,
		dashboard: dashboardSvc,
		ops:       opsSvc,
		v1:        v1SyncSvc,
		crm:       crmSvc,
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	go s.run(ctx)
}

func (s *Scheduler) run(ctx context.Context) {
	slog.Info("analytics warm scheduler started")
	s.warmDashboardAndOps(ctx)
	s.warmHealth(ctx)
	s.warmCRM(ctx)
	s.warmCRMAnalytics(ctx)
	s.runCRMAutomation(ctx)
	s.processBroadcasts(ctx)

	dashboardTicker := time.NewTicker(1 * time.Minute)
	defer dashboardTicker.Stop()

	healthTicker := time.NewTicker(3 * time.Minute)
	defer healthTicker.Stop()

	rfmTicker := time.NewTicker(6 * time.Hour)
	defer rfmTicker.Stop()

	broadcastTicker := time.NewTicker(1 * time.Minute)
	defer broadcastTicker.Stop()

	cohortTicker := time.NewTicker(24 * time.Hour)
	defer cohortTicker.Stop()

	automationTicker := time.NewTicker(1 * time.Hour)
	defer automationTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("analytics warm scheduler stopped")
			return
		case <-dashboardTicker.C:
			s.warmDashboardAndOps(ctx)
		case <-healthTicker.C:
			s.warmHealth(ctx)
		case <-rfmTicker.C:
			s.warmCRM(ctx)
		case <-cohortTicker.C:
			s.warmCRMAnalytics(ctx)
		case <-automationTicker.C:
			s.runCRMAutomation(ctx)
		case <-broadcastTicker.C:
			s.processBroadcasts(ctx)
		}
	}
}

func (s *Scheduler) warmDashboardAndOps(parent context.Context) {
	tenantIDs, err := s.listTenantIDs(parent)
	if err != nil {
		slog.Warn("analytics warm: list tenants failed", "error", err)
		return
	}
	for _, tenantID := range tenantIDs {
		start := time.Now()
		s.runWarmStep(parent, 50*time.Second, func(ctx context.Context) error {
			return s.dashboard.RefreshScanRollups(ctx, tenantID)
		}, "scan rollups", tenantID)
		s.runWarmStep(parent, 20*time.Second, func(ctx context.Context) error {
			_, err := s.dashboard.GetSummaryFresh(ctx, tenantID)
			return err
		}, "dashboard summary", tenantID)
		s.runWarmStep(parent, 20*time.Second, func(ctx context.Context) error {
			_, err := s.dashboard.GetScanChartFresh(ctx, tenantID, "day", 30)
			return err
		}, "dashboard day chart", tenantID)
		s.runWarmStep(parent, 25*time.Second, func(ctx context.Context) error {
			_, err := s.dashboard.GetScanChartFresh(ctx, tenantID, "week", 90)
			return err
		}, "dashboard week chart", tenantID)
		s.runWarmStep(parent, 40*time.Second, func(ctx context.Context) error {
			_, err := s.dashboard.GetScanChartFresh(ctx, tenantID, "month", 365)
			return err
		}, "dashboard month chart", tenantID)
		s.runWarmStep(parent, 25*time.Second, func(ctx context.Context) error {
			_, err := s.dashboard.GetConversionFunnelFresh(ctx, tenantID)
			return err
		}, "dashboard funnel", tenantID)
		s.runWarmStep(parent, 20*time.Second, func(ctx context.Context) error {
			_, err := s.dashboard.GetRecentActivityFresh(ctx, tenantID, 10)
			return err
		}, "dashboard activity", tenantID)
		s.runWarmStep(parent, 20*time.Second, func(ctx context.Context) error {
			_, err := s.ops.GenerateDigestFresh(ctx, tenantID)
			return err
		}, "ops digest", tenantID)
		slog.Info("analytics warm: dashboard+ops refreshed", "tenant_id", tenantID, "duration", time.Since(start).Round(time.Millisecond).String())
	}
}

func (s *Scheduler) warmHealth(parent context.Context) {
	if s.v1 == nil {
		return
	}
	ctx, cancel := context.WithTimeout(parent, 90*time.Second)
	defer cancel()
	start := time.Now()
	if _, err := s.v1.GetHealthFresh(ctx); err != nil {
		slog.Warn("analytics warm: v1 sync health failed", "error", err)
		return
	}
	slog.Info("analytics warm: v1 sync health refreshed", "duration", time.Since(start).Round(time.Millisecond).String())
}

func (s *Scheduler) warmCRM(parent context.Context) {
	if s.crm == nil {
		return
	}
	tenantIDs, err := s.listTenantIDs(parent)
	if err != nil {
		slog.Warn("analytics warm: list tenants for crm failed", "error", err)
		return
	}
	for _, tenantID := range tenantIDs {
		start := time.Now()
		s.runWarmStep(parent, 90*time.Second, func(ctx context.Context) error {
			if err := s.crm.RefreshRFMSnapshots(ctx, tenantID); err != nil {
				return err
			}
			return s.crm.TouchSegmentCaches(ctx, tenantID)
		}, "crm rfm", tenantID)
		slog.Info("analytics warm: crm refreshed", "tenant_id", tenantID, "duration", time.Since(start).Round(time.Millisecond).String())
	}
}

func (s *Scheduler) processBroadcasts(parent context.Context) {
	if s.crm == nil {
		return
	}
	s.runWarmStep(parent, 2*time.Minute, func(ctx context.Context) error {
		return s.crm.ProcessPendingBroadcasts(ctx)
	}, "crm broadcasts", "all")
}

func (s *Scheduler) warmCRMAnalytics(parent context.Context) {
	if s.dashboard == nil {
		return
	}
	tenantIDs, err := s.listTenantIDs(parent)
	if err != nil {
		slog.Warn("analytics warm: list tenants for crm analytics failed", "error", err)
		return
	}
	for _, tenantID := range tenantIDs {
		start := time.Now()
		s.runWarmStep(parent, 3*time.Minute, func(ctx context.Context) error {
			return s.dashboard.RefreshCustomerCohorts(ctx, tenantID)
		}, "crm cohorts", tenantID)
		slog.Info("analytics warm: crm analytics refreshed", "tenant_id", tenantID, "duration", time.Since(start).Round(time.Millisecond).String())
	}
}

func (s *Scheduler) runCRMAutomation(parent context.Context) {
	if s.crm == nil {
		return
	}
	tenantIDs, err := s.listTenantIDs(parent)
	if err != nil {
		slog.Warn("analytics warm: list tenants for crm automation failed", "error", err)
		return
	}
	for _, tenantID := range tenantIDs {
		start := time.Now()
		s.runWarmStep(parent, 4*time.Minute, func(ctx context.Context) error {
			_, err := s.crm.RunLifecycleAutomation(ctx, tenantID)
			return err
		}, "crm automation", tenantID)
		slog.Info("analytics warm: crm automation processed", "tenant_id", tenantID, "duration", time.Since(start).Round(time.Millisecond).String())
	}
}

func (s *Scheduler) listTenantIDs(ctx context.Context) ([]string, error) {
	rows, err := s.db.Query(ctx, `SELECT id::text FROM tenants`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tenantIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		tenantIDs = append(tenantIDs, id)
	}
	return tenantIDs, rows.Err()
}

func (s *Scheduler) runWarmStep(parent context.Context, timeout time.Duration, fn func(context.Context) error, stepName, tenantID string) {
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	if err := fn(ctx); err != nil {
		slog.Warn("analytics warm: "+stepName+" failed", "tenant_id", tenantID, "error", err)
	}
}
