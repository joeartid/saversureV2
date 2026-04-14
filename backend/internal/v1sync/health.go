package v1sync

import (
	"context"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const committedRedeemStatuses = "'CONFIRMED','SHIPPING','SHIPPED','COMPLETED'"

type HealthMetric struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Value int64  `json:"value"`
}

type HealthIssue struct {
	Key      string `json:"key"`
	Label    string `json:"label"`
	Severity string `json:"severity"`
	Count    int64  `json:"count"`
	Note     string `json:"note,omitempty"`
}

type FlowHealth struct {
	Name    string         `json:"name"`
	Status  string         `json:"status"`
	Summary string         `json:"summary"`
	Metrics []HealthMetric `json:"metrics"`
	Issues  []HealthIssue  `json:"issues"`
}

type SourceHealth struct {
	Connected bool   `json:"connected"`
	UserMaxID int64  `json:"user_max_id"`
	ScanMaxID int64  `json:"scan_max_id"`
	RedeemMaxID int64 `json:"redeem_max_id"`
	Error     string `json:"error,omitempty"`
}

type HealthReport struct {
	CheckedAt   string       `json:"checked_at"`
	TenantID    string       `json:"tenant_id"`
	Configured  bool         `json:"configured"`
	SyncEnabled bool         `json:"sync_enabled"`
	Running     bool         `json:"running"`
	Overall     string       `json:"overall"`
	Source      SourceHealth `json:"source"`
	Entities    []SyncStatus `json:"entities"`
	Flows       []FlowHealth `json:"flows"`
}

func (s *Service) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

func (s *Service) GetHealth(ctx context.Context) (*HealthReport, error) {
	return s.getHealth(ctx, false)
}

func (s *Service) GetHealthFresh(ctx context.Context) (*HealthReport, error) {
	return s.getHealth(ctx, true)
}

func (s *Service) getHealth(ctx context.Context, force bool) (*HealthReport, error) {
	s.mu.Lock()
	if !force && s.cachedHealth != nil && time.Since(s.cachedHealthAt) < 30*time.Second {
		cached := s.cachedHealth
		s.mu.Unlock()
		return cached, nil
	}
	s.mu.Unlock()

	if !force {
		var cached HealthReport
		if ok, err := s.cache.Get(ctx, s.tenantID, "ops:v1-sync-health", 90*time.Second, &cached); err == nil && ok {
			s.mu.Lock()
			s.cachedHealth = &cached
			s.cachedHealthAt = time.Now()
			s.mu.Unlock()
			return &cached, nil
		}
	}

	statuses, err := s.GetStatus(ctx)
	if err != nil {
		return nil, err
	}

	report := &HealthReport{
		CheckedAt:   time.Now().Format("2006-01-02 15:04:05"),
		TenantID:    s.tenantID,
		Configured:  s.IsConfigured(),
		SyncEnabled: s.cfg.V1Live.SyncEnabled,
		Running:     s.IsRunning(),
		Overall:     "healthy",
		Entities:    statuses,
	}

	entityStatus := map[string]SyncStatus{}
	for _, st := range statuses {
		entityStatus[st.Entity] = st
	}

	report.Source = s.loadSourceHealth(ctx)

	usersWithV1PointsNoScans, _ := s.scalarInt64(ctx, `
		WITH balances AS (
			SELECT
				u.id,
				COALESCE((
					SELECT balance_after
					FROM point_ledger pl
					WHERE pl.tenant_id = u.tenant_id
					  AND pl.user_id = u.id
					  AND pl.currency = 'point'
					ORDER BY created_at DESC
					LIMIT 1
				), 0) AS latest_balance,
				(
					SELECT COUNT(*)
					FROM scan_history sh
					WHERE sh.tenant_id = u.tenant_id
					  AND sh.user_id = u.id
					  AND COALESCE(sh.scan_type, 'success') = 'success'
				) AS success_scans,
				(
					SELECT COUNT(*)
					FROM point_ledger pl
					WHERE pl.tenant_id = u.tenant_id
					  AND pl.user_id = u.id
					  AND pl.reference_type IN ('v1_live_sync_balance', 'v1_live_sync_reconcile')
				) AS v1_markers
			FROM users u
			WHERE u.tenant_id = $1
			  AND u.v1_user_id IS NOT NULL
		)
		SELECT COUNT(*)
		FROM balances
		WHERE latest_balance > 0
		  AND success_scans = 0
		  AND v1_markers > 0
	`, s.tenantID)

	customerFlow, err := s.buildCustomerFlow(ctx, entityStatus["user"], report.Source)
	if err != nil {
		return nil, err
	}
	report.Flows = append(report.Flows, customerFlow)

	scanFlow, err := s.buildScanFlow(ctx, entityStatus["scan_history"], report.Source, usersWithV1PointsNoScans)
	if err != nil {
		return nil, err
	}
	report.Flows = append(report.Flows, scanFlow)

	redeemFlow, err := s.buildRedeemFlow(ctx, entityStatus["redeem_history"], report.Source)
	if err != nil {
		return nil, err
	}
	report.Flows = append(report.Flows, redeemFlow)

	pointFlow, err := s.buildPointLedgerFlow(ctx, usersWithV1PointsNoScans)
	if err != nil {
		return nil, err
	}
	report.Flows = append(report.Flows, pointFlow)

	for _, flow := range report.Flows {
		report.Overall = worstHealth(report.Overall, flow.Status)
	}
	for _, st := range statuses {
		if st.Status == "failed" {
			report.Overall = worstHealth(report.Overall, "critical")
		}
	}
	if !report.Configured {
		report.Overall = worstHealth(report.Overall, "warning")
	}

	s.mu.Lock()
	s.cachedHealth = report
	s.cachedHealthAt = time.Now()
	s.mu.Unlock()
	_ = s.cache.Put(ctx, s.tenantID, "ops:v1-sync-health", report)

	return report, nil
}

func (s *Service) buildCustomerFlow(ctx context.Context, syncStatus SyncStatus, source SourceHealth) (FlowHealth, error) {
	totalCustomers, err := s.scalarInt64(ctx, `
		SELECT COUNT(*)
		FROM users u
		WHERE u.tenant_id = $1
		  AND EXISTS (
			SELECT 1
			FROM user_roles ur
			WHERE ur.user_id = u.id
			  AND ur.tenant_id = u.tenant_id
			  AND ur.role = 'api_client'
		  )
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}

	v1LinkedCustomers, err := s.scalarInt64(ctx, `
		SELECT COUNT(*)
		FROM users u
		WHERE u.tenant_id = $1
		  AND u.v1_user_id IS NOT NULL
		  AND EXISTS (
			SELECT 1
			FROM user_roles ur
			WHERE ur.user_id = u.id
			  AND ur.tenant_id = u.tenant_id
			  AND ur.role = 'api_client'
		  )
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}

	flow := FlowHealth{
		Name:   "customer",
		Status: "healthy",
		Summary: fmt.Sprintf(
			"ลูกค้าทั้งหมด %d ราย, ผูกกับ V1 แล้ว %d ราย, watermark ผู้ใช้ล่าสุด %d",
			totalCustomers, v1LinkedCustomers, syncStatus.LastSyncedID,
		),
		Metrics: []HealthMetric{
			{Key: "total_customers", Label: "ลูกค้าทั้งหมด", Value: totalCustomers},
			{Key: "v1_linked_customers", Label: "ลูกค้าที่ผูก V1", Value: v1LinkedCustomers},
			{Key: "user_watermark", Label: "User Watermark", Value: syncStatus.LastSyncedID},
		},
	}

	if syncStatus.Status == "failed" {
		flow.Issues = append(flow.Issues, HealthIssue{
			Key:      "user_sync_failed",
			Label:    "user sync failed",
			Severity: "critical",
			Count:    1,
			Note:     strPtrVal(syncStatus.ErrorMessage),
		})
	}
	if source.Connected && source.UserMaxID > syncStatus.LastSyncedID {
		flow.Issues = append(flow.Issues, HealthIssue{
			Key:      "user_watermark_lag",
			Label:    "user watermark lag",
			Severity: "warning",
			Count:    source.UserMaxID - syncStatus.LastSyncedID,
			Note:     fmt.Sprintf("source max user id = %d", source.UserMaxID),
		})
	}
	flow.Status = flowStatus(flow.Issues)
	return flow, nil
}

func (s *Service) buildScanFlow(ctx context.Context, syncStatus SyncStatus, source SourceHealth, usersWithV1PointsNoScans int64) (FlowHealth, error) {
	totalScans, err := s.scalarInt64(ctx, `SELECT COUNT(*) FROM scan_history WHERE tenant_id = $1`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}
	successScans, err := s.scalarInt64(ctx, `
		SELECT COUNT(*)
		FROM scan_history
		WHERE tenant_id = $1
		  AND COALESCE(scan_type, 'success') = 'success'
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}
	v1MappedScans, err := s.scalarInt64(ctx, `
		SELECT COUNT(*)
		FROM migration_entity_maps
		WHERE tenant_id = $1
		  AND entity_type = 'scan_history'
		  AND source_system = 'v1'
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}

	flow := FlowHealth{
		Name:   "scan",
		Status: "healthy",
		Summary: fmt.Sprintf(
			"scan ทั้งหมด %d รายการ, success %d รายการ, map จาก V1 %d รายการ",
			totalScans, successScans, v1MappedScans,
		),
		Metrics: []HealthMetric{
			{Key: "total_scans", Label: "scan ทั้งหมด", Value: totalScans},
			{Key: "success_scans", Label: "success scans", Value: successScans},
			{Key: "v1_mapped_scans", Label: "mapped V1 scans", Value: v1MappedScans},
			{Key: "scan_watermark", Label: "Scan Watermark", Value: syncStatus.LastSyncedID},
		},
	}

	if syncStatus.Status == "failed" {
		flow.Issues = append(flow.Issues, HealthIssue{
			Key:      "scan_sync_failed",
			Label:    "scan sync failed",
			Severity: "critical",
			Count:    1,
			Note:     strPtrVal(syncStatus.ErrorMessage),
		})
	}
	if source.Connected && source.ScanMaxID > syncStatus.LastSyncedID {
		flow.Issues = append(flow.Issues, HealthIssue{
			Key:      "scan_watermark_lag",
			Label:    "scan watermark lag",
			Severity: "warning",
			Count:    source.ScanMaxID - syncStatus.LastSyncedID,
			Note:     fmt.Sprintf("source max scan id = %d", source.ScanMaxID),
		})
	}
	if usersWithV1PointsNoScans > 0 {
		flow.Issues = append(flow.Issues, HealthIssue{
			Key:      "users_with_points_no_scans",
			Label:    "มีแต้มจาก V1 แต่ยังไม่มี success scan",
			Severity: "critical",
			Count:    usersWithV1PointsNoScans,
		})
	}
	flow.Status = flowStatus(flow.Issues)
	return flow, nil
}

func (s *Service) buildRedeemFlow(ctx context.Context, syncStatus SyncStatus, source SourceHealth) (FlowHealth, error) {
	pendingRedeems, err := s.scalarInt64(ctx, `
		SELECT COUNT(*)
		FROM reward_reservations
		WHERE tenant_id = $1
		  AND status = 'PENDING'
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}
	committedRedeems, err := s.scalarInt64(ctx, `
		SELECT COUNT(*)
		FROM reward_reservations
		WHERE tenant_id = $1
		  AND status IN (`+committedRedeemStatuses+`)
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}
	committedPointCost, err := s.scalarInt64(ctx, `
		SELECT COALESCE(SUM(r.point_cost), 0)
		FROM reward_reservations rr
		JOIN rewards r ON r.id = rr.reward_id
		WHERE rr.tenant_id = $1
		  AND rr.status IN (`+committedRedeemStatuses+`)
		  AND COALESCE(r.cost_currency, 'point') = 'point'
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}
	v1CommittedRedeems, err := s.scalarInt64(ctx, `
		SELECT COUNT(*)
		FROM reward_reservations rr
		JOIN migration_entity_maps m
		  ON m.tenant_id = rr.tenant_id
		 AND m.entity_type = 'redeem_history'
		 AND m.source_system = 'v1'
		 AND m.target_id = rr.id::text
		WHERE rr.tenant_id = $1
		  AND rr.status IN (`+committedRedeemStatuses+`)
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}
	v2CommittedPointCost, err := s.scalarInt64(ctx, `
		SELECT COALESCE(SUM(r.point_cost), 0)
		FROM reward_reservations rr
		JOIN rewards r ON r.id = rr.reward_id
		LEFT JOIN migration_entity_maps m
		  ON m.tenant_id = rr.tenant_id
		 AND m.entity_type = 'redeem_history'
		 AND m.source_system = 'v1'
		 AND m.target_id = rr.id::text
		WHERE rr.tenant_id = $1
		  AND rr.status IN (`+committedRedeemStatuses+`)
		  AND COALESCE(r.cost_currency, 'point') = 'point'
		  AND m.target_id IS NULL
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}
	ledgerDebitTotal, err := s.scalarInt64(ctx, `
		SELECT COALESCE(SUM(amount), 0)
		FROM point_ledger
		WHERE tenant_id = $1
		  AND currency = 'point'
		  AND entry_type = 'debit'
		  AND reference_type = 'redemption'
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}

	flow := FlowHealth{
		Name:   "redeem",
		Status: "healthy",
		Summary: fmt.Sprintf(
			"redeem ที่ยืนยันแล้ว %d รายการ, pending %d รายการ, sync watermark ล่าสุด %d",
			committedRedeems, pendingRedeems, syncStatus.LastSyncedID,
		),
		Metrics: []HealthMetric{
			{Key: "pending_redeems", Label: "pending redeems", Value: pendingRedeems},
			{Key: "committed_redeems", Label: "committed redeems", Value: committedRedeems},
			{Key: "v1_committed_redeems", Label: "committed redeems จาก V1", Value: v1CommittedRedeems},
			{Key: "committed_point_cost", Label: "แต้มที่ควรถูกใช้ทั้งหมด", Value: committedPointCost},
			{Key: "v2_committed_point_cost", Label: "แต้มที่ควรถูกใช้จาก V2", Value: v2CommittedPointCost},
			{Key: "ledger_redemption_debits", Label: "ledger debit จาก redemption", Value: ledgerDebitTotal},
			{Key: "redeem_watermark", Label: "Redeem Watermark", Value: syncStatus.LastSyncedID},
		},
	}

	if syncStatus.Status == "failed" {
		flow.Issues = append(flow.Issues, HealthIssue{
			Key:      "redeem_sync_failed",
			Label:    "redeem sync failed",
			Severity: "critical",
			Count:    1,
			Note:     strPtrVal(syncStatus.ErrorMessage),
		})
	}
	if source.Connected && source.RedeemMaxID > syncStatus.LastSyncedID {
		flow.Issues = append(flow.Issues, HealthIssue{
			Key:      "redeem_watermark_lag",
			Label:    "redeem watermark lag",
			Severity: "warning",
			Count:    source.RedeemMaxID - syncStatus.LastSyncedID,
			Note:     fmt.Sprintf("source max redeem id = %d", source.RedeemMaxID),
		})
	}

	diff := int64(math.Abs(float64(v2CommittedPointCost - ledgerDebitTotal)))
	if diff > 0 {
		flow.Issues = append(flow.Issues, HealthIssue{
			Key:      "redeem_ledger_gap",
			Label:    "แต้ม redeem ของ V2 กับ ledger debit ไม่เท่ากัน",
			Severity: "warning",
			Count:    diff,
			Note:     fmt.Sprintf("v2_committed_point_cost=%d, ledger_redemption_debits=%d", v2CommittedPointCost, ledgerDebitTotal),
		})
	}
	flow.Status = flowStatus(flow.Issues)
	return flow, nil
}

func (s *Service) buildPointLedgerFlow(ctx context.Context, usersWithV1PointsNoScans int64) (FlowHealth, error) {
	totalEntries, err := s.scalarInt64(ctx, `
		SELECT COUNT(*)
		FROM point_ledger
		WHERE tenant_id = $1
		  AND currency = 'point'
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}
	v1Snapshots, err := s.scalarInt64(ctx, `
		SELECT COUNT(*)
		FROM point_ledger
		WHERE tenant_id = $1
		  AND currency = 'point'
		  AND reference_type = 'v1_live_sync_balance'
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}
	v1Reconciles, err := s.scalarInt64(ctx, `
		SELECT COUNT(*)
		FROM point_ledger
		WHERE tenant_id = $1
		  AND currency = 'point'
		  AND reference_type = 'v1_live_sync_reconcile'
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}
	negativeBalances, err := s.scalarInt64(ctx, `
		WITH latest AS (
			SELECT DISTINCT ON (user_id)
				user_id,
				balance_after
			FROM point_ledger
			WHERE tenant_id = $1
			  AND currency = 'point'
			ORDER BY user_id, created_at DESC
		)
		SELECT COUNT(*)
		FROM latest
		WHERE balance_after < 0
	`, s.tenantID)
	if err != nil {
		return FlowHealth{}, err
	}

	flow := FlowHealth{
		Name:   "point_ledger",
		Status: "healthy",
		Summary: fmt.Sprintf(
			"ledger point ทั้งหมด %d rows, V1 snapshot %d rows, V1 reconcile %d rows",
			totalEntries, v1Snapshots, v1Reconciles,
		),
		Metrics: []HealthMetric{
			{Key: "total_entries", Label: "point ledger rows", Value: totalEntries},
			{Key: "v1_snapshots", Label: "V1 snapshot rows", Value: v1Snapshots},
			{Key: "v1_reconciles", Label: "V1 reconcile rows", Value: v1Reconciles},
			{Key: "negative_balances", Label: "negative balances", Value: negativeBalances},
		},
	}

	if negativeBalances > 0 {
		flow.Issues = append(flow.Issues, HealthIssue{
			Key:      "negative_balance_users",
			Label:    "พบ user ที่ balance ติดลบ",
			Severity: "critical",
			Count:    negativeBalances,
		})
	}
	if usersWithV1PointsNoScans > 0 {
		flow.Issues = append(flow.Issues, HealthIssue{
			Key:      "v1_points_without_scans",
			Label:    "ยังมี user แต้มจาก V1 แต่ไม่มี success scan",
			Severity: "warning",
			Count:    usersWithV1PointsNoScans,
		})
	}
	flow.Status = flowStatus(flow.Issues)
	return flow, nil
}

func (s *Service) loadSourceHealth(ctx context.Context) SourceHealth {
	result := SourceHealth{}
	if !s.IsConfigured() {
		result.Error = "V1 live DB not configured"
		return result
	}

	v1, err := s.openV1(ctx)
	if err != nil {
		result.Error = err.Error()
		return result
	}
	defer v1.Close()

	result.Connected = true
	result.UserMaxID, _ = scalarInt64Pool(ctx, v1, `SELECT COALESCE(MAX(id), 0) FROM users WHERE deleted_at IS NULL`)
	result.ScanMaxID, _ = scalarInt64Pool(ctx, v1, `SELECT COALESCE(MAX(id), 0) FROM qrcode_scan_history`)
	result.RedeemMaxID, _ = scalarInt64Pool(ctx, v1, `SELECT COALESCE(MAX(id), 0) FROM reward_redeem_histories WHERE deleted_at IS NULL`)
	return result
}

func (s *Service) scalarInt64(ctx context.Context, query string, args ...any) (int64, error) {
	var value int64
	err := s.db.QueryRow(ctx, query, args...).Scan(&value)
	return value, err
}

func scalarInt64Pool(ctx context.Context, db *pgxpool.Pool, query string, args ...any) (int64, error) {
	var value int64
	err := db.QueryRow(ctx, query, args...).Scan(&value)
	return value, err
}

func flowStatus(issues []HealthIssue) string {
	status := "healthy"
	for _, issue := range issues {
		if issue.Count <= 0 {
			continue
		}
		status = worstHealth(status, issue.Severity)
	}
	return status
}

func worstHealth(current, next string) string {
	rank := map[string]int{
		"healthy":  0,
		"info":     0,
		"warning":  1,
		"critical": 2,
	}
	if rank[next] > rank[current] {
		return next
	}
	return current
}

func strPtrVal(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
