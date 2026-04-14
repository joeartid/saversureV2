package dashboard

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"saversure/internal/analyticscache"
)

type Service struct {
	db    *pgxpool.Pool
	cache *analyticscache.Store
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{
		db:    db,
		cache: analyticscache.NewStore(db),
	}
}

type Summary struct {
	Campaigns     int64           `json:"campaigns"`
	CampaignStats map[string]int64 `json:"campaign_stats"`
	Batches       int64           `json:"batches"`
	TotalCodes    int64           `json:"total_codes"`
	Rewards       int64           `json:"rewards"`
	ScansToday    int64           `json:"scans_today"`
	Scans7d       int64           `json:"scans_7d"`
	Scans30d      int64           `json:"scans_30d"`
	PointsIssued  int64           `json:"points_issued"`
	PointsRedeemed int64          `json:"points_redeemed"`
	UsersTotal    int64           `json:"users_total"`
}

type ScanChartPoint struct {
	Label string `json:"label"`
	Count int64  `json:"count"`
}

const committedRedemptionStatuses = "'CONFIRMED','SHIPPING','SHIPPED','COMPLETED'"

func (s *Service) GetSummary(ctx context.Context, tenantID string) (*Summary, error) {
	var cached Summary
	if ok, err := s.cache.Get(ctx, tenantID, "dashboard:summary", time.Minute, &cached); err == nil && ok {
		return &cached, nil
	}
	return s.GetSummaryFresh(ctx, tenantID)
}

func (s *Service) GetSummaryFresh(ctx context.Context, tenantID string) (*Summary, error) {
	sum, err := s.computeSummary(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	_ = s.cache.Put(ctx, tenantID, "dashboard:summary", sum)
	return sum, nil
}

func (s *Service) computeSummary(ctx context.Context, tenantID string) (*Summary, error) {
	sum := &Summary{
		CampaignStats: make(map[string]int64),
	}

	// Total campaigns
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM campaigns WHERE tenant_id = $1`, tenantID,
	).Scan(&sum.Campaigns)

	// Campaign stats by status
	rows, err := s.db.Query(ctx,
		`SELECT status, COUNT(*) FROM campaigns WHERE tenant_id = $1 GROUP BY status`, tenantID)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var status string
			var cnt int64
			if rows.Scan(&status, &cnt) == nil {
				sum.CampaignStats[status] = cnt
			}
		}
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("campaign stats rows: %w", err)
		}
	}

	// Total batches
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM batches WHERE tenant_id = $1`, tenantID,
	).Scan(&sum.Batches)

	// Total codes (sum of serial ranges)
	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(serial_end - serial_start + 1), 0) FROM batches WHERE tenant_id = $1`, tenantID,
	).Scan(&sum.TotalCodes)

	// Total rewards
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM rewards WHERE tenant_id = $1`, tenantID,
	).Scan(&sum.Rewards)

	if today, sevenDays, thirtyDays, ok, err := s.loadSummaryScanCounts(ctx, tenantID); err == nil && ok {
		sum.ScansToday = today
		sum.Scans7d = sevenDays
		sum.Scans30d = thirtyDays
	} else {
		// Scans today (all scan events, including V1 live sync rows)
		_ = s.db.QueryRow(ctx,
			`SELECT COUNT(*) FROM scan_history WHERE tenant_id = $1 AND scanned_at >= CURRENT_DATE`, tenantID,
		).Scan(&sum.ScansToday)

		// Scans 7d
		_ = s.db.QueryRow(ctx,
			`SELECT COUNT(*) FROM scan_history WHERE tenant_id = $1 AND scanned_at >= CURRENT_DATE - INTERVAL '7 days'`, tenantID,
		).Scan(&sum.Scans7d)

		// Scans 30d
		_ = s.db.QueryRow(ctx,
			`SELECT COUNT(*) FROM scan_history WHERE tenant_id = $1 AND scanned_at >= CURRENT_DATE - INTERVAL '30 days'`, tenantID,
		).Scan(&sum.Scans30d)
	}

	// Points issued (total credits)
	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM point_ledger WHERE tenant_id = $1 AND entry_type = 'credit'`, tenantID,
	).Scan(&sum.PointsIssued)

	// Points redeemed (total debits)
	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM point_ledger WHERE tenant_id = $1 AND entry_type = 'debit'`, tenantID,
	).Scan(&sum.PointsRedeemed)

	// Total users (consumers only)
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM users u WHERE u.tenant_id = $1
		   AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.tenant_id = u.tenant_id AND ur.role = 'api_client')`,
		tenantID,
	).Scan(&sum.UsersTotal)

	return sum, nil
}

func (s *Service) GetScanChart(ctx context.Context, tenantID, groupBy string, days int) ([]ScanChartPoint, error) {
	cacheKey := fmt.Sprintf("dashboard:scan-chart:%s:%d", groupBy, days)
	var cached []ScanChartPoint
	if ok, err := s.cache.Get(ctx, tenantID, cacheKey, 2*time.Minute, &cached); err == nil && ok {
		return cached, nil
	}
	return s.GetScanChartFresh(ctx, tenantID, groupBy, days)
}

func (s *Service) GetScanChartFresh(ctx context.Context, tenantID, groupBy string, days int) ([]ScanChartPoint, error) {
	cacheKey := fmt.Sprintf("dashboard:scan-chart:%s:%d", groupBy, days)
	points, err := s.computeScanChart(ctx, tenantID, groupBy, days)
	if err != nil {
		return nil, err
	}
	_ = s.cache.Put(ctx, tenantID, cacheKey, points)
	return points, nil
}

func (s *Service) computeScanChart(ctx context.Context, tenantID, groupBy string, days int) ([]ScanChartPoint, error) {
	if points, ok, err := s.loadScanChartFromRollups(ctx, tenantID, groupBy); err == nil && ok {
		return points, nil
	}

	var dateExpr, labelExpr string
	switch groupBy {
	case "week":
		dateExpr = "date_trunc('week', sh.scanned_at)"
		labelExpr = "TO_CHAR(date_trunc('week', sh.scanned_at), 'YYYY-\"W\"IW')"
	case "month":
		dateExpr = "date_trunc('month', sh.scanned_at)"
		labelExpr = "TO_CHAR(date_trunc('month', sh.scanned_at), 'YYYY-MM')"
	default:
		dateExpr = "DATE(sh.scanned_at)"
		labelExpr = "TO_CHAR(DATE(sh.scanned_at), 'MM/DD')"
	}

	query := fmt.Sprintf(
		`SELECT %s AS label, COUNT(*) AS cnt
		 FROM scan_history sh
		 WHERE sh.tenant_id = $1 AND sh.scanned_at >= CURRENT_DATE - INTERVAL '%d days'
		 GROUP BY %s
		 ORDER BY %s`,
		labelExpr, days, dateExpr, dateExpr,
	)

	rows, err := s.db.Query(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("scan chart query: %w", err)
	}
	defer rows.Close()

	var points []ScanChartPoint
	for rows.Next() {
		var p ScanChartPoint
		if err := rows.Scan(&p.Label, &p.Count); err != nil {
			return nil, fmt.Errorf("scan chart row: %w", err)
		}
		points = append(points, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("scan chart rows: %w", err)
	}
	return points, nil
}

type TopProduct struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	ScanCount   int64  `json:"scan_count"`
	BatchCount  int64  `json:"batch_count"`
	TotalCodes  int64  `json:"total_codes"`
}

func (s *Service) GetTopProducts(ctx context.Context, tenantID string, limit int) ([]TopProduct, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := s.db.Query(ctx,
		`SELECT p.id, p.name,
		        COALESCE((
		          SELECT COUNT(*)
		          FROM scan_history sh
		          LEFT JOIN codes c ON c.id = sh.code_id AND c.tenant_id = sh.tenant_id
		          LEFT JOIN batches sb ON sb.id = sh.batch_id
		          LEFT JOIN rolls sr ON sr.batch_id = sh.batch_id AND c.serial_number BETWEEN sr.serial_start AND sr.serial_end
		          LEFT JOIN products srp ON srp.id = sr.product_id
		          WHERE sh.tenant_id = $1
		            AND COALESCE(srp.id, sb.product_id) = p.id
		        ), 0) AS scan_count,
		        COUNT(b.id) AS batch_count,
		        COALESCE(SUM(b.serial_end - b.serial_start + 1), 0) AS total_codes
		 FROM products p
		 LEFT JOIN batches b ON b.product_id = p.id
		 WHERE p.tenant_id = $1 AND p.status = 'active'
		 GROUP BY p.id, p.name
		 ORDER BY scan_count DESC
		 LIMIT $2`,
		tenantID, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("top products: %w", err)
	}
	defer rows.Close()

	var products []TopProduct
	for rows.Next() {
		var p TopProduct
		if err := rows.Scan(&p.ProductID, &p.ProductName, &p.ScanCount, &p.BatchCount, &p.TotalCodes); err != nil {
			return nil, fmt.Errorf("scan top product: %w", err)
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("top products rows: %w", err)
	}
	return products, nil
}

// FunnelData holds conversion funnel metrics.
type FunnelData struct {
	TotalGenerated int64   `json:"total_generated"`
	TotalScanned   int64   `json:"total_scanned"`
	TotalRedeemed  int64   `json:"total_redeemed"`
	ScanRate       float64 `json:"scan_rate"`
	RedeemRate     float64 `json:"redeem_rate"`
}

// GetConversionFunnel returns funnel data: total codes generated → scanned → redeemed.
func (s *Service) GetConversionFunnel(ctx context.Context, tenantID string) (*FunnelData, error) {
	var cached FunnelData
	if ok, err := s.cache.Get(ctx, tenantID, "dashboard:funnel", 2*time.Minute, &cached); err == nil && ok {
		return &cached, nil
	}
	return s.GetConversionFunnelFresh(ctx, tenantID)
}

func (s *Service) GetConversionFunnelFresh(ctx context.Context, tenantID string) (*FunnelData, error) {
	funnel, err := s.computeConversionFunnel(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	_ = s.cache.Put(ctx, tenantID, "dashboard:funnel", funnel)
	return funnel, nil
}

func (s *Service) computeConversionFunnel(ctx context.Context, tenantID string) (*FunnelData, error) {
	f := &FunnelData{}

	// total_generated = SUM(serial_end - serial_start + 1) from batches
	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(serial_end - serial_start + 1), 0) FROM batches WHERE tenant_id = $1`, tenantID,
	).Scan(&f.TotalGenerated)

	if scanned, ok, err := s.loadAllTimeSuccessScans(ctx, tenantID); err == nil && ok {
		f.TotalScanned = scanned
	} else {
		// total_scanned = count success scans from scan_history (covers V1 + V2)
		_ = s.db.QueryRow(ctx,
			`SELECT COUNT(*)
			   FROM scan_history sh
			  WHERE sh.tenant_id = $1
			    AND COALESCE(sh.scan_type, 'success') = 'success'`,
			tenantID,
		).Scan(&f.TotalScanned)
	}

	// total_redeemed = COUNT(*) from reward_reservations where status = 'CONFIRMED'
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM reward_reservations WHERE tenant_id = $1 AND status IN (`+committedRedemptionStatuses+`)`, tenantID,
	).Scan(&f.TotalRedeemed)

	// scan_rate = scanned/generated * 100
	if f.TotalGenerated > 0 {
		f.ScanRate = float64(f.TotalScanned) / float64(f.TotalGenerated) * 100
	}

	// redeem_rate = redeemed/scanned * 100 (or 0 if no scans)
	if f.TotalScanned > 0 {
		f.RedeemRate = float64(f.TotalRedeemed) / float64(f.TotalScanned) * 100
	}

	return f, nil
}

// GeoPoint holds province-level scan count for heatmap.
type GeoPoint struct {
	Province string `json:"province"`
	Count    int64  `json:"count"`
}

// GetGeoHeatmap returns province-level scan aggregation for heatmap visualization.
func (s *Service) GetGeoHeatmap(ctx context.Context, tenantID string) ([]GeoPoint, error) {
	rows, err := s.db.Query(ctx,
		`SELECT province, COUNT(*) AS cnt
		 FROM scan_history
		 WHERE tenant_id = $1 AND province IS NOT NULL
		 GROUP BY province
		 ORDER BY cnt DESC`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("geo heatmap: %w", err)
	}
	defer rows.Close()

	var points []GeoPoint
	for rows.Next() {
		var p GeoPoint
		if err := rows.Scan(&p.Province, &p.Count); err != nil {
			return nil, fmt.Errorf("geo heatmap row: %w", err)
		}
		points = append(points, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("geo heatmap rows: %w", err)
	}
	return points, nil
}

// Activity holds a single scan or redemption activity for recent feed.
type Activity struct {
	ID        string `json:"id"` // unique key for list rendering
	Type      string `json:"type"` // "scan" or "redeem"
	UserName  string `json:"user_name"`
	Detail    string `json:"detail"`
	CreatedAt string `json:"created_at"`
}

// GetRecentActivity returns the last N activities (scans + redemptions combined, sorted by time).
func (s *Service) GetRecentActivity(ctx context.Context, tenantID string, limit int) ([]Activity, error) {
	if limit <= 0 {
		limit = 20
	}
	cacheKey := fmt.Sprintf("dashboard:recent-activity:%d", limit)
	var cached []Activity
	if ok, err := s.cache.Get(ctx, tenantID, cacheKey, 30*time.Second, &cached); err == nil && ok {
		return cached, nil
	}
	return s.GetRecentActivityFresh(ctx, tenantID, limit)
}

func (s *Service) GetRecentActivityFresh(ctx context.Context, tenantID string, limit int) ([]Activity, error) {
	if limit <= 0 {
		limit = 20
	}
	cacheKey := fmt.Sprintf("dashboard:recent-activity:%d", limit)
	activities, err := s.computeRecentActivity(ctx, tenantID, limit)
	if err != nil {
		return nil, err
	}
	_ = s.cache.Put(ctx, tenantID, cacheKey, activities)
	return activities, nil
}

func (s *Service) computeRecentActivity(ctx context.Context, tenantID string, limit int) ([]Activity, error) {
	if limit <= 0 {
		limit = 20
	}

	query := `
		WITH recent_scans AS (
			SELECT id, user_id, batch_id, legacy_product_name, scanned_at, tenant_id
			FROM scan_history
			WHERE tenant_id = $1
			  AND user_id IS NOT NULL
			ORDER BY scanned_at DESC
			LIMIT $2
		),
		recent_redeems AS (
			SELECT id, user_id, reward_id, created_at, tenant_id
			FROM reward_reservations
			WHERE tenant_id = $1
			ORDER BY created_at DESC
			LIMIT $2
		)
		(SELECT 'scan' AS type,
		        COALESCE(u.display_name, u.email, 'Unknown user') AS display_name,
		        COALESCE(
		          'Scanned ' || NULLIF(COALESCE(bp.name, rs.legacy_product_name), ''),
		          'Scanned QR'
		        ) AS detail,
		        rs.scanned_at::text AS created_at,
		        rs.id::text AS row_id
		 FROM recent_scans rs
		 LEFT JOIN users u ON u.id = rs.user_id
		 LEFT JOIN batches b ON b.id = rs.batch_id
		 LEFT JOIN products bp ON bp.id = b.product_id)
		UNION ALL
		(SELECT 'redeem' AS type, u.display_name, 'Redeemed ' || r.name AS detail, rr.created_at::text AS created_at, rr.id::text AS row_id
		 FROM recent_redeems rr
		 JOIN users u ON u.id = rr.user_id
		 JOIN rewards r ON r.id = rr.reward_id
		 WHERE rr.tenant_id = $1)
		ORDER BY created_at DESC
		LIMIT $2`

	rows, err := s.db.Query(ctx, query, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("recent activity: %w", err)
	}
	defer rows.Close()

	var activities []Activity
	var rowID string
	for rows.Next() {
		var a Activity
		if err := rows.Scan(&a.Type, &a.UserName, &a.Detail, &a.CreatedAt, &rowID); err != nil {
			return nil, fmt.Errorf("recent activity row: %w", err)
		}
		a.ID = a.Type + "-" + rowID
		activities = append(activities, a)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("recent activity rows: %w", err)
	}
	return activities, nil
}

func (s *Service) RefreshScanRollups(ctx context.Context, tenantID string) error {
	if _, err := s.db.Exec(ctx, `
		INSERT INTO analytics_scan_rollups (
			tenant_id, bucket_type, bucket_key, bucket_start, total_scans, success_scans, refreshed_at
		)
		SELECT
			$1,
			'day',
			TO_CHAR(DATE(scanned_at), 'YYYY-MM-DD'),
			DATE(scanned_at)::timestamptz,
			COUNT(*),
			COUNT(*) FILTER (WHERE COALESCE(scan_type, 'success') = 'success'),
			NOW()
		FROM scan_history
		WHERE tenant_id = $1
		  AND scanned_at >= CURRENT_DATE - INTERVAL '30 days'
		GROUP BY DATE(scanned_at)
		ON CONFLICT (tenant_id, bucket_type, bucket_key)
		DO UPDATE SET
			bucket_start = EXCLUDED.bucket_start,
			total_scans = EXCLUDED.total_scans,
			success_scans = EXCLUDED.success_scans,
			refreshed_at = NOW()
	`, tenantID); err != nil {
		return fmt.Errorf("refresh day rollups: %w", err)
	}

	if _, err := s.db.Exec(ctx, `
		DELETE FROM analytics_scan_rollups
		WHERE tenant_id = $1
		  AND bucket_type = 'day'
		  AND bucket_start < CURRENT_DATE - INTERVAL '30 days'
	`, tenantID); err != nil {
		return fmt.Errorf("cleanup day rollups: %w", err)
	}

	if _, err := s.db.Exec(ctx, `
		INSERT INTO analytics_scan_rollups (
			tenant_id, bucket_type, bucket_key, bucket_start, total_scans, success_scans, refreshed_at
		)
		SELECT
			$1,
			'week',
			TO_CHAR(date_trunc('week', scanned_at), 'YYYY-"W"IW'),
			date_trunc('week', scanned_at),
			COUNT(*),
			COUNT(*) FILTER (WHERE COALESCE(scan_type, 'success') = 'success'),
			NOW()
		FROM scan_history
		WHERE tenant_id = $1
		  AND scanned_at >= CURRENT_DATE - INTERVAL '90 days'
		GROUP BY date_trunc('week', scanned_at)
		ON CONFLICT (tenant_id, bucket_type, bucket_key)
		DO UPDATE SET
			bucket_start = EXCLUDED.bucket_start,
			total_scans = EXCLUDED.total_scans,
			success_scans = EXCLUDED.success_scans,
			refreshed_at = NOW()
	`, tenantID); err != nil {
		return fmt.Errorf("refresh week rollups: %w", err)
	}

	if _, err := s.db.Exec(ctx, `
		DELETE FROM analytics_scan_rollups
		WHERE tenant_id = $1
		  AND bucket_type = 'week'
		  AND bucket_start < CURRENT_DATE - INTERVAL '90 days'
	`, tenantID); err != nil {
		return fmt.Errorf("cleanup week rollups: %w", err)
	}

	if _, err := s.db.Exec(ctx, `
		INSERT INTO analytics_scan_rollups (
			tenant_id, bucket_type, bucket_key, bucket_start, total_scans, success_scans, refreshed_at
		)
		SELECT
			$1,
			'month',
			TO_CHAR(date_trunc('month', scanned_at), 'YYYY-MM'),
			date_trunc('month', scanned_at),
			COUNT(*),
			COUNT(*) FILTER (WHERE COALESCE(scan_type, 'success') = 'success'),
			NOW()
		FROM scan_history
		WHERE tenant_id = $1
		  AND scanned_at >= CURRENT_DATE - INTERVAL '365 days'
		GROUP BY date_trunc('month', scanned_at)
		ON CONFLICT (tenant_id, bucket_type, bucket_key)
		DO UPDATE SET
			bucket_start = EXCLUDED.bucket_start,
			total_scans = EXCLUDED.total_scans,
			success_scans = EXCLUDED.success_scans,
			refreshed_at = NOW()
	`, tenantID); err != nil {
		return fmt.Errorf("refresh month rollups: %w", err)
	}

	if _, err := s.db.Exec(ctx, `
		DELETE FROM analytics_scan_rollups
		WHERE tenant_id = $1
		  AND bucket_type = 'month'
		  AND bucket_start < CURRENT_DATE - INTERVAL '365 days'
	`, tenantID); err != nil {
		return fmt.Errorf("cleanup month rollups: %w", err)
	}

	if _, err := s.db.Exec(ctx, `
		INSERT INTO analytics_scan_rollups (
			tenant_id, bucket_type, bucket_key, bucket_start, total_scans, success_scans, refreshed_at
		)
		SELECT
			$1,
			'all_time',
			'all',
			NULL,
			COUNT(*),
			COUNT(*) FILTER (WHERE COALESCE(scan_type, 'success') = 'success'),
			NOW()
		FROM scan_history
		WHERE tenant_id = $1
		ON CONFLICT (tenant_id, bucket_type, bucket_key)
		DO UPDATE SET
			total_scans = EXCLUDED.total_scans,
			success_scans = EXCLUDED.success_scans,
			refreshed_at = NOW()
	`, tenantID); err != nil {
		return fmt.Errorf("refresh all-time rollups: %w", err)
	}

	return nil
}

func (s *Service) loadSummaryScanCounts(ctx context.Context, tenantID string) (int64, int64, int64, bool, error) {
	var today, sevenDays, thirtyDays, rowCount int64
	err := s.db.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(total_scans) FILTER (WHERE bucket_start >= CURRENT_DATE), 0),
			COALESCE(SUM(total_scans) FILTER (WHERE bucket_start >= CURRENT_DATE - INTERVAL '7 days'), 0),
			COALESCE(SUM(total_scans) FILTER (WHERE bucket_start >= CURRENT_DATE - INTERVAL '30 days'), 0),
			COUNT(*)
		FROM analytics_scan_rollups
		WHERE tenant_id = $1
		  AND bucket_type = 'day'
		  AND refreshed_at >= NOW() - INTERVAL '10 minutes'
	`, tenantID).Scan(&today, &sevenDays, &thirtyDays, &rowCount)
	if err != nil {
		return 0, 0, 0, false, err
	}
	return today, sevenDays, thirtyDays, rowCount > 0, nil
}

func (s *Service) loadScanChartFromRollups(ctx context.Context, tenantID, groupBy string) ([]ScanChartPoint, bool, error) {
	bucketType := "day"
	switch groupBy {
	case "week":
		bucketType = "week"
	case "month":
		bucketType = "month"
	}

	rows, err := s.db.Query(ctx, `
		SELECT bucket_key, total_scans
		FROM analytics_scan_rollups
		WHERE tenant_id = $1
		  AND bucket_type = $2
		  AND refreshed_at >= NOW() - INTERVAL '10 minutes'
		ORDER BY bucket_start
	`, tenantID, bucketType)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()

	var points []ScanChartPoint
	for rows.Next() {
		var point ScanChartPoint
		if err := rows.Scan(&point.Label, &point.Count); err != nil {
			return nil, false, err
		}
		if bucketType == "day" && len(point.Label) >= 10 {
			point.Label = strings.ReplaceAll(point.Label[5:], "-", "/")
		}
		points = append(points, point)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}
	return points, len(points) > 0, nil
}

func (s *Service) loadAllTimeSuccessScans(ctx context.Context, tenantID string) (int64, bool, error) {
	var successScans int64
	err := s.db.QueryRow(ctx, `
		SELECT success_scans
		FROM analytics_scan_rollups
		WHERE tenant_id = $1
		  AND bucket_type = 'all_time'
		  AND bucket_key = 'all'
		  AND refreshed_at >= NOW() - INTERVAL '10 minutes'
	`, tenantID).Scan(&successScans)
	if err != nil {
		return 0, false, err
	}
	return successScans, true, nil
}
