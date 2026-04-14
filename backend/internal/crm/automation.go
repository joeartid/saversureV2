package crm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type Trigger struct {
	ID          string         `json:"id"`
	TenantID    string         `json:"tenant_id"`
	Name        string         `json:"name"`
	EventType   string         `json:"event_type"`
	DelayHours  int            `json:"delay_hours"`
	ActionType  string         `json:"action_type"`
	ActionPayload map[string]any `json:"action_payload"`
	Active      bool           `json:"active"`
	FiredCount  int            `json:"fired_count"`
	LastFiredAt *string        `json:"last_fired_at"`
	CreatedAt   string         `json:"created_at"`
	UpdatedAt   string         `json:"updated_at"`
}

type TriggerInput struct {
	Name         string         `json:"name" binding:"required"`
	EventType    string         `json:"event_type" binding:"required"`
	DelayHours   int            `json:"delay_hours"`
	ActionType   string         `json:"action_type" binding:"required"`
	ActionPayload map[string]any `json:"action_payload"`
	Active       *bool          `json:"active"`
}

type PointExpiryRunSummary struct {
	ProcessedEntries int `json:"processed_entries"`
	ExpiredPoints    int `json:"expired_points"`
	NotifiedUsers    int `json:"notified_users"`
}

type TriggerRunSummary struct {
	ProcessedTriggers int `json:"processed_triggers"`
	Sent              int `json:"sent"`
	Skipped           int `json:"skipped"`
	Failed            int `json:"failed"`
}

type AutomationRunSummary struct {
	PointExpiry PointExpiryRunSummary `json:"point_expiry"`
	Triggers    TriggerRunSummary     `json:"triggers"`
}

type expiringLedgerEntry struct {
	ID            string
	UserID        string
	Amount        int
	Remaining     int
	ExpiresAt     time.Time
}

type expiringUserSummary struct {
	UserID        string
	TotalRemaining int
	NearestExpiry time.Time
}

type triggerCandidate struct {
	UserID    string
	FirstName string
	Context   map[string]string
}

func normalizeTriggerInput(input TriggerInput) TriggerInput {
	input.Name = strings.TrimSpace(input.Name)
	input.EventType = strings.TrimSpace(input.EventType)
	input.ActionType = strings.TrimSpace(input.ActionType)
	if input.ActionPayload == nil {
		input.ActionPayload = map[string]any{}
	}
	if input.DelayHours < 0 {
		input.DelayHours = 0
	}
	return input
}

func normalizeTriggerActionPayload(payload map[string]any) map[string]any {
	if payload == nil {
		return map[string]any{}
	}
	return payload
}

func (s *Service) ListTriggers(ctx context.Context, tenantID string) ([]Trigger, error) {
	rows, err := s.db.Query(ctx, `
		SELECT
			t.id::text,
			t.tenant_id::text,
			t.name,
			t.event_type,
			t.delay_hours,
			t.action_type,
			t.action_payload,
			t.active,
			COALESCE(COUNT(l.id), 0)::int AS fired_count,
			MAX(l.fired_at)::text,
			t.created_at::text,
			t.updated_at::text
		FROM crm_triggers t
		LEFT JOIN crm_trigger_logs l ON l.trigger_id = t.id
		WHERE t.tenant_id = $1
		GROUP BY t.id
		ORDER BY t.created_at DESC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list triggers: %w", err)
	}
	defer rows.Close()

	var items []Trigger
	for rows.Next() {
		var item Trigger
		var payload []byte
		if err := rows.Scan(&item.ID, &item.TenantID, &item.Name, &item.EventType, &item.DelayHours, &item.ActionType, &payload, &item.Active, &item.FiredCount, &item.LastFiredAt, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan trigger: %w", err)
		}
		if err := json.Unmarshal(payload, &item.ActionPayload); err != nil {
			return nil, fmt.Errorf("parse trigger payload: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) CreateTrigger(ctx context.Context, tenantID string, input TriggerInput) (*Trigger, error) {
	input = normalizeTriggerInput(input)
	active := true
	if input.Active != nil {
		active = *input.Active
	}
	payload := normalizeTriggerActionPayload(input.ActionPayload)
	item := &Trigger{}
	raw, _ := json.Marshal(payload)
	err := s.db.QueryRow(ctx, `
		INSERT INTO crm_triggers (
			tenant_id, name, event_type, delay_hours, action_type, action_payload, active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW(), NOW())
		RETURNING id::text, tenant_id::text, name, event_type, delay_hours, action_type, action_payload, active, created_at::text, updated_at::text
	`, tenantID, input.Name, input.EventType, input.DelayHours, input.ActionType, string(raw), active).Scan(
		&item.ID, &item.TenantID, &item.Name, &item.EventType, &item.DelayHours, &item.ActionType, &raw, &item.Active, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create trigger: %w", err)
	}
	_ = json.Unmarshal(raw, &item.ActionPayload)
	return item, nil
}

func (s *Service) UpdateTrigger(ctx context.Context, tenantID, triggerID string, input TriggerInput) (*Trigger, error) {
	input = normalizeTriggerInput(input)
	active := true
	if input.Active != nil {
		active = *input.Active
	}
	payload := normalizeTriggerActionPayload(input.ActionPayload)
	item := &Trigger{}
	raw, _ := json.Marshal(payload)
	err := s.db.QueryRow(ctx, `
		UPDATE crm_triggers
		SET name = $3,
		    event_type = $4,
		    delay_hours = $5,
		    action_type = $6,
		    action_payload = $7::jsonb,
		    active = $8,
		    updated_at = NOW()
		WHERE tenant_id = $1 AND id = $2::uuid
		RETURNING id::text, tenant_id::text, name, event_type, delay_hours, action_type, action_payload, active, created_at::text, updated_at::text
	`, tenantID, triggerID, input.Name, input.EventType, input.DelayHours, input.ActionType, string(raw), active).Scan(
		&item.ID, &item.TenantID, &item.Name, &item.EventType, &item.DelayHours, &item.ActionType, &raw, &item.Active, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update trigger: %w", err)
	}
	_ = json.Unmarshal(raw, &item.ActionPayload)
	return item, nil
}

func (s *Service) DeleteTrigger(ctx context.Context, tenantID, triggerID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM crm_triggers WHERE tenant_id = $1 AND id = $2::uuid`, tenantID, triggerID)
	if err != nil {
		return fmt.Errorf("delete trigger: %w", err)
	}
	return nil
}

func (s *Service) pushTextToLineUser(ctx context.Context, tenantID, lineUserID, text string) error {
	cfg, err := s.broadcastConfigForTenant(ctx, tenantID)
	if err != nil {
		return err
	}
	body, _ := json.Marshal(map[string]any{
		"to": lineUserID,
		"messages": []map[string]string{
			{"type": "text", "text": text},
		},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.line.me/v2/bot/message/push", strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.ChannelToken)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("LINE push API: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("LINE push failed with status %d", resp.StatusCode)
	}
	return nil
}

func (s *Service) createNotification(ctx context.Context, tenantID, userID, nType, title, body, refType, refID string) error {
	_, err := s.db.Exec(ctx,
		`INSERT INTO notifications (tenant_id, user_id, type, title, body, ref_type, ref_id)
		 VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), CASE WHEN $7 = '' THEN NULL ELSE $7::uuid END)`,
		tenantID, userID, nType, title, body, refType, refID,
	)
	return err
}

func createNotificationTx(ctx context.Context, tx pgx.Tx, tenantID, userID, nType, title, body, refType, refID string) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO notifications (tenant_id, user_id, type, title, body, ref_type, ref_id)
		 VALUES ($1::uuid, $2::uuid, $3, $4, NULLIF($5, ''), NULLIF($6, ''), CASE WHEN $7 = '' THEN NULL ELSE $7::uuid END)`,
		tenantID, userID, nType, title, body, refType, refID,
	)
	return err
}

func (s *Service) getUserLineID(ctx context.Context, tenantID, userID string) (string, error) {
	var lineUserID string
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(line_user_id, '') FROM users WHERE tenant_id = $1 AND id = $2::uuid`,
		tenantID, userID,
	).Scan(&lineUserID)
	if err != nil {
		return "", fmt.Errorf("get user line id: %w", err)
	}
	return lineUserID, nil
}

func renderTemplate(message string, data map[string]string) string {
	out := message
	for key, value := range data {
		out = strings.ReplaceAll(out, "{{"+key+"}}", value)
	}
	return out
}

func (s *Service) listDueExpiryEntries(ctx context.Context, tenantID string) ([]expiringLedgerEntry, error) {
	rows, err := s.db.Query(ctx, `
		WITH credit_rows AS (
			SELECT
				pl.id::text AS id,
				pl.user_id::text AS user_id,
				pl.amount,
				pl.expires_at,
				SUM(pl.amount) OVER (
					PARTITION BY pl.tenant_id, pl.user_id, COALESCE(pl.currency, 'point')
					ORDER BY pl.created_at, pl.id
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
				) AS running_credits
			FROM point_ledger pl
			WHERE pl.tenant_id = $1
			  AND COALESCE(pl.currency, 'point') = 'point'
			  AND pl.entry_type = 'credit'
			  AND pl.expires_at IS NOT NULL
			  AND pl.expiry_processed = FALSE
			  AND pl.expires_at <= NOW()
		),
		user_outflows AS (
			SELECT
				pl.tenant_id,
				pl.user_id,
				COALESCE(SUM(pl.amount) FILTER (WHERE pl.entry_type IN ('debit', 'expiry')), 0) AS total_outflow
			FROM point_ledger pl
			WHERE pl.tenant_id = $1
			  AND COALESCE(pl.currency, 'point') = 'point'
			GROUP BY pl.tenant_id, pl.user_id
		)
		SELECT
			c.id,
			c.user_id,
			c.amount,
			c.expires_at,
			GREATEST(
				0,
				c.amount - LEAST(
					c.amount,
					GREATEST(0, COALESCE(o.total_outflow, 0) - (c.running_credits - c.amount))
				)
			)::int AS remaining_amount
		FROM credit_rows c
		LEFT JOIN user_outflows o ON o.tenant_id = $1 AND o.user_id::text = c.user_id
		WHERE GREATEST(
				0,
				c.amount - LEAST(
					c.amount,
					GREATEST(0, COALESCE(o.total_outflow, 0) - (c.running_credits - c.amount))
				)
			) > 0
		ORDER BY c.expires_at ASC, c.user_id ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list due expiry entries: %w", err)
	}
	defer rows.Close()

	var items []expiringLedgerEntry
	for rows.Next() {
		var item expiringLedgerEntry
		if err := rows.Scan(&item.ID, &item.UserID, &item.Amount, &item.ExpiresAt, &item.Remaining); err != nil {
			return nil, fmt.Errorf("scan due expiry entry: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) markZeroRemainingExpiredCreditsProcessed(ctx context.Context, tenantID string) error {
	_, err := s.db.Exec(ctx, `
		WITH credit_rows AS (
			SELECT
				pl.id,
				pl.amount,
				SUM(pl.amount) OVER (
					PARTITION BY pl.tenant_id, pl.user_id, COALESCE(pl.currency, 'point')
					ORDER BY pl.created_at, pl.id
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
				) AS running_credits,
				pl.user_id
			FROM point_ledger pl
			WHERE pl.tenant_id = $1
			  AND COALESCE(pl.currency, 'point') = 'point'
			  AND pl.entry_type = 'credit'
			  AND pl.expires_at IS NOT NULL
			  AND pl.expiry_processed = FALSE
			  AND pl.expires_at <= NOW()
		),
		user_outflows AS (
			SELECT
				pl.user_id,
				COALESCE(SUM(pl.amount) FILTER (WHERE pl.entry_type IN ('debit', 'expiry')), 0) AS total_outflow
			FROM point_ledger pl
			WHERE pl.tenant_id = $1
			  AND COALESCE(pl.currency, 'point') = 'point'
			GROUP BY pl.user_id
		),
		fully_consumed AS (
			SELECT c.id
			FROM credit_rows c
			LEFT JOIN user_outflows o ON o.user_id = c.user_id
			WHERE GREATEST(
				0,
				c.amount - LEAST(
					c.amount,
					GREATEST(0, COALESCE(o.total_outflow, 0) - (c.running_credits - c.amount))
				)
			) <= 0
		)
		UPDATE point_ledger pl
		SET expiry_processed = TRUE
		FROM fully_consumed fc
		WHERE pl.id = fc.id
	`, tenantID)
	return err
}

func (s *Service) ProcessPointExpiries(ctx context.Context, tenantID string) (*PointExpiryRunSummary, error) {
	items, err := s.listDueExpiryEntries(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	summary := &PointExpiryRunSummary{}

	for _, item := range items {
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return nil, fmt.Errorf("begin expiry tx: %w", err)
		}

		var processed bool
		if err := tx.QueryRow(ctx,
			`SELECT expiry_processed FROM point_ledger WHERE id = $1::uuid FOR UPDATE`,
			item.ID,
		).Scan(&processed); err != nil {
			tx.Rollback(ctx)
			return nil, fmt.Errorf("lock expiry row: %w", err)
		}
		if processed {
			tx.Rollback(ctx)
			continue
		}

		var currentBalance int
		if err := tx.QueryRow(ctx,
			`SELECT COALESCE((SELECT balance_after FROM point_ledger
				WHERE tenant_id = $1 AND user_id = $2::uuid AND COALESCE(currency, 'point') = 'point'
				ORDER BY created_at DESC, id DESC LIMIT 1), 0)`,
			tenantID, item.UserID,
		).Scan(&currentBalance); err != nil {
			tx.Rollback(ctx)
			return nil, fmt.Errorf("load current balance for expiry: %w", err)
		}

		expiredAmount := item.Remaining
		if expiredAmount > currentBalance {
			expiredAmount = currentBalance
		}
		if expiredAmount > 0 {
			description := fmt.Sprintf("Point expiry for credit %s", item.ID)
			if _, err := tx.Exec(ctx,
				`INSERT INTO point_ledger (
					tenant_id, user_id, entry_type, amount, balance_after, reference_type, reference_id, description, currency
				) VALUES ($1, $2::uuid, 'expiry', $3, $4, 'point_expiry', $5::uuid, $6, 'point')`,
				tenantID, item.UserID, expiredAmount, currentBalance-expiredAmount, item.ID, description,
			); err != nil {
				tx.Rollback(ctx)
				return nil, fmt.Errorf("insert expiry ledger: %w", err)
			}
			if err := createNotificationTx(ctx, tx, tenantID, item.UserID, "points", "แต้มหมดอายุแล้ว", fmt.Sprintf("มีแต้ม %d คะแนนหมดอายุแล้ว", expiredAmount), "point_expiry", ""); err != nil {
				tx.Rollback(ctx)
				return nil, fmt.Errorf("create expiry notification: %w", err)
			}
			summary.ExpiredPoints += expiredAmount
		}

		if _, err := tx.Exec(ctx,
			`UPDATE point_ledger
			 SET expiry_processed = TRUE
			 WHERE id = $1::uuid`,
			item.ID,
		); err != nil {
			tx.Rollback(ctx)
			return nil, fmt.Errorf("mark expiry processed: %w", err)
		}

		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit expiry tx: %w", err)
		}
		summary.ProcessedEntries++
	}

	if err := s.markZeroRemainingExpiredCreditsProcessed(ctx, tenantID); err != nil {
		return nil, fmt.Errorf("mark zero remaining expiries processed: %w", err)
	}
	return summary, nil
}

func (s *Service) listUsersWithPreExpiryPoints(ctx context.Context, tenantID string) ([]expiringUserSummary, error) {
	rows, err := s.db.Query(ctx, `
		WITH credit_rows AS (
			SELECT
				pl.id::text AS id,
				pl.user_id::text AS user_id,
				pl.amount,
				pl.expires_at,
				SUM(pl.amount) OVER (
					PARTITION BY pl.tenant_id, pl.user_id, COALESCE(pl.currency, 'point')
					ORDER BY pl.created_at, pl.id
					ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
				) AS running_credits
			FROM point_ledger pl
			WHERE pl.tenant_id = $1
			  AND COALESCE(pl.currency, 'point') = 'point'
			  AND pl.entry_type = 'credit'
			  AND pl.expires_at IS NOT NULL
			  AND pl.expiry_notify_sent = FALSE
			  AND pl.expires_at > NOW()
			  AND pl.expires_at <= NOW() + INTERVAL '7 days'
		),
		user_outflows AS (
			SELECT
				pl.tenant_id,
				pl.user_id,
				COALESCE(SUM(pl.amount) FILTER (WHERE pl.entry_type IN ('debit', 'expiry')), 0) AS total_outflow
			FROM point_ledger pl
			WHERE pl.tenant_id = $1
			  AND COALESCE(pl.currency, 'point') = 'point'
			GROUP BY pl.tenant_id, pl.user_id
		),
		expiring_rows AS (
			SELECT
				c.id,
				c.user_id,
				c.expires_at,
				GREATEST(
					0,
					c.amount - LEAST(
						c.amount,
						GREATEST(0, COALESCE(o.total_outflow, 0) - (c.running_credits - c.amount))
					)
				)::int AS remaining_amount
			FROM credit_rows c
			LEFT JOIN user_outflows o ON o.tenant_id = $1 AND o.user_id::text = c.user_id
		)
		SELECT
			user_id,
			COALESCE(SUM(remaining_amount), 0)::int AS total_remaining,
			MIN(expires_at) AS nearest_expiry
		FROM expiring_rows
		WHERE remaining_amount > 0
		GROUP BY user_id
		ORDER BY nearest_expiry ASC, user_id ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list pre-expiry users: %w", err)
	}
	defer rows.Close()

	var items []expiringUserSummary
	for rows.Next() {
		var item expiringUserSummary
		if err := rows.Scan(&item.UserID, &item.TotalRemaining, &item.NearestExpiry); err != nil {
			return nil, fmt.Errorf("scan pre-expiry user: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) markPreExpiryNotified(ctx context.Context, tenantID, userID string) error {
	_, err := s.db.Exec(ctx, `
		UPDATE point_ledger
		SET expiry_notify_sent = TRUE
		WHERE tenant_id = $1
		  AND user_id = $2::uuid
		  AND entry_type = 'credit'
		  AND COALESCE(currency, 'point') = 'point'
		  AND expires_at IS NOT NULL
		  AND expires_at > NOW()
		  AND expires_at <= NOW() + INTERVAL '7 days'
		  AND expiry_notify_sent = FALSE
	`, tenantID, userID)
	return err
}

func (s *Service) ProcessPreExpiryNotifications(ctx context.Context, tenantID string) (*PointExpiryRunSummary, error) {
	users, err := s.listUsersWithPreExpiryPoints(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	summary := &PointExpiryRunSummary{}
	for _, item := range users {
		expiryDate := item.NearestExpiry.Format("02/01/2006 15:04")
		body := fmt.Sprintf("คุณมีแต้ม %d คะแนนที่จะหมดอายุในวันที่ %s", item.TotalRemaining, expiryDate)
		if err := s.createNotification(ctx, tenantID, item.UserID, "points", "แต้มใกล้หมดอายุ", body, "point_expiry", ""); err != nil {
			return nil, fmt.Errorf("create pre-expiry notification: %w", err)
		}
		lineUserID, err := s.getUserLineID(ctx, tenantID, item.UserID)
		if err == nil && strings.TrimSpace(lineUserID) != "" {
			_ = s.pushTextToLineUser(ctx, tenantID, lineUserID, "แจ้งเตือนแต้มใกล้หมดอายุ\n\n"+body)
		}
		if err := s.markPreExpiryNotified(ctx, tenantID, item.UserID); err != nil {
			return nil, fmt.Errorf("mark pre-expiry notified: %w", err)
		}
		summary.NotifiedUsers++
	}
	return summary, nil
}

func (s *Service) loadActiveTriggers(ctx context.Context, tenantID string) ([]Trigger, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id::text, tenant_id::text, name, event_type, delay_hours, action_type, action_payload, active, created_at::text, updated_at::text
		FROM crm_triggers
		WHERE tenant_id = $1 AND active = TRUE
		ORDER BY created_at ASC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("load active triggers: %w", err)
	}
	defer rows.Close()

	var items []Trigger
	for rows.Next() {
		var item Trigger
		var payload []byte
		if err := rows.Scan(&item.ID, &item.TenantID, &item.Name, &item.EventType, &item.DelayHours, &item.ActionType, &payload, &item.Active, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan active trigger: %w", err)
		}
		_ = json.Unmarshal(payload, &item.ActionPayload)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) listTriggerCandidates(ctx context.Context, tenantID string, trigger Trigger) ([]triggerCandidate, error) {
	switch trigger.EventType {
	case "signup":
		rows, err := s.db.Query(ctx, `
			SELECT u.id::text, COALESCE(NULLIF(u.first_name, ''), NULLIF(u.display_name, ''), 'ลูกค้า')
			FROM users u
			WHERE `+customerAudienceBaseWhere()+`
			  AND u.created_at <= NOW() - make_interval(hours => $2)
			  AND NOT EXISTS (
				SELECT 1 FROM crm_trigger_logs l
				WHERE l.trigger_id = $3::uuid AND l.user_id = u.id
			  )
			ORDER BY u.created_at ASC
			LIMIT 500
		`, tenantID, trigger.DelayHours, trigger.ID)
		if err != nil {
			return nil, fmt.Errorf("signup candidates: %w", err)
		}
		defer rows.Close()
		var items []triggerCandidate
		for rows.Next() {
			var item triggerCandidate
			if err := rows.Scan(&item.UserID, &item.FirstName); err != nil {
				return nil, fmt.Errorf("scan signup candidate: %w", err)
			}
			item.Context = map[string]string{"first_name": item.FirstName}
			items = append(items, item)
		}
		return items, rows.Err()
	case "first_scan":
		rows, err := s.db.Query(ctx, `
			WITH first_scans AS (
				SELECT tenant_id, user_id, MIN(scanned_at) AS first_scan_at
				FROM scan_history
				WHERE tenant_id = $1
				GROUP BY tenant_id, user_id
			)
			SELECT u.id::text, COALESCE(NULLIF(u.first_name, ''), NULLIF(u.display_name, ''), 'ลูกค้า')
			FROM first_scans fs
			JOIN users u ON u.id = fs.user_id AND u.tenant_id = fs.tenant_id
			WHERE fs.first_scan_at <= NOW() - make_interval(hours => $2)
			  AND EXISTS (
				SELECT 1 FROM user_roles ur
				WHERE ur.user_id = u.id AND ur.tenant_id = u.tenant_id AND ur.role = 'api_client'
			  )
			  AND NOT EXISTS (
				SELECT 1 FROM crm_trigger_logs l
				WHERE l.trigger_id = $3::uuid AND l.user_id = u.id
			  )
			ORDER BY fs.first_scan_at ASC
			LIMIT 500
		`, tenantID, trigger.DelayHours, trigger.ID)
		if err != nil {
			return nil, fmt.Errorf("first_scan candidates: %w", err)
		}
		defer rows.Close()
		var items []triggerCandidate
		for rows.Next() {
			var item triggerCandidate
			if err := rows.Scan(&item.UserID, &item.FirstName); err != nil {
				return nil, fmt.Errorf("scan first_scan candidate: %w", err)
			}
			item.Context = map[string]string{"first_name": item.FirstName}
			items = append(items, item)
		}
		return items, rows.Err()
	case "days_inactive_30", "days_inactive_90":
		minDays := 30
		maxDays := 89
		if trigger.EventType == "days_inactive_90" {
			minDays = 90
			maxDays = 10000
		}
		rows, err := s.db.Query(ctx, `
			SELECT u.id::text, COALESCE(NULLIF(u.first_name, ''), NULLIF(u.display_name, ''), 'ลูกค้า')
			FROM customer_rfm_snapshots r
			JOIN users u ON u.id = r.user_id AND u.tenant_id = r.tenant_id
			WHERE r.tenant_id = $1
			  AND r.last_scan_at IS NOT NULL
			  AND NOW() - r.last_scan_at >= make_interval(days => $2)
			  AND NOW() - r.last_scan_at < make_interval(days => $3)
			  AND NOT EXISTS (
				SELECT 1 FROM crm_trigger_logs l
				WHERE l.trigger_id = $4::uuid AND l.user_id = u.id
			  )
			ORDER BY r.last_scan_at ASC
			LIMIT 500
		`, tenantID, minDays, maxDays+1, trigger.ID)
		if err != nil {
			return nil, fmt.Errorf("inactive candidates: %w", err)
		}
		defer rows.Close()
		var items []triggerCandidate
		for rows.Next() {
			var item triggerCandidate
			if err := rows.Scan(&item.UserID, &item.FirstName); err != nil {
				return nil, fmt.Errorf("scan inactive candidate: %w", err)
			}
			item.Context = map[string]string{"first_name": item.FirstName}
			items = append(items, item)
		}
		return items, rows.Err()
	case "point_expiring_7d":
		users, err := s.listUsersWithPreExpiryPoints(ctx, tenantID)
		if err != nil {
			return nil, err
		}
		var items []triggerCandidate
		for _, user := range users {
			var firstName string
			if err := s.db.QueryRow(ctx,
				`SELECT COALESCE(NULLIF(first_name, ''), NULLIF(display_name, ''), 'ลูกค้า') FROM users WHERE tenant_id = $1 AND id = $2::uuid`,
				tenantID, user.UserID,
			).Scan(&firstName); err != nil {
				return nil, fmt.Errorf("load trigger user for point_expiring_7d: %w", err)
			}
			var exists bool
			if err := s.db.QueryRow(ctx,
				`SELECT EXISTS(SELECT 1 FROM crm_trigger_logs WHERE trigger_id = $1::uuid AND user_id = $2::uuid)`,
				trigger.ID, user.UserID,
			).Scan(&exists); err != nil {
				return nil, fmt.Errorf("check trigger log for point_expiring_7d: %w", err)
			}
			if exists {
				continue
			}
			if trigger.DelayHours > 0 && user.NearestExpiry.After(time.Now().Add(7*24*time.Hour-time.Duration(trigger.DelayHours)*time.Hour)) {
				continue
			}
			items = append(items, triggerCandidate{
				UserID:    user.UserID,
				FirstName: firstName,
				Context: map[string]string{
					"first_name": firstName,
					"points":     fmt.Sprintf("%d", user.TotalRemaining),
					"expires_at": user.NearestExpiry.Format("02/01/2006 15:04"),
				},
			})
		}
		return items, nil
	default:
		return nil, nil
	}
}

func (s *Service) startTriggerLog(ctx context.Context, tx pgx.Tx, tenantID, triggerID, userID string) (string, bool, error) {
	var logID string
	err := tx.QueryRow(ctx, `
		INSERT INTO crm_trigger_logs (trigger_id, tenant_id, user_id, status, detail, fired_at, created_at)
		VALUES ($1::uuid, $2::uuid, $3::uuid, 'processing', NULL, NOW(), NOW())
		ON CONFLICT (trigger_id, user_id) DO NOTHING
		RETURNING id::text
	`, triggerID, tenantID, userID).Scan(&logID)
	if err == pgx.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return logID, true, nil
}

func (s *Service) finalizeTriggerLog(ctx context.Context, tx pgx.Tx, logID, status, detail string) error {
	_, err := tx.Exec(ctx,
		`UPDATE crm_trigger_logs SET status = $2, detail = NULLIF($3, ''), fired_at = NOW() WHERE id = $1::uuid`,
		logID, status, detail,
	)
	return err
}

func (s *Service) executeTriggerAction(ctx context.Context, tx pgx.Tx, tenantID string, trigger Trigger, candidate triggerCandidate) (string, string, error) {
	switch trigger.ActionType {
	case "notification":
		title := renderTemplate(conditionStringValue(trigger.ActionPayload["title"]), candidate.Context)
		body := renderTemplate(conditionStringValue(trigger.ActionPayload["body"]), candidate.Context)
		nType := conditionStringValue(trigger.ActionPayload["type"])
		if nType == "" {
			nType = "system"
		}
		if title == "" {
			title = trigger.Name
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO notifications (tenant_id, user_id, type, title, body)
			 VALUES ($1::uuid, $2::uuid, $3, $4, NULLIF($5, ''))`,
			tenantID, candidate.UserID, nType, title, body,
		); err != nil {
			return "failed", "", err
		}
		return "sent", title, nil
	case "line_message":
		message := renderTemplate(conditionStringValue(trigger.ActionPayload["message"]), candidate.Context)
		if message == "" {
			return "failed", "", fmt.Errorf("line message payload is empty")
		}
		lineUserID, err := s.getUserLineID(ctx, tenantID, candidate.UserID)
		if err != nil {
			return "failed", "", err
		}
		if strings.TrimSpace(lineUserID) == "" {
			return "skipped", "user has no linked LINE", nil
		}
		if err := s.pushTextToLineUser(ctx, tenantID, lineUserID, message); err != nil {
			return "failed", "", err
		}
		return "sent", "line sent", nil
	case "tag_assign":
		tagID := conditionStringValue(trigger.ActionPayload["tag_id"])
		if tagID == "" {
			return "failed", "", fmt.Errorf("tag_id is required for tag_assign")
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO customer_tag_assignments (tenant_id, user_id, tag_id, assigned_by, created_at)
			VALUES ($1::uuid, $2::uuid, $3::uuid, 'auto', NOW())
			ON CONFLICT (tenant_id, user_id, tag_id) DO NOTHING
		`, tenantID, candidate.UserID, tagID); err != nil {
			return "failed", "", err
		}
		return "sent", "tag assigned", nil
	default:
		return "failed", "", fmt.Errorf("unsupported action type %s", trigger.ActionType)
	}
}

func (s *Service) RunActiveTriggers(ctx context.Context, tenantID string) (*TriggerRunSummary, error) {
	triggers, err := s.loadActiveTriggers(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	summary := &TriggerRunSummary{}
	for _, trigger := range triggers {
		summary.ProcessedTriggers++
		candidates, err := s.listTriggerCandidates(ctx, tenantID, trigger)
		if err != nil {
			return nil, err
		}
		for _, candidate := range candidates {
			tx, err := s.db.Begin(ctx)
			if err != nil {
				return nil, fmt.Errorf("begin trigger tx: %w", err)
			}
			logID, inserted, err := s.startTriggerLog(ctx, tx, tenantID, trigger.ID, candidate.UserID)
			if err != nil {
				tx.Rollback(ctx)
				return nil, fmt.Errorf("start trigger log: %w", err)
			}
			if !inserted {
				tx.Rollback(ctx)
				continue
			}
			status, detail, actionErr := s.executeTriggerAction(ctx, tx, tenantID, trigger, candidate)
			if actionErr != nil {
				_ = s.finalizeTriggerLog(ctx, tx, logID, "failed", actionErr.Error())
				tx.Commit(ctx)
				summary.Failed++
				continue
			}
			if err := s.finalizeTriggerLog(ctx, tx, logID, status, detail); err != nil {
				tx.Rollback(ctx)
				return nil, fmt.Errorf("finalize trigger log: %w", err)
			}
			if err := tx.Commit(ctx); err != nil {
				return nil, fmt.Errorf("commit trigger tx: %w", err)
			}
			switch status {
			case "sent":
				summary.Sent++
			case "skipped":
				summary.Skipped++
			default:
				summary.Failed++
			}
		}
	}
	return summary, nil
}

func (s *Service) RunLifecycleAutomation(ctx context.Context, tenantID string) (*AutomationRunSummary, error) {
	expirySummary, err := s.ProcessPointExpiries(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	preExpirySummary, err := s.ProcessPreExpiryNotifications(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	expirySummary.NotifiedUsers = preExpirySummary.NotifiedUsers
	triggerSummary, err := s.RunActiveTriggers(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	return &AutomationRunSummary{
		PointExpiry: *expirySummary,
		Triggers:    *triggerSummary,
	}, nil
}
