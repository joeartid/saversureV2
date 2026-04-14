package dashboard

import (
	"context"
	"fmt"
	"time"
)

type RFMDistributionPoint struct {
	RiskLevel string `json:"risk_level"`
	Count     int64  `json:"count"`
}

type CustomerCohortPoint struct {
	CohortMonth   string  `json:"cohort_month"`
	MonthOffset   int     `json:"month_offset"`
	ActiveUsers   int     `json:"active_users"`
	TotalUsers    int     `json:"total_users"`
	RetentionRate float64 `json:"retention_rate"`
}

type TopReward struct {
	RewardID    string `json:"reward_id"`
	RewardName  string `json:"reward_name"`
	RedeemCount int64  `json:"redeem_count"`
	PointsSpent int64  `json:"points_spent"`
}

func periodStart(period string) (time.Time, bool) {
	now := time.Now()
	switch period {
	case "", "30d":
		return now.AddDate(0, 0, -30), true
	case "7d":
		return now.AddDate(0, 0, -7), true
	case "90d":
		return now.AddDate(0, 0, -90), true
	case "365d":
		return now.AddDate(-1, 0, 0), true
	case "all":
		return time.Time{}, false
	default:
		return now.AddDate(0, 0, -30), true
	}
}

func (s *Service) GetRFMDistribution(ctx context.Context, tenantID string) ([]RFMDistributionPoint, error) {
	var cached []RFMDistributionPoint
	if ok, err := s.cache.Get(ctx, tenantID, "crm:rfm-distribution", 10*time.Minute, &cached); err == nil && ok {
		return cached, nil
	}
	rows, err := s.db.Query(ctx,
		`SELECT COALESCE(risk_level, 'normal') AS risk_level, COUNT(*)::bigint
		 FROM customer_rfm_snapshots
		 WHERE tenant_id = $1
		 GROUP BY COALESCE(risk_level, 'normal')
		 ORDER BY COUNT(*) DESC, risk_level ASC`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("rfm distribution: %w", err)
	}
	defer rows.Close()

	var items []RFMDistributionPoint
	for rows.Next() {
		var item RFMDistributionPoint
		if err := rows.Scan(&item.RiskLevel, &item.Count); err != nil {
			return nil, fmt.Errorf("scan rfm distribution: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rfm distribution rows: %w", err)
	}
	_ = s.cache.Put(ctx, tenantID, "crm:rfm-distribution", items)
	return items, nil
}

func (s *Service) RefreshCustomerCohorts(ctx context.Context, tenantID string) error {
	if _, err := s.db.Exec(ctx, `
		DELETE FROM analytics_customer_cohorts
		WHERE tenant_id = $1
		  AND cohort_month < TO_CHAR(date_trunc('month', CURRENT_DATE) - INTERVAL '12 months', 'YYYY-MM')
	`, tenantID); err != nil {
		return fmt.Errorf("cleanup old customer cohorts: %w", err)
	}

	if _, err := s.db.Exec(ctx, `
		WITH cohort_base AS (
			SELECT
				u.id AS user_id,
				date_trunc('month', u.created_at) AS cohort_start,
				TO_CHAR(date_trunc('month', u.created_at), 'YYYY-MM') AS cohort_month
			FROM users u
			WHERE u.tenant_id = $1
			  AND u.created_at IS NOT NULL
			  AND u.created_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '12 months'
			  AND EXISTS (
					SELECT 1
					FROM user_roles ur
					WHERE ur.user_id = u.id
					  AND ur.tenant_id = u.tenant_id
					  AND ur.role = 'api_client'
			  )
		),
		cohort_totals AS (
			SELECT cohort_month, COUNT(*)::int AS total_users
			FROM cohort_base
			GROUP BY cohort_month
		),
		active_scan_months AS (
			SELECT DISTINCT
				sh.user_id,
				date_trunc('month', sh.scanned_at) AS active_month
			FROM scan_history sh
			WHERE sh.tenant_id = $1
			  AND sh.scanned_at >= date_trunc('month', CURRENT_DATE) - INTERVAL '12 months'
		),
		cohort_offsets AS (
			SELECT
				cb.cohort_month,
				gs.month_offset,
				COUNT(DISTINCT cb.user_id) FILTER (
					WHERE asm.active_month = cb.cohort_start + make_interval(months => gs.month_offset)
				)::int AS active_users
			FROM cohort_base cb
			CROSS JOIN generate_series(0, 12) AS gs(month_offset)
			LEFT JOIN active_scan_months asm ON asm.user_id = cb.user_id
			GROUP BY cb.cohort_month, gs.month_offset
		)
		INSERT INTO analytics_customer_cohorts (
			tenant_id, cohort_month, month_offset, active_users, total_users, refreshed_at
		)
		SELECT
			$1,
			co.cohort_month,
			co.month_offset,
			co.active_users,
			COALESCE(ct.total_users, 0),
			NOW()
		FROM cohort_offsets co
		LEFT JOIN cohort_totals ct ON ct.cohort_month = co.cohort_month
		ON CONFLICT (tenant_id, cohort_month, month_offset)
		DO UPDATE SET
			active_users = EXCLUDED.active_users,
			total_users = EXCLUDED.total_users,
			refreshed_at = NOW()
	`, tenantID); err != nil {
		return fmt.Errorf("refresh customer cohorts: %w", err)
	}
	return nil
}

func (s *Service) GetCustomerCohorts(ctx context.Context, tenantID string) ([]CustomerCohortPoint, error) {
	rows, err := s.db.Query(ctx, `
		SELECT cohort_month, month_offset, active_users, total_users
		FROM analytics_customer_cohorts
		WHERE tenant_id = $1
		  AND refreshed_at >= NOW() - INTERVAL '36 hours'
		ORDER BY cohort_month DESC, month_offset ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list customer cohorts: %w", err)
	}
	defer rows.Close()

	var items []CustomerCohortPoint
	for rows.Next() {
		var item CustomerCohortPoint
		if err := rows.Scan(&item.CohortMonth, &item.MonthOffset, &item.ActiveUsers, &item.TotalUsers); err != nil {
			return nil, fmt.Errorf("scan customer cohort: %w", err)
		}
		if item.TotalUsers > 0 {
			item.RetentionRate = (float64(item.ActiveUsers) / float64(item.TotalUsers)) * 100
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("customer cohorts rows: %w", err)
	}
	if len(items) > 0 {
		return items, nil
	}
	if err := s.RefreshCustomerCohorts(ctx, tenantID); err != nil {
		return nil, err
	}

	rows, err = s.db.Query(ctx, `
		SELECT cohort_month, month_offset, active_users, total_users
		FROM analytics_customer_cohorts
		WHERE tenant_id = $1
		ORDER BY cohort_month DESC, month_offset ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("reload customer cohorts: %w", err)
	}
	defer rows.Close()

	items = nil
	for rows.Next() {
		var item CustomerCohortPoint
		if err := rows.Scan(&item.CohortMonth, &item.MonthOffset, &item.ActiveUsers, &item.TotalUsers); err != nil {
			return nil, fmt.Errorf("scan customer cohort reload: %w", err)
		}
		if item.TotalUsers > 0 {
			item.RetentionRate = (float64(item.ActiveUsers) / float64(item.TotalUsers)) * 100
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) GetTopProductsByPeriod(ctx context.Context, tenantID, period string, limit int) ([]TopProduct, error) {
	if limit <= 0 {
		limit = 10
	}
	start, hasCutoff := periodStart(period)

	query := `
		SELECT
			COALESCE(rp.id::text, bp.id::text, lp.id::text, 'legacy:' || COALESCE(sh.legacy_product_v1_id::text, lower(COALESCE(sh.legacy_product_name, 'unknown')))) AS product_id,
			COALESCE(rp.name, bp.name, lp.name, sh.legacy_product_name, 'Unknown Product') AS product_name,
			COUNT(*)::bigint AS scan_count,
			COUNT(DISTINCT sh.batch_id)::bigint AS batch_count,
			COUNT(DISTINCT sh.code_id)::bigint AS total_codes
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
		WHERE sh.tenant_id = $1`
	args := []any{tenantID}
	if hasCutoff {
		query += ` AND sh.scanned_at >= $2`
		args = append(args, start)
	}
	query += `
		  AND COALESCE(rp.name, bp.name, lp.name, sh.legacy_product_name) IS NOT NULL
		GROUP BY 1, 2
		ORDER BY scan_count DESC, product_name ASC
		LIMIT $` + fmt.Sprintf("%d", len(args)+1)
	args = append(args, limit)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("top products by period: %w", err)
	}
	defer rows.Close()

	var items []TopProduct
	for rows.Next() {
		var item TopProduct
		if err := rows.Scan(&item.ProductID, &item.ProductName, &item.ScanCount, &item.BatchCount, &item.TotalCodes); err != nil {
			return nil, fmt.Errorf("scan top product by period: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) GetTopRewards(ctx context.Context, tenantID, period string, limit int) ([]TopReward, error) {
	if limit <= 0 {
		limit = 10
	}
	start, hasCutoff := periodStart(period)
	query := `
		SELECT
			rr.reward_id::text,
			COALESCE(r.name, 'Unknown Reward') AS reward_name,
			COUNT(*)::bigint AS redeem_count,
			COALESCE(SUM(r.points_cost), 0)::bigint AS points_spent
		FROM reward_reservations rr
		LEFT JOIN rewards r ON r.id = rr.reward_id
		WHERE rr.tenant_id = $1
		  AND rr.status IN (` + committedRedemptionStatuses + `)`
	args := []any{tenantID}
	if hasCutoff {
		query += ` AND rr.created_at >= $2`
		args = append(args, start)
	}
	query += `
		GROUP BY rr.reward_id, r.name
		ORDER BY redeem_count DESC, reward_name ASC
		LIMIT $` + fmt.Sprintf("%d", len(args)+1)
	args = append(args, limit)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("top rewards: %w", err)
	}
	defer rows.Close()

	var items []TopReward
	for rows.Next() {
		var item TopReward
		if err := rows.Scan(&item.RewardID, &item.RewardName, &item.RedeemCount, &item.PointsSpent); err != nil {
			return nil, fmt.Errorf("scan top reward: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
