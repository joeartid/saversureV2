package crm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"
)

type broadcastTenantLINEConfig struct {
	ChannelToken string
}

type BroadcastRecipientSample struct {
	UserID      string  `json:"user_id"`
	DisplayName *string `json:"display_name"`
	FirstName   *string `json:"first_name"`
	LastName    *string `json:"last_name"`
	Email       *string `json:"email"`
	Phone       *string `json:"phone"`
	Province    *string `json:"province"`
	RiskLevel   string  `json:"risk_level"`
	LineMasked  string  `json:"line_masked"`
}

type BroadcastPreviewSummary struct {
	TargetType          string                   `json:"target_type"`
	TargetValue         string                   `json:"target_value"`
	TargetLabel         string                   `json:"target_label"`
	MessageLength       int                      `json:"message_length"`
	TotalMatched        int                      `json:"total_matched"`
	LineLinkedCount     int                      `json:"line_linked_count"`
	EstimatedBatches    int                      `json:"estimated_batches"`
	ConfirmationPhrase  string                   `json:"confirmation_phrase"`
	RiskLevel           string                   `json:"risk_level"`
	RequiresExtraAck    bool                     `json:"requires_extra_ack"`
	Warnings            []string                 `json:"warnings"`
	SampleRecipients    []BroadcastRecipientSample `json:"sample_recipients"`
}

type BroadcastPreviewInput struct {
	TargetType string `json:"target_type" binding:"required"`
	TargetValue string `json:"target_value"`
	Message    string `json:"message" binding:"required"`
	ScheduledAt *string `json:"scheduled_at"`
}

type BroadcastCreateInput struct {
	Name             string  `json:"name" binding:"required"`
	TargetType       string  `json:"target_type" binding:"required"`
	TargetValue      string  `json:"target_value"`
	Message          string  `json:"message" binding:"required"`
	ScheduledAt      *string `json:"scheduled_at"`
	ConfirmationText string  `json:"confirmation_text" binding:"required"`
	HighRiskAck      bool    `json:"high_risk_ack"`
}

type BroadcastCampaign struct {
	ID                 string  `json:"id"`
	TenantID           string  `json:"tenant_id"`
	Name               string  `json:"name"`
	MessagePreview     string  `json:"message_preview"`
	TargetType         string  `json:"target_type"`
	TargetValue        *string `json:"target_value"`
	Status             string  `json:"status"`
	ScheduledAt        *string `json:"scheduled_at"`
	TotalMatched       int     `json:"total_matched"`
	LineLinkedCount    int     `json:"line_linked_count"`
	EstimatedBatches   int     `json:"estimated_batches"`
	SentCount          int     `json:"sent_count"`
	FailedCount        int     `json:"failed_count"`
	RequiresExtraAck   bool    `json:"requires_extra_ack"`
	HighRiskAck        bool    `json:"high_risk_ack"`
	StartedAt          *string `json:"started_at"`
	CompletedAt        *string `json:"completed_at"`
	LastError          *string `json:"last_error"`
	CreatedAt          string  `json:"created_at"`
	UpdatedAt          string  `json:"updated_at"`
}

type broadcastRecipient struct {
	UserID       string
	DisplayName  *string
	FirstName    *string
	LastName     *string
	Email        *string
	Phone        *string
	Province     *string
	RiskLevel    string
	LineUserID   string
}

func (s *Service) broadcastConfigForTenant(ctx context.Context, tenantID string) (*broadcastTenantLINEConfig, error) {
	var raw []byte
	if err := s.db.QueryRow(ctx,
		`SELECT COALESCE(settings, '{}'::jsonb)::text FROM tenants WHERE id = $1`,
		tenantID,
	).Scan(&raw); err != nil {
		return nil, fmt.Errorf("fetch tenant settings: %w", err)
	}

	var settings map[string]any
	if err := json.Unmarshal(raw, &settings); err != nil {
		return nil, fmt.Errorf("parse tenant settings: %w", err)
	}
	token, _ := settings["line_channel_token"].(string)
	if strings.TrimSpace(token) == "" {
		return nil, fmt.Errorf("LINE channel token not configured for tenant %s", tenantID)
	}
	return &broadcastTenantLINEConfig{ChannelToken: token}, nil
}

func (s *Service) buildBroadcastAudience(ctx context.Context, tenantID, targetType, targetValue string) (string, []any, string, error) {
	where := customerAudienceBaseWhere()
	args := []any{tenantID}
	label := "ทุกคน"

	switch strings.TrimSpace(targetType) {
	case "all":
		return where, args, label, nil
	case "tag":
		if strings.TrimSpace(targetValue) == "" {
			return "", nil, "", fmt.Errorf("target_value is required for tag broadcast")
		}
		args = append(args, targetValue)
		label = "Tag"
		return where + fmt.Sprintf(` AND EXISTS (
			SELECT 1 FROM customer_tag_assignments cta
			WHERE cta.tenant_id = u.tenant_id AND cta.user_id = u.id AND cta.tag_id::text = $%d
		)`, len(args)), args, label, nil
	case "segment":
		if strings.TrimSpace(targetValue) == "" {
			return "", nil, "", fmt.Errorf("target_value is required for segment broadcast")
		}
		segment, err := s.getSegment(ctx, tenantID, targetValue)
		if err != nil {
			return "", nil, "", err
		}
		clause, clauseArgs, err := buildSegmentWhereClause(segment.Rules, 2)
		if err != nil {
			return "", nil, "", err
		}
		args = append(args, clauseArgs...)
		label = segment.Name
		if clause != "" {
			where += " AND " + clause
		}
		return where, args, label, nil
	default:
		return "", nil, "", fmt.Errorf("unsupported target_type %s", targetType)
	}
}

func maskLineUserID(lineUserID string) string {
	if len(lineUserID) <= 6 {
		return "***"
	}
	return lineUserID[:3] + strings.Repeat("*", len(lineUserID)-6) + lineUserID[len(lineUserID)-3:]
}

func buildConfirmationPhrase(lineLinkedCount int, scheduledAt *string) string {
	if scheduledAt != nil && strings.TrimSpace(*scheduledAt) != "" {
		return fmt.Sprintf("SCHEDULE LINE TO %d USERS", lineLinkedCount)
	}
	return fmt.Sprintf("SEND LINE TO %d USERS", lineLinkedCount)
}

func (s *Service) PreviewBroadcast(ctx context.Context, tenantID string, input BroadcastPreviewInput) (*BroadcastPreviewSummary, error) {
	where, args, targetLabel, err := s.buildBroadcastAudience(ctx, tenantID, input.TargetType, input.TargetValue)
	if err != nil {
		return nil, err
	}

	var totalMatched, lineLinkedCount int
	countQuery := fmt.Sprintf(
		`SELECT COUNT(*)::int,
		        COUNT(*) FILTER (WHERE u.line_user_id IS NOT NULL AND u.line_user_id != '')::int
		 FROM users u
		 LEFT JOIN customer_rfm_snapshots r ON r.tenant_id = u.tenant_id AND r.user_id = u.id
		 WHERE %s`,
		where,
	)
	if err := s.db.QueryRow(ctx, countQuery, args...).Scan(&totalMatched, &lineLinkedCount); err != nil {
		return nil, fmt.Errorf("count broadcast audience: %w", err)
	}

	sampleQuery := fmt.Sprintf(
		`SELECT u.id::text, u.display_name, u.first_name, u.last_name, u.email, u.phone, u.province,
		        COALESCE(r.risk_level, 'normal'),
		        u.line_user_id
		 FROM users u
		 LEFT JOIN customer_rfm_snapshots r ON r.tenant_id = u.tenant_id AND r.user_id = u.id
		 WHERE %s
		   AND u.line_user_id IS NOT NULL AND u.line_user_id != ''
		 ORDER BY COALESCE(r.point_balance, 0) DESC, u.created_at DESC
		 LIMIT 10`,
		where,
	)
	rows, err := s.db.Query(ctx, sampleQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("sample broadcast audience: %w", err)
	}
	defer rows.Close()

	samples := make([]BroadcastRecipientSample, 0, 10)
	for rows.Next() {
		var item BroadcastRecipientSample
		var lineUserID string
		if err := rows.Scan(&item.UserID, &item.DisplayName, &item.FirstName, &item.LastName, &item.Email, &item.Phone, &item.Province, &item.RiskLevel, &lineUserID); err != nil {
			return nil, fmt.Errorf("scan broadcast sample: %w", err)
		}
		item.LineMasked = maskLineUserID(lineUserID)
		samples = append(samples, item)
	}

	estimatedBatches := int(math.Ceil(float64(lineLinkedCount) / 500.0))
	warnings := make([]string, 0)
	riskLevel := "normal"
	requiresExtraAck := false

	if input.TargetType == "all" {
		warnings = append(warnings, "กำลังจะ broadcast ไปยังผู้ใช้ที่เชื่อม LINE ทั้ง tenant")
	}
	if lineLinkedCount == 0 {
		warnings = append(warnings, "ไม่พบผู้รับที่เชื่อม LINE")
	}
	if lineLinkedCount >= 1000 {
		riskLevel = "elevated"
		warnings = append(warnings, "กลุ่มเป้าหมายมีขนาดใหญ่ อาจมีค่าใช้จ่ายและผลกระทบต่อประสบการณ์ลูกค้าสูง")
	}
	if lineLinkedCount >= 5000 || input.TargetType == "all" {
		riskLevel = "critical"
		requiresExtraAck = true
		warnings = append(warnings, "กลุ่มนี้ถือว่า high risk ต้องยืนยันเพิ่มก่อนส่งจริง")
	}
	if estimatedBatches >= 20 {
		warnings = append(warnings, fmt.Sprintf("ระบบจะยิง LINE multicast ประมาณ %d batches", estimatedBatches))
	}
	if len(strings.TrimSpace(input.Message)) > 250 {
		warnings = append(warnings, "ข้อความค่อนข้างยาว ควรทบทวนก่อนส่งจริง")
	}

	return &BroadcastPreviewSummary{
		TargetType:         input.TargetType,
		TargetValue:        input.TargetValue,
		TargetLabel:        targetLabel,
		MessageLength:      len([]rune(strings.TrimSpace(input.Message))),
		TotalMatched:       totalMatched,
		LineLinkedCount:    lineLinkedCount,
		EstimatedBatches:   estimatedBatches,
		ConfirmationPhrase: buildConfirmationPhrase(lineLinkedCount, input.ScheduledAt),
		RiskLevel:          riskLevel,
		RequiresExtraAck:   requiresExtraAck,
		Warnings:           warnings,
		SampleRecipients:   samples,
	}, nil
}

func (s *Service) CreateBroadcastCampaign(ctx context.Context, tenantID, createdBy string, input BroadcastCreateInput) (*BroadcastCampaign, error) {
	preview, err := s.PreviewBroadcast(ctx, tenantID, BroadcastPreviewInput{
		TargetType:  input.TargetType,
		TargetValue: input.TargetValue,
		Message:     input.Message,
		ScheduledAt: input.ScheduledAt,
	})
	if err != nil {
		return nil, err
	}
	if preview.LineLinkedCount <= 0 {
		return nil, fmt.Errorf("no LINE-linked recipients found")
	}
	if strings.TrimSpace(input.ConfirmationText) != preview.ConfirmationPhrase {
		return nil, fmt.Errorf("confirmation text mismatch")
	}
	if preview.RequiresExtraAck && !input.HighRiskAck {
		return nil, fmt.Errorf("high risk acknowledgement is required")
	}

	status := "queued"
	var scheduledAt *time.Time
	if input.ScheduledAt != nil && strings.TrimSpace(*input.ScheduledAt) != "" {
		parsed, err := time.Parse(time.RFC3339, *input.ScheduledAt)
		if err != nil {
			return nil, fmt.Errorf("invalid scheduled_at")
		}
		scheduledAt = &parsed
		status = "scheduled"
	}

	recipientSummary := map[string]any{
		"target_type":        preview.TargetType,
		"target_value":       preview.TargetValue,
		"target_label":       preview.TargetLabel,
		"line_linked_count":  preview.LineLinkedCount,
		"total_matched":      preview.TotalMatched,
		"estimated_batches":  preview.EstimatedBatches,
		"risk_level":         preview.RiskLevel,
		"requires_extra_ack": preview.RequiresExtraAck,
		"warnings":           preview.Warnings,
	}

	var item BroadcastCampaign
	var targetValue *string
	if strings.TrimSpace(input.TargetValue) != "" {
		targetValue = &input.TargetValue
	}
	err = s.db.QueryRow(ctx,
		`INSERT INTO broadcast_campaigns (
			tenant_id, name, message_type, message_payload, target_type, target_value,
			recipient_summary, confirmation_phrase, confirmation_text, scheduled_at, status,
			total_matched, line_linked_count, estimated_batches, requires_extra_ack, high_risk_ack,
			created_by, created_at, updated_at
		) VALUES (
			$1, $2, 'text', jsonb_build_object('text', $3), $4, $5,
			$6::jsonb, $7, $8, $9, $10,
			$11, $12, $13, $14, $15,
			NULLIF($16, '')::uuid, NOW(), NOW()
		)
		RETURNING id::text, tenant_id::text, name, COALESCE(message_payload->>'text', ''), target_type, target_value,
		          status, scheduled_at::text, total_matched, line_linked_count, estimated_batches,
		          sent_count, failed_count, requires_extra_ack, high_risk_ack,
		          started_at::text, completed_at::text, last_error, created_at::text, updated_at::text`,
		tenantID, strings.TrimSpace(input.Name), strings.TrimSpace(input.Message), input.TargetType, targetValue,
		recipientSummary, preview.ConfirmationPhrase, strings.TrimSpace(input.ConfirmationText), scheduledAt, status,
		preview.TotalMatched, preview.LineLinkedCount, preview.EstimatedBatches, preview.RequiresExtraAck, input.HighRiskAck,
		createdBy,
	).Scan(&item.ID, &item.TenantID, &item.Name, &item.MessagePreview, &item.TargetType, &item.TargetValue,
		&item.Status, &item.ScheduledAt, &item.TotalMatched, &item.LineLinkedCount, &item.EstimatedBatches,
		&item.SentCount, &item.FailedCount, &item.RequiresExtraAck, &item.HighRiskAck,
		&item.StartedAt, &item.CompletedAt, &item.LastError, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create broadcast campaign: %w", err)
	}
	return &item, nil
}

func (s *Service) ListBroadcastCampaigns(ctx context.Context, tenantID string, limit, offset int) ([]BroadcastCampaign, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}
	rows, err := s.db.Query(ctx,
		`SELECT id::text, tenant_id::text, name, COALESCE(message_payload->>'text', ''), target_type, target_value,
		        status, scheduled_at::text, total_matched, line_linked_count, estimated_batches,
		        sent_count, failed_count, requires_extra_ack, high_risk_ack,
		        started_at::text, completed_at::text, last_error, created_at::text, updated_at::text
		 FROM broadcast_campaigns
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2 OFFSET $3`,
		tenantID, limit, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("list broadcast campaigns: %w", err)
	}
	defer rows.Close()

	var items []BroadcastCampaign
	for rows.Next() {
		var item BroadcastCampaign
		if err := rows.Scan(&item.ID, &item.TenantID, &item.Name, &item.MessagePreview, &item.TargetType, &item.TargetValue,
			&item.Status, &item.ScheduledAt, &item.TotalMatched, &item.LineLinkedCount, &item.EstimatedBatches,
			&item.SentCount, &item.FailedCount, &item.RequiresExtraAck, &item.HighRiskAck,
			&item.StartedAt, &item.CompletedAt, &item.LastError, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan broadcast campaign: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) resolveBroadcastRecipients(ctx context.Context, tenantID, targetType, targetValue string) ([]broadcastRecipient, error) {
	where, args, _, err := s.buildBroadcastAudience(ctx, tenantID, targetType, targetValue)
	if err != nil {
		return nil, err
	}
	query := fmt.Sprintf(
		`SELECT u.id::text, u.display_name, u.first_name, u.last_name, u.email, u.phone, u.province,
		        COALESCE(r.risk_level, 'normal'),
		        u.line_user_id
		 FROM users u
		 LEFT JOIN customer_rfm_snapshots r ON r.tenant_id = u.tenant_id AND r.user_id = u.id
		 WHERE %s
		   AND u.line_user_id IS NOT NULL AND u.line_user_id != ''
		 ORDER BY u.id ASC`,
		where,
	)
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("resolve recipients: %w", err)
	}
	defer rows.Close()

	var recipients []broadcastRecipient
	for rows.Next() {
		var item broadcastRecipient
		if err := rows.Scan(&item.UserID, &item.DisplayName, &item.FirstName, &item.LastName, &item.Email, &item.Phone, &item.Province, &item.RiskLevel, &item.LineUserID); err != nil {
			return nil, fmt.Errorf("scan recipient: %w", err)
		}
		recipients = append(recipients, item)
	}
	return recipients, rows.Err()
}

func (s *Service) pushMulticastText(ctx context.Context, tenantID string, lineUserIDs []string, text string) error {
	cfg, err := s.broadcastConfigForTenant(ctx, tenantID)
	if err != nil {
		return err
	}

	body, _ := json.Marshal(map[string]any{
		"to": lineUserIDs,
		"messages": []map[string]string{
			{"type": "text", "text": text},
		},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.line.me/v2/bot/message/multicast", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.ChannelToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("LINE multicast API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("LINE multicast failed (status %d): %s", resp.StatusCode, string(raw))
	}
	return nil
}

func (s *Service) ProcessPendingBroadcasts(ctx context.Context) error {
	rows, err := s.db.Query(ctx,
		`SELECT id::text
		 FROM broadcast_campaigns
		 WHERE status IN ('queued', 'scheduled')
		   AND (scheduled_at IS NULL OR scheduled_at <= NOW())
		 ORDER BY COALESCE(scheduled_at, created_at) ASC
		 LIMIT 5`,
	)
	if err != nil {
		return fmt.Errorf("list pending broadcasts: %w", err)
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, id := range ids {
		if err := s.dispatchBroadcastCampaign(ctx, id); err != nil {
			_, _ = s.db.Exec(ctx,
				`UPDATE broadcast_campaigns
				 SET status = 'failed', last_error = $2, completed_at = NOW(), updated_at = NOW()
				 WHERE id = $1`,
				id, err.Error(),
			)
		}
	}
	return nil
}

func (s *Service) dispatchBroadcastCampaign(ctx context.Context, campaignID string) error {
	var tenantID, targetType string
	var targetValue *string
	var message string
	if err := s.db.QueryRow(ctx,
		`UPDATE broadcast_campaigns
		 SET status = 'sending', started_at = COALESCE(started_at, NOW()), updated_at = NOW()
		 WHERE id = $1 AND status IN ('queued', 'scheduled')
		 RETURNING tenant_id::text, target_type, target_value, COALESCE(message_payload->>'text', '')`,
		campaignID,
	).Scan(&tenantID, &targetType, &targetValue, &message); err != nil {
		return nil
	}

	recipients, err := s.resolveBroadcastRecipients(ctx, tenantID, targetType, func() string {
		if targetValue == nil {
			return ""
		}
		return *targetValue
	}())
	if err != nil {
		return err
	}
	if len(recipients) == 0 {
		return fmt.Errorf("no recipients available at dispatch time")
	}

	batchSize := 500
	sentCount := 0
	failedCount := 0
	for i := 0; i < len(recipients); i += batchSize {
		end := i + batchSize
		if end > len(recipients) {
			end = len(recipients)
		}
		batch := recipients[i:end]
		lineIDs := make([]string, 0, len(batch))
		for _, recipient := range batch {
			lineIDs = append(lineIDs, recipient.LineUserID)
		}

		if err := s.pushMulticastText(ctx, tenantID, lineIDs, message); err != nil {
			failedCount += len(batch)
			for _, recipient := range batch {
				_, _ = s.db.Exec(ctx,
					`INSERT INTO broadcast_delivery_logs (
						broadcast_campaign_id, tenant_id, user_id, line_user_id, status, error_message, created_at
					) VALUES ($1, $2, NULLIF($3, '')::uuid, $4, 'failed', $5, NOW())`,
					campaignID, tenantID, recipient.UserID, recipient.LineUserID, err.Error(),
				)
			}
			continue
		}

		sentCount += len(batch)
		_, _ = s.db.Exec(ctx,
			`UPDATE broadcast_campaigns
			 SET sent_count = $2, failed_count = $3, updated_at = NOW()
			 WHERE id = $1`,
			campaignID, sentCount, failedCount,
		)
	}

	finalStatus := "sent"
	var lastError *string
	if failedCount > 0 && sentCount > 0 {
		finalStatus = "partial_failed"
		errText := fmt.Sprintf("failed %d recipients", failedCount)
		lastError = &errText
	}
	if sentCount == 0 && failedCount > 0 {
		finalStatus = "failed"
		errText := fmt.Sprintf("failed %d recipients", failedCount)
		lastError = &errText
	}

	_, err = s.db.Exec(ctx,
		`UPDATE broadcast_campaigns
		 SET status = $2,
		     sent_count = $3,
		     failed_count = $4,
		     last_error = $5,
		     completed_at = NOW(),
		     updated_at = NOW()
		 WHERE id = $1`,
		campaignID, finalStatus, sentCount, failedCount, lastError,
	)
	return err
}
