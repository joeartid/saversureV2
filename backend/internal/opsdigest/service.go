package opsdigest

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"saversure/internal/analyticscache"
)

type Service struct {
	db    *pgxpool.Pool
	cache *analyticscache.Store
	mu    sync.RWMutex
	cachedTenantID string
	cachedAt time.Time
	cachedDigest *DigestSummary
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{
		db:    db,
		cache: analyticscache.NewStore(db),
	}
}

type DigestSummary struct {
	TenantID           string       `json:"tenant_id"`
	Date               string       `json:"date"`
	TotalScansToday    int          `json:"total_scans_today"`
	UniqueUsersToday   int          `json:"unique_users_today"`
	PointsAwardedToday int64        `json:"points_awarded_today"`
	PendingRedemptions int          `json:"pending_redemptions"`
	ExpiredReservations int         `json:"expired_reservations"`
	PendingFulfillment int          `json:"pending_fulfillment"`
	QCFails            int          `json:"qc_fails_today"`
	RecalledRolls      int          `json:"recalled_rolls"`
	UnmappedRolls      int          `json:"unmapped_rolls"`
	LowStockRewards    []LowStock   `json:"low_stock_rewards"`
	Alerts             []AlertEntry `json:"alerts"`
	RollStats          RollOverview `json:"roll_stats"`
	NewUsersToday      int          `json:"new_users_today"`
	RedeemCountToday   int          `json:"redeem_count_today"`
}

type LowStock struct {
	RewardID     string `json:"reward_id"`
	RewardName   string `json:"reward_name"`
	AvailableQty int    `json:"available_qty"`
	TotalQty     int    `json:"total_qty"`
}

type AlertEntry struct {
	Type     string `json:"type"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
	Time     string `json:"time,omitempty"`
	Count    int    `json:"count,omitempty"`
}

type RollOverview struct {
	PendingPrint int `json:"pending_print"`
	Printed      int `json:"printed"`
	Mapped       int `json:"mapped"`
	QCApproved   int `json:"qc_approved"`
	QCRejected   int `json:"qc_rejected"`
	Distributed  int `json:"distributed"`
	Recalled     int `json:"recalled"`
	Total        int `json:"total"`
}

func (s *Service) GenerateDigest(ctx context.Context, tenantID string) (*DigestSummary, error) {
	return s.generateDigest(ctx, tenantID, false)
}

func (s *Service) GenerateDigestFresh(ctx context.Context, tenantID string) (*DigestSummary, error) {
	return s.generateDigest(ctx, tenantID, true)
}

func (s *Service) generateDigest(ctx context.Context, tenantID string, force bool) (*DigestSummary, error) {
	s.mu.RLock()
	if !force && s.cachedDigest != nil && s.cachedTenantID == tenantID && time.Since(s.cachedAt) < 30*time.Second {
		cached := s.cachedDigest
		s.mu.RUnlock()
		return cached, nil
	}
	s.mu.RUnlock()

	if !force {
		var cached DigestSummary
		if ok, err := s.cache.Get(ctx, tenantID, "ops:digest", 60*time.Second, &cached); err == nil && ok {
			s.mu.Lock()
			s.cachedTenantID = tenantID
			s.cachedAt = time.Now()
			s.cachedDigest = &cached
			s.mu.Unlock()
			return &cached, nil
		}
	}

	d := &DigestSummary{
		TenantID: tenantID,
		Date:     time.Now().Format("2006-01-02"),
	}

	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*), COUNT(DISTINCT user_id)
		 FROM scan_history WHERE tenant_id = $1 AND scanned_at >= CURRENT_DATE`,
		tenantID,
	).Scan(&d.TotalScansToday, &d.UniqueUsersToday)

	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(amount), 0)
		 FROM point_ledger WHERE tenant_id = $1 AND entry_type = 'credit' AND created_at >= CURRENT_DATE`,
		tenantID,
	).Scan(&d.PointsAwardedToday)

	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*)
		 FROM reward_reservations
		 WHERE tenant_id = $1 AND status = 'CONFIRMED'
		   AND (fulfillment_status IS NULL OR fulfillment_status = 'pending')`,
		tenantID,
	).Scan(&d.PendingFulfillment)

	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*)
		 FROM reward_reservations
		 WHERE tenant_id = $1 AND status = 'PENDING' AND expires_at > NOW()`,
		tenantID,
	).Scan(&d.PendingRedemptions)

	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*)
		 FROM reward_reservations
		 WHERE tenant_id = $1 AND status = 'PENDING' AND expires_at <= NOW()`,
		tenantID,
	).Scan(&d.ExpiredReservations)

	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*)
		 FROM rolls WHERE tenant_id = $1 AND status = 'qc_rejected'
		   AND qc_at >= CURRENT_DATE`,
		tenantID,
	).Scan(&d.QCFails)

	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*)
		 FROM rolls WHERE tenant_id = $1 AND status = 'recalled'`,
		tenantID,
	).Scan(&d.RecalledRolls)

	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*)
		 FROM rolls WHERE tenant_id = $1 AND status IN ('pending_print', 'printed') AND product_id IS NULL`,
		tenantID,
	).Scan(&d.UnmappedRolls)

	_ = s.db.QueryRow(ctx,
		`SELECT
			COUNT(*) FILTER (WHERE status = 'pending_print'),
			COUNT(*) FILTER (WHERE status = 'printed'),
			COUNT(*) FILTER (WHERE status = 'mapped'),
			COUNT(*) FILTER (WHERE status = 'qc_approved'),
			COUNT(*) FILTER (WHERE status = 'qc_rejected'),
			COUNT(*) FILTER (WHERE status = 'distributed'),
			COUNT(*) FILTER (WHERE status = 'recalled'),
			COUNT(*)
		 FROM rolls WHERE tenant_id = $1`,
		tenantID,
	).Scan(&d.RollStats.PendingPrint, &d.RollStats.Printed, &d.RollStats.Mapped,
		&d.RollStats.QCApproved, &d.RollStats.QCRejected, &d.RollStats.Distributed,
		&d.RollStats.Recalled, &d.RollStats.Total)

	rows, err := s.db.Query(ctx,
		`SELECT r.id, r.name,
			(ri.total_qty - ri.reserved_qty - ri.sold_qty) AS available,
			ri.total_qty
		 FROM rewards r
		 JOIN reward_inventory ri ON ri.reward_id = r.id
		 WHERE r.tenant_id = $1
		   AND (ri.total_qty - ri.reserved_qty - ri.sold_qty) <= 10
		   AND (ri.total_qty - ri.reserved_qty - ri.sold_qty) >= 0
		 ORDER BY (ri.total_qty - ri.reserved_qty - ri.sold_qty) ASC
		 LIMIT 10`,
		tenantID,
	)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var ls LowStock
			if rows.Scan(&ls.RewardID, &ls.RewardName, &ls.AvailableQty, &ls.TotalQty) == nil {
				d.LowStockRewards = append(d.LowStockRewards, ls)
			}
		}
	}

	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM users u
		 WHERE u.tenant_id = $1 AND u.created_at >= CURRENT_DATE
		   AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'api_client')`,
		tenantID,
	).Scan(&d.NewUsersToday)

	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM reward_reservations
		 WHERE tenant_id = $1 AND status = 'CONFIRMED' AND created_at >= CURRENT_DATE`,
		tenantID,
	).Scan(&d.RedeemCountToday)

	d.Alerts = s.buildAlerts(d)

	s.mu.Lock()
	s.cachedTenantID = tenantID
	s.cachedAt = time.Now()
	s.cachedDigest = d
	s.mu.Unlock()
	_ = s.cache.Put(ctx, tenantID, "ops:digest", d)

	return d, nil
}

func (s *Service) buildAlerts(d *DigestSummary) []AlertEntry {
	var alerts []AlertEntry

	if d.PendingFulfillment > 0 {
		alerts = append(alerts, AlertEntry{
			Type:     "pending_fulfillment",
			Severity: severityFor(d.PendingFulfillment, 5, 20),
			Message:  fmt.Sprintf("มี %d รายการแลกรางวัลรอจัดส่ง", d.PendingFulfillment),
			Count:    d.PendingFulfillment,
		})
	}

	if d.ExpiredReservations > 0 {
		alerts = append(alerts, AlertEntry{
			Type:     "expired_reservation",
			Severity: "warning",
			Message:  fmt.Sprintf("มี %d รายการจองหมดอายุ (ยังไม่ถูก cleanup)", d.ExpiredReservations),
			Count:    d.ExpiredReservations,
		})
	}

	if d.QCFails > 0 {
		alerts = append(alerts, AlertEntry{
			Type:     "qc_fail",
			Severity: "warning",
			Message:  fmt.Sprintf("QC ปฏิเสธ %d ม้วนวันนี้", d.QCFails),
			Count:    d.QCFails,
		})
	}

	if d.RecalledRolls > 0 {
		alerts = append(alerts, AlertEntry{
			Type:     "recalled",
			Severity: "critical",
			Message:  fmt.Sprintf("มี %d ม้วนที่ถูก recall", d.RecalledRolls),
			Count:    d.RecalledRolls,
		})
	}

	if d.UnmappedRolls > 0 {
		alerts = append(alerts, AlertEntry{
			Type:     "unmapped_rolls",
			Severity: "info",
			Message:  fmt.Sprintf("มี %d ม้วนที่ยังไม่ได้ map สินค้า", d.UnmappedRolls),
			Count:    d.UnmappedRolls,
		})
	}

	for _, ls := range d.LowStockRewards {
		sev := "warning"
		if ls.AvailableQty == 0 {
			sev = "critical"
		}
		alerts = append(alerts, AlertEntry{
			Type:     "low_stock",
			Severity: sev,
			Message:  fmt.Sprintf("รางวัล \"%s\" เหลือ %d/%d ชิ้น", ls.RewardName, ls.AvailableQty, ls.TotalQty),
			Count:    ls.AvailableQty,
		})
	}

	return alerts
}

func severityFor(count, warnThreshold, critThreshold int) string {
	if count >= critThreshold {
		return "critical"
	}
	if count >= warnThreshold {
		return "warning"
	}
	return "info"
}
