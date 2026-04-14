package dashboard

import (
	"context"
	"fmt"
	"time"
)

type ProductAffinityItem struct {
	LeftProductID   string  `json:"left_product_id"`
	LeftProductName string  `json:"left_product_name"`
	RightProductID  string  `json:"right_product_id"`
	RightProductName string `json:"right_product_name"`
	SharedUsers     int     `json:"shared_users"`
	SupportScore    float64 `json:"support_score"`
	RefreshedAt     string  `json:"refreshed_at"`
}

type CLVCustomer struct {
	UserID        string  `json:"user_id"`
	DisplayName   *string `json:"display_name"`
	FirstName     *string `json:"first_name"`
	LastName      *string `json:"last_name"`
	Email         *string `json:"email"`
	Phone         *string `json:"phone"`
	RiskLevel     string  `json:"risk_level"`
	EstimatedCLV  float64 `json:"estimated_clv"`
	PointBalance  int     `json:"point_balance"`
	ScanCountAll  int     `json:"scan_count_all"`
	LastScanAt    *string `json:"last_scan_at"`
}

type CLVOverview struct {
	TrackedCustomers    int64         `json:"tracked_customers"`
	TotalEstimatedCLV   float64       `json:"total_estimated_clv"`
	AverageEstimatedCLV float64       `json:"average_estimated_clv"`
	HighValueCustomers  int64         `json:"high_value_customers"`
	TopCustomers        []CLVCustomer `json:"top_customers"`
}

type CampaignROIItem struct {
	CampaignID      string  `json:"campaign_id"`
	CampaignName    string  `json:"campaign_name"`
	TargetType      *string `json:"target_type"`
	RecipientCount  int     `json:"recipient_count"`
	ScansBefore     int     `json:"scans_before"`
	ScansAfter      int     `json:"scans_after"`
	RedeemsBefore   int     `json:"redeems_before"`
	RedeemsAfter    int     `json:"redeems_after"`
	ScanUpliftPct   float64 `json:"scan_uplift_pct"`
	RedeemUpliftPct float64 `json:"redeem_uplift_pct"`
	MeasuredAt      *string `json:"measured_at"`
	RefreshedAt     string  `json:"refreshed_at"`
}

func (s *Service) RefreshProductAffinities(ctx context.Context, tenantID string) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM analytics_product_affinities WHERE tenant_id = $1`, tenantID); err != nil {
		return fmt.Errorf("clear product affinities: %w", err)
	}

	if _, err := s.db.Exec(ctx, `
		WITH user_products AS (
			SELECT DISTINCT
				sh.user_id,
				COALESCE(rp.id::text, bp.id::text, lp.id::text, 'legacy:' || COALESCE(sh.legacy_product_v1_id::text, lower(COALESCE(sh.legacy_product_name, 'unknown')))) AS product_id,
				COALESCE(rp.name, bp.name, lp.name, sh.legacy_product_name, 'Unknown Product') AS product_name
			FROM scan_history sh
			LEFT JOIN codes c ON c.id = sh.code_id AND c.tenant_id = sh.tenant_id
			LEFT JOIN batches b ON b.id = sh.batch_id
			LEFT JOIN products bp ON bp.id = b.product_id
			LEFT JOIN rolls sr ON sr.batch_id = sh.batch_id AND c.serial_number BETWEEN sr.serial_start AND sr.serial_end
			LEFT JOIN products rp ON rp.id = sr.product_id
			LEFT JOIN migration_entity_maps lpm ON lpm.tenant_id = sh.tenant_id
				AND lpm.entity_type = 'product'
				AND lpm.source_system = 'v1'
				AND lpm.source_id = sh.legacy_product_v1_id::text
			LEFT JOIN products lp ON lp.id::text = lpm.target_id
			WHERE sh.tenant_id = $1
			  AND sh.user_id IS NOT NULL
			  AND sh.scanned_at >= NOW() - INTERVAL '180 days'
			  AND COALESCE(sh.scan_type, 'success') = 'success'
			  AND COALESCE(rp.name, bp.name, lp.name, sh.legacy_product_name) IS NOT NULL
		),
		product_totals AS (
			SELECT product_id, COUNT(*)::numeric AS user_count
			FROM user_products
			GROUP BY product_id
		),
		pairs AS (
			SELECT
				up1.product_id AS left_product_id,
				up1.product_name AS left_product_name,
				up2.product_id AS right_product_id,
				up2.product_name AS right_product_name,
				COUNT(*)::int AS shared_users
			FROM user_products up1
			JOIN user_products up2
			  ON up1.user_id = up2.user_id
			 AND up1.product_id < up2.product_id
			GROUP BY up1.product_id, up1.product_name, up2.product_id, up2.product_name
			HAVING COUNT(*) >= 2
		)
		INSERT INTO analytics_product_affinities (
			tenant_id, left_product_id, left_product_name, right_product_id, right_product_name, shared_users, support_score, refreshed_at
		)
		SELECT
			$1,
			p.left_product_id,
			p.left_product_name,
			p.right_product_id,
			p.right_product_name,
			p.shared_users,
			ROUND((p.shared_users::numeric / GREATEST(LEAST(pt1.user_count, pt2.user_count), 1))::numeric, 4),
			NOW()
		FROM pairs p
		JOIN product_totals pt1 ON pt1.product_id = p.left_product_id
		JOIN product_totals pt2 ON pt2.product_id = p.right_product_id
		ORDER BY p.shared_users DESC, p.left_product_name ASC, p.right_product_name ASC
		LIMIT 250
	`, tenantID); err != nil {
		return fmt.Errorf("refresh product affinities: %w", err)
	}
	return nil
}

func (s *Service) GetProductAffinities(ctx context.Context, tenantID string, limit int) ([]ProductAffinityItem, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := s.db.Query(ctx, `
		SELECT left_product_id, left_product_name, right_product_id, right_product_name, shared_users, support_score, refreshed_at::text
		FROM analytics_product_affinities
		WHERE tenant_id = $1
		  AND refreshed_at >= NOW() - INTERVAL '36 hours'
		ORDER BY shared_users DESC, support_score DESC, left_product_name ASC, right_product_name ASC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("list product affinities: %w", err)
	}
	defer rows.Close()

	var items []ProductAffinityItem
	for rows.Next() {
		var item ProductAffinityItem
		if err := rows.Scan(&item.LeftProductID, &item.LeftProductName, &item.RightProductID, &item.RightProductName, &item.SharedUsers, &item.SupportScore, &item.RefreshedAt); err != nil {
			return nil, fmt.Errorf("scan product affinity: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("product affinities rows: %w", err)
	}
	if len(items) > 0 {
		return items, nil
	}
	if err := s.RefreshProductAffinities(ctx, tenantID); err != nil {
		return nil, err
	}
	return s.GetProductAffinities(ctx, tenantID, limit)
}

func (s *Service) GetCLVOverview(ctx context.Context, tenantID string, limit int) (*CLVOverview, error) {
	if limit <= 0 {
		limit = 10
	}
	result := &CLVOverview{}
	if err := s.db.QueryRow(ctx, `
		SELECT
			COUNT(*)::bigint,
			COALESCE(SUM(estimated_clv), 0)::float8,
			COALESCE(AVG(estimated_clv), 0)::float8,
			COUNT(*) FILTER (WHERE estimated_clv >= 100)::bigint
		FROM customer_rfm_snapshots
		WHERE tenant_id = $1
	`, tenantID).Scan(&result.TrackedCustomers, &result.TotalEstimatedCLV, &result.AverageEstimatedCLV, &result.HighValueCustomers); err != nil {
		return nil, fmt.Errorf("clv overview: %w", err)
	}

	rows, err := s.db.Query(ctx, `
		SELECT
			r.user_id::text,
			u.display_name,
			u.first_name,
			u.last_name,
			u.email,
			u.phone,
			COALESCE(r.risk_level, 'normal'),
			COALESCE(r.estimated_clv, 0)::float8,
			COALESCE(r.point_balance, 0),
			COALESCE(r.scan_count_all, 0),
			r.last_scan_at::text
		FROM customer_rfm_snapshots r
		JOIN users u ON u.id = r.user_id AND u.tenant_id = r.tenant_id
		WHERE r.tenant_id = $1
		ORDER BY r.estimated_clv DESC, r.point_balance DESC, r.scan_count_all DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("clv top customers: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var item CLVCustomer
		if err := rows.Scan(&item.UserID, &item.DisplayName, &item.FirstName, &item.LastName, &item.Email, &item.Phone, &item.RiskLevel, &item.EstimatedCLV, &item.PointBalance, &item.ScanCountAll, &item.LastScanAt); err != nil {
			return nil, fmt.Errorf("scan clv customer: %w", err)
		}
		result.TopCustomers = append(result.TopCustomers, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("clv customers rows: %w", err)
	}
	return result, nil
}

func (s *Service) RefreshCampaignROI(ctx context.Context, tenantID string) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM analytics_campaign_roi WHERE tenant_id = $1`, tenantID); err != nil {
		return fmt.Errorf("clear campaign roi: %w", err)
	}

	if _, err := s.db.Exec(ctx, `
		WITH campaign_base AS (
			SELECT
				bc.id,
				bc.name,
				bc.target_type,
				COALESCE(bc.started_at, bc.completed_at, bc.created_at) AS measured_at
			FROM broadcast_campaigns bc
			WHERE bc.tenant_id = $1
			  AND bc.status IN ('sent', 'partial_failed')
			  AND COALESCE(bc.started_at, bc.completed_at, bc.created_at) >= NOW() - INTERVAL '180 days'
		),
		recipient_list AS (
			SELECT DISTINCT
				cb.id AS campaign_id,
				cb.name AS campaign_name,
				cb.target_type,
				cb.measured_at,
				bdl.user_id
			FROM campaign_base cb
			JOIN broadcast_delivery_logs bdl ON bdl.broadcast_campaign_id = cb.id
			WHERE bdl.user_id IS NOT NULL
			  AND bdl.status = 'sent'
		),
		recipient_counts AS (
			SELECT campaign_id, COUNT(*)::int AS recipient_count
			FROM recipient_list
			GROUP BY campaign_id
		),
		scan_counts AS (
			SELECT
				rl.campaign_id,
				COUNT(*) FILTER (
					WHERE sh.scanned_at >= rl.measured_at - INTERVAL '7 days'
					  AND sh.scanned_at < rl.measured_at
				)::int AS scans_before,
				COUNT(*) FILTER (
					WHERE sh.scanned_at >= rl.measured_at
					  AND sh.scanned_at < rl.measured_at + INTERVAL '7 days'
				)::int AS scans_after
			FROM recipient_list rl
			LEFT JOIN scan_history sh ON sh.tenant_id = $1
				AND sh.user_id = rl.user_id
				AND COALESCE(sh.scan_type, 'success') = 'success'
				AND sh.scanned_at >= rl.measured_at - INTERVAL '7 days'
				AND sh.scanned_at < rl.measured_at + INTERVAL '7 days'
			GROUP BY rl.campaign_id
		),
		redeem_counts AS (
			SELECT
				rl.campaign_id,
				COUNT(*) FILTER (
					WHERE rr.created_at >= rl.measured_at - INTERVAL '7 days'
					  AND rr.created_at < rl.measured_at
				)::int AS redeems_before,
				COUNT(*) FILTER (
					WHERE rr.created_at >= rl.measured_at
					  AND rr.created_at < rl.measured_at + INTERVAL '7 days'
				)::int AS redeems_after
			FROM recipient_list rl
			LEFT JOIN reward_reservations rr ON rr.tenant_id = $1
				AND rr.user_id = rl.user_id
				AND rr.status IN (` + committedRedemptionStatuses + `)
				AND rr.created_at >= rl.measured_at - INTERVAL '7 days'
				AND rr.created_at < rl.measured_at + INTERVAL '7 days'
			GROUP BY rl.campaign_id
		)
		INSERT INTO analytics_campaign_roi (
			tenant_id, campaign_id, campaign_name, target_type, recipient_count,
			scans_before, scans_after, redeems_before, redeems_after,
			scan_uplift_pct, redeem_uplift_pct, measured_at, refreshed_at
		)
		SELECT
			$1,
			cb.id,
			cb.name,
			cb.target_type,
			COALESCE(rc.recipient_count, 0),
			COALESCE(sc.scans_before, 0),
			COALESCE(sc.scans_after, 0),
			COALESCE(rd.redeems_before, 0),
			COALESCE(rd.redeems_after, 0),
			CASE
				WHEN COALESCE(sc.scans_before, 0) > 0
					THEN ROUND((((COALESCE(sc.scans_after, 0) - COALESCE(sc.scans_before, 0))::numeric / sc.scans_before) * 100)::numeric, 2)
				WHEN COALESCE(sc.scans_after, 0) > 0 THEN 100
				ELSE 0
			END,
			CASE
				WHEN COALESCE(rd.redeems_before, 0) > 0
					THEN ROUND((((COALESCE(rd.redeems_after, 0) - COALESCE(rd.redeems_before, 0))::numeric / rd.redeems_before) * 100)::numeric, 2)
				WHEN COALESCE(rd.redeems_after, 0) > 0 THEN 100
				ELSE 0
			END,
			cb.measured_at,
			NOW()
		FROM campaign_base cb
		LEFT JOIN recipient_counts rc ON rc.campaign_id = cb.id
		LEFT JOIN scan_counts sc ON sc.campaign_id = cb.id
		LEFT JOIN redeem_counts rd ON rd.campaign_id = cb.id
	`, tenantID); err != nil {
		return fmt.Errorf("refresh campaign roi: %w", err)
	}
	return nil
}

func (s *Service) GetCampaignROI(ctx context.Context, tenantID string, limit int) ([]CampaignROIItem, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := s.db.Query(ctx, `
		SELECT campaign_id::text, campaign_name, target_type, recipient_count,
		       scans_before, scans_after, redeems_before, redeems_after,
		       scan_uplift_pct::float8, redeem_uplift_pct::float8, measured_at::text, refreshed_at::text
		FROM analytics_campaign_roi
		WHERE tenant_id = $1
		  AND refreshed_at >= NOW() - INTERVAL '36 hours'
		ORDER BY measured_at DESC NULLS LAST, refreshed_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("list campaign roi: %w", err)
	}
	defer rows.Close()

	var items []CampaignROIItem
	for rows.Next() {
		var item CampaignROIItem
		if err := rows.Scan(&item.CampaignID, &item.CampaignName, &item.TargetType, &item.RecipientCount, &item.ScansBefore, &item.ScansAfter, &item.RedeemsBefore, &item.RedeemsAfter, &item.ScanUpliftPct, &item.RedeemUpliftPct, &item.MeasuredAt, &item.RefreshedAt); err != nil {
			return nil, fmt.Errorf("scan campaign roi: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("campaign roi rows: %w", err)
	}
	if len(items) > 0 {
		return items, nil
	}
	if err := s.RefreshCampaignROI(ctx, tenantID); err != nil {
		return nil, err
	}
	return s.GetCampaignROI(ctx, tenantID, limit)
}

func (s *Service) RefreshAdvancedCRMAnalytics(ctx context.Context, tenantID string) error {
	if err := s.RefreshProductAffinities(ctx, tenantID); err != nil {
		return err
	}
	if err := s.RefreshCampaignROI(ctx, tenantID); err != nil {
		return err
	}
	return nil
}

func staleWithin(t *string, maxAge time.Duration) bool {
	if t == nil || *t == "" {
		return false
	}
	parsed, err := time.Parse(time.RFC3339Nano, *t)
	if err != nil {
		parsed, err = time.Parse(time.RFC3339, *t)
		if err != nil {
			return false
		}
	}
	return time.Since(parsed) <= maxAge
}
