package dashboard

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
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

func (s *Service) GetSummary(ctx context.Context, tenantID string) (*Summary, error) {
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

	// Scans today
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM codes WHERE tenant_id = $1 AND scanned_at >= CURRENT_DATE`, tenantID,
	).Scan(&sum.ScansToday)

	// Scans 7d
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM codes WHERE tenant_id = $1 AND scanned_at >= CURRENT_DATE - INTERVAL '7 days'`, tenantID,
	).Scan(&sum.Scans7d)

	// Scans 30d
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM codes WHERE tenant_id = $1 AND scanned_at >= CURRENT_DATE - INTERVAL '30 days'`, tenantID,
	).Scan(&sum.Scans30d)

	// Points issued (total credits)
	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount), 0) FROM point_ledger WHERE tenant_id = $1 AND type = 'credit'`, tenantID,
	).Scan(&sum.PointsIssued)

	// Points redeemed (total debits)
	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(ABS(amount)), 0) FROM point_ledger WHERE tenant_id = $1 AND type = 'debit'`, tenantID,
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
	var dateExpr, labelExpr string
	switch groupBy {
	case "week":
		dateExpr = "date_trunc('week', scanned_at)"
		labelExpr = "TO_CHAR(date_trunc('week', scanned_at), 'YYYY-\"W\"IW')"
	case "month":
		dateExpr = "date_trunc('month', scanned_at)"
		labelExpr = "TO_CHAR(date_trunc('month', scanned_at), 'YYYY-MM')"
	default:
		dateExpr = "DATE(scanned_at)"
		labelExpr = "TO_CHAR(DATE(scanned_at), 'MM/DD')"
	}

	query := fmt.Sprintf(
		`SELECT %s AS label, COUNT(*) AS cnt
		 FROM codes
		 WHERE tenant_id = $1 AND scanned_at >= CURRENT_DATE - INTERVAL '%d days'
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
		        COALESCE((SELECT COUNT(*) FROM codes c JOIN batches b2 ON b2.id = c.batch_id WHERE b2.product_id = p.id AND c.tenant_id = $1), 0) AS scan_count,
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
	f := &FunnelData{}

	// total_generated = SUM(serial_end - serial_start + 1) from batches
	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(serial_end - serial_start + 1), 0) FROM batches WHERE tenant_id = $1`, tenantID,
	).Scan(&f.TotalGenerated)

	// total_scanned = COUNT(*) from codes where status in ('scanned','redeemed')
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM codes WHERE tenant_id = $1 AND status IN ('scanned', 'redeemed')`, tenantID,
	).Scan(&f.TotalScanned)

	// total_redeemed = COUNT(*) from reward_reservations where status = 'CONFIRMED'
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM reward_reservations WHERE tenant_id = $1 AND status = 'CONFIRMED'`, tenantID,
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

	query := `
		(SELECT 'scan' AS type, u.display_name, 'Scanned batch ' || b.prefix AS detail, c.scanned_at::text AS created_at, c.id::text AS row_id
		 FROM codes c
		 JOIN users u ON u.id = c.scanned_by
		 JOIN batches b ON b.id = c.batch_id
		 WHERE c.tenant_id = $1 AND c.scanned_by IS NOT NULL)
		UNION ALL
		(SELECT 'redeem' AS type, u.display_name, 'Redeemed ' || r.name AS detail, rr.created_at::text AS created_at, rr.id::text AS row_id
		 FROM reward_reservations rr
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
	return activities, nil
}
