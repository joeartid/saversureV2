package crm

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
)

type SegmentExportJob struct {
	ID           string  `json:"id"`
	SegmentID    string  `json:"segment_id"`
	SegmentName  string  `json:"segment_name"`
	Status       string  `json:"status"`
	TotalRows    int     `json:"total_rows"`
	ObjectKey    *string `json:"object_key"`
	FileURL      *string `json:"file_url"`
	RequestedBy  *string `json:"requested_by"`
	StartedAt    *string `json:"started_at"`
	CompletedAt  *string `json:"completed_at"`
	ErrorMessage *string `json:"error_message"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

type CreateSegmentExportInput struct {
	SegmentID string `json:"segment_id" binding:"required"`
}

func (s *Service) ListSegmentExports(ctx context.Context, tenantID string, limit int) ([]SegmentExportJob, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := s.db.Query(ctx, `
		SELECT id::text, segment_id::text, segment_name, status, total_rows, object_key, file_url,
		       requested_by::text, started_at::text, completed_at::text, error_message, created_at::text, updated_at::text
		FROM crm_segment_exports
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("list segment exports: %w", err)
	}
	defer rows.Close()

	var items []SegmentExportJob
	for rows.Next() {
		var item SegmentExportJob
		if err := rows.Scan(&item.ID, &item.SegmentID, &item.SegmentName, &item.Status, &item.TotalRows, &item.ObjectKey, &item.FileURL, &item.RequestedBy, &item.StartedAt, &item.CompletedAt, &item.ErrorMessage, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan segment export: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) CreateSegmentExport(ctx context.Context, tenantID, actorID string, input CreateSegmentExportInput) (*SegmentExportJob, error) {
	if s.mc == nil || strings.TrimSpace(s.bucket) == "" || strings.TrimSpace(s.publicURL) == "" {
		return nil, fmt.Errorf("crm export storage is not configured")
	}
	segment, err := s.getSegment(ctx, tenantID, input.SegmentID)
	if err != nil {
		return nil, err
	}
	rawRules, _ := json.Marshal(defaultSegmentRules(segment.Rules))

	var item SegmentExportJob
	if err := s.db.QueryRow(ctx, `
		INSERT INTO crm_segment_exports (
			tenant_id, segment_id, segment_name, segment_rules, status, requested_by, created_at, updated_at
		) VALUES (
			$1::uuid, $2::uuid, $3, $4::jsonb, 'queued', NULLIF($5, '')::uuid, NOW(), NOW()
		)
		RETURNING id::text, segment_id::text, segment_name, status, total_rows, object_key, file_url,
		          requested_by::text, started_at::text, completed_at::text, error_message, created_at::text, updated_at::text
	`, tenantID, segment.ID, segment.Name, string(rawRules), actorID).Scan(
		&item.ID, &item.SegmentID, &item.SegmentName, &item.Status, &item.TotalRows, &item.ObjectKey, &item.FileURL,
		&item.RequestedBy, &item.StartedAt, &item.CompletedAt, &item.ErrorMessage, &item.CreatedAt, &item.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("create segment export: %w", err)
	}
	return &item, nil
}

func (s *Service) ProcessPendingSegmentExports(ctx context.Context) error {
	if s.mc == nil || strings.TrimSpace(s.bucket) == "" || strings.TrimSpace(s.publicURL) == "" {
		return nil
	}
	rows, err := s.db.Query(ctx, `
		SELECT id::text
		FROM crm_segment_exports
		WHERE status = 'queued'
		ORDER BY created_at ASC
		LIMIT 2
	`)
	if err != nil {
		return fmt.Errorf("list queued segment exports: %w", err)
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
		if err := s.processSingleSegmentExport(ctx, id); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) processSingleSegmentExport(ctx context.Context, exportID string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var tenantID string
	var segmentName string
	var rawRules []byte
	tag, err := tx.Exec(ctx, `
		UPDATE crm_segment_exports
		SET status = 'processing', started_at = NOW(), updated_at = NOW(), error_message = NULL
		WHERE id = $1::uuid AND status = 'queued'
	`, exportID)
	if err != nil {
		return fmt.Errorf("mark export processing: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil
	}
	if err := tx.QueryRow(ctx, `
		SELECT tenant_id::text, segment_name, segment_rules
		FROM crm_segment_exports
		WHERE id = $1::uuid
	`, exportID).Scan(&tenantID, &segmentName, &rawRules); err != nil {
		return fmt.Errorf("load processing export: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}

	var rules map[string]any
	if err := json.Unmarshal(rawRules, &rules); err != nil {
		return s.failSegmentExport(ctx, exportID, fmt.Errorf("decode segment rules: %w", err))
	}

	file, err := os.CreateTemp("", "saversure-crm-export-*.csv")
	if err != nil {
		return s.failSegmentExport(ctx, exportID, fmt.Errorf("create temp file: %w", err))
	}
	defer os.Remove(file.Name())

	writer := csv.NewWriter(file)
	headers := []string{
		"user_id", "display_name", "first_name", "last_name", "email", "phone", "province", "status",
		"point_balance", "scan_count_30d", "scan_count_all", "redeem_count_all", "risk_level", "estimated_clv", "last_scan_at",
	}
	if err := writer.Write(headers); err != nil {
		file.Close()
		return s.failSegmentExport(ctx, exportID, fmt.Errorf("write csv header: %w", err))
	}

	baseWhere := customerAudienceBaseWhere()
	clause, args, err := buildSegmentWhereClause(defaultSegmentRules(rules), 2)
	if err != nil {
		file.Close()
		return s.failSegmentExport(ctx, exportID, err)
	}
	where := baseWhere
	if clause != "" {
		where += " AND " + clause
	}
	queryArgs := append([]any{tenantID}, args...)
	query := fmt.Sprintf(`
		SELECT
			u.id::text,
			COALESCE(u.display_name, ''),
			COALESCE(u.first_name, ''),
			COALESCE(u.last_name, ''),
			COALESCE(u.email, ''),
			COALESCE(u.phone, ''),
			COALESCE(u.province, ''),
			COALESCE(u.status, ''),
			COALESCE(r.point_balance, 0)::text,
			COALESCE(r.scan_count_30d, 0)::text,
			COALESCE(r.scan_count_all, 0)::text,
			COALESCE(r.redeem_count_all, 0)::text,
			COALESCE(r.risk_level, 'normal'),
			COALESCE(r.estimated_clv, 0)::text,
			COALESCE(r.last_scan_at::text, '')
		FROM users u
		LEFT JOIN customer_rfm_snapshots r ON r.tenant_id = u.tenant_id AND r.user_id = u.id
		WHERE %s
		ORDER BY COALESCE(r.estimated_clv, 0) DESC, COALESCE(r.point_balance, 0) DESC, u.created_at DESC
	`, where)
	rows, err := s.db.Query(ctx, query, queryArgs...)
	if err != nil {
		file.Close()
		return s.failSegmentExport(ctx, exportID, fmt.Errorf("query export audience: %w", err))
	}
	defer rows.Close()

	totalRows := 0
	for rows.Next() {
		record := make([]string, 15)
		if err := rows.Scan(
			&record[0], &record[1], &record[2], &record[3], &record[4], &record[5], &record[6], &record[7],
			&record[8], &record[9], &record[10], &record[11], &record[12], &record[13], &record[14],
		); err != nil {
			file.Close()
			return s.failSegmentExport(ctx, exportID, fmt.Errorf("scan export row: %w", err))
		}
		if err := writer.Write(record); err != nil {
			file.Close()
			return s.failSegmentExport(ctx, exportID, fmt.Errorf("write export row: %w", err))
		}
		totalRows++
	}
	if err := rows.Err(); err != nil {
		file.Close()
		return s.failSegmentExport(ctx, exportID, fmt.Errorf("iterate export rows: %w", err))
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		file.Close()
		return s.failSegmentExport(ctx, exportID, fmt.Errorf("flush export csv: %w", err))
	}

	if _, err := file.Seek(0, 0); err != nil {
		file.Close()
		return s.failSegmentExport(ctx, exportID, fmt.Errorf("rewind export file: %w", err))
	}
	info, err := file.Stat()
	if err != nil {
		file.Close()
		return s.failSegmentExport(ctx, exportID, fmt.Errorf("stat export file: %w", err))
	}
	objectKey := fmt.Sprintf("exports/crm/%s/%s/%s-%s.csv", tenantID, time.Now().Format("2006/01"), uuid.NewString(), sanitizeExportFileName(segmentName))
	if _, err := s.mc.PutObject(ctx, s.bucket, objectKey, file, info.Size(), minio.PutObjectOptions{ContentType: "text/csv"}); err != nil {
		file.Close()
		return s.failSegmentExport(ctx, exportID, fmt.Errorf("upload crm export: %w", err))
	}
	_ = file.Close()

	fileURL := fmt.Sprintf("%s/%s/%s", strings.TrimRight(s.publicURL, "/"), s.bucket, objectKey)
	if _, err := s.db.Exec(ctx, `
		UPDATE crm_segment_exports
		SET status = 'completed',
		    total_rows = $2,
		    object_key = $3,
		    file_url = $4,
		    completed_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1::uuid
	`, exportID, totalRows, objectKey, fileURL); err != nil {
		return fmt.Errorf("complete segment export: %w", err)
	}
	return nil
}

func (s *Service) failSegmentExport(ctx context.Context, exportID string, err error) error {
	msg := err.Error()
	_, _ = s.db.Exec(ctx, `
		UPDATE crm_segment_exports
		SET status = 'failed', error_message = $2, completed_at = NOW(), updated_at = NOW()
		WHERE id = $1::uuid
	`, exportID, msg)
	return err
}

func sanitizeExportFileName(name string) string {
	value := strings.ToLower(strings.TrimSpace(name))
	value = strings.ReplaceAll(value, " ", "-")
	value = strings.ReplaceAll(value, "/", "-")
	value = strings.ReplaceAll(value, "\\", "-")
	if value == "" {
		return "segment"
	}
	return value
}

func (s *Service) RunSegmentExportsNow(ctx context.Context) error {
	return s.ProcessPendingSegmentExports(ctx)
}
