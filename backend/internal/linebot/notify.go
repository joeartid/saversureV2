package linebot

import (
	"context"
	"fmt"
	"log/slog"
)

type AlertType string

const (
	AlertSuspiciousScan  AlertType = "suspicious_scan"
	AlertLowStock        AlertType = "low_stock"
	AlertPendingRedeem   AlertType = "pending_redeem"
	AlertQCFailed        AlertType = "qc_failed"
	AlertBatchRecalled   AlertType = "batch_recalled"
)

type Alert struct {
	Type      AlertType
	TenantID  string
	Title     string
	Message   string
	Severity  string // info, warning, critical
}

// SendAdminAlert sends an alert to all admin users with LINE accounts in a tenant
func (s *Service) SendAdminAlert(ctx context.Context, alert Alert) error {
	rows, err := s.db.Query(ctx,
		`SELECT u.line_user_id FROM users u
		 JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
		 WHERE u.tenant_id = $1
		   AND ur.role IN ('super_admin', 'brand_admin')
		   AND u.line_user_id IS NOT NULL
		   AND u.line_user_id != ''`,
		alert.TenantID,
	)
	if err != nil {
		return fmt.Errorf("query admin LINE IDs: %w", err)
	}
	defer rows.Close()

	var lineIDs []string
	for rows.Next() {
		var lid string
		if err := rows.Scan(&lid); err == nil && lid != "" {
			lineIDs = append(lineIDs, lid)
		}
	}

	if len(lineIDs) == 0 {
		slog.Info("no admin LINE users to notify", "tenant_id", alert.TenantID, "alert_type", alert.Type)
		return nil
	}

	icon := "ℹ️"
	switch alert.Severity {
	case "warning":
		icon = "⚠️"
	case "critical":
		icon = "🚨"
	}

	text := fmt.Sprintf("%s %s\n\n%s", icon, alert.Title, alert.Message)

	if err := s.PushMulticast(ctx, alert.TenantID, lineIDs, text); err != nil {
		slog.Error("failed to send admin alert", "error", err, "alert_type", alert.Type)
		return err
	}

	slog.Info("admin alert sent", "alert_type", alert.Type, "recipients", len(lineIDs))
	return nil
}

// NotifyLowStock checks and alerts when reward inventory is low
func (s *Service) NotifyLowStock(ctx context.Context, tenantID string, threshold int) error {
	rows, err := s.db.Query(ctx,
		`SELECT r.name, ri.available_qty
		 FROM rewards r
		 JOIN reward_inventory ri ON ri.reward_id = r.id
		 WHERE r.tenant_id = $1 AND ri.available_qty > 0 AND ri.available_qty <= $2
		 ORDER BY ri.available_qty ASC`,
		tenantID, threshold,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	var items []string
	for rows.Next() {
		var name string
		var qty int
		if err := rows.Scan(&name, &qty); err == nil {
			items = append(items, fmt.Sprintf("• %s (เหลือ %d)", name, qty))
		}
	}

	if len(items) == 0 {
		return nil
	}

	msg := "สินค้าใกล้หมดสต็อก:\n"
	for _, item := range items {
		msg += item + "\n"
	}

	return s.SendAdminAlert(ctx, Alert{
		Type:     AlertLowStock,
		TenantID: tenantID,
		Title:    "สต็อกใกล้หมด",
		Message:  msg,
		Severity: "warning",
	})
}
