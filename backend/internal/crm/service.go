package crm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db         *pgxpool.Pool
	httpClient *http.Client
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{
		db:         db,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

type Tag struct {
	ID        string         `json:"id"`
	TenantID  string         `json:"tenant_id"`
	Name      string         `json:"name"`
	Color     string         `json:"color"`
	AutoRule  map[string]any `json:"auto_rule,omitempty"`
	CreatedAt string         `json:"created_at"`
	UpdatedAt string         `json:"updated_at"`
}

type TagInput struct {
	Name     string         `json:"name" binding:"required"`
	Color    string         `json:"color"`
	AutoRule map[string]any `json:"auto_rule"`
}

type Segment struct {
	ID          string         `json:"id"`
	TenantID    string         `json:"tenant_id"`
	Name        string         `json:"name"`
	Description *string        `json:"description"`
	Rules       map[string]any `json:"rules"`
	CachedCount int            `json:"cached_count"`
	CachedAt    *string        `json:"cached_at"`
	CreatedAt   string         `json:"created_at"`
	UpdatedAt   string         `json:"updated_at"`
}

type SegmentInput struct {
	Name        string         `json:"name" binding:"required"`
	Description string         `json:"description"`
	Rules       map[string]any `json:"rules" binding:"required"`
}

type SegmentPreviewCustomer struct {
	ID           string  `json:"id"`
	DisplayName  *string `json:"display_name"`
	FirstName    *string `json:"first_name"`
	LastName     *string `json:"last_name"`
	Email        *string `json:"email"`
	Phone        *string `json:"phone"`
	Province     *string `json:"province"`
	Status       string  `json:"status"`
	PointBalance int     `json:"point_balance"`
	ScanCount30d int     `json:"scan_count_30d"`
	ScanCountAll int     `json:"scan_count_all"`
	RiskLevel    string  `json:"risk_level"`
	LastScanAt   *string `json:"last_scan_at"`
}

type RFMSnapshot struct {
	UserID        string  `json:"user_id"`
	DisplayName   *string `json:"display_name"`
	FirstName     *string `json:"first_name"`
	LastName      *string `json:"last_name"`
	Email         *string `json:"email"`
	Phone         *string `json:"phone"`
	Province      *string `json:"province"`
	Status        string  `json:"status"`
	LastScanAt    *string `json:"last_scan_at"`
	ScanCount30d  int     `json:"scan_count_30d"`
	ScanCountAll  int     `json:"scan_count_all"`
	PointsEarned  int     `json:"points_earned_all"`
	PointsSpent   int     `json:"points_spent_all"`
	PointBalance  int     `json:"point_balance"`
	RedeemCount   int     `json:"redeem_count_all"`
	RFMScore      *string `json:"rfm_score"`
	RiskLevel     string  `json:"risk_level"`
	RefreshedAt   string  `json:"refreshed_at"`
}

type RFMDistributionItem struct {
	RiskLevel string `json:"risk_level"`
	Count     int64  `json:"count"`
}

func committedRedemptionStatuses() string {
	return "'CONFIRMED','SHIPPING','SHIPPED','COMPLETED'"
}

func customerAudienceBaseWhere() string {
	return "u.tenant_id = $1 AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.tenant_id = u.tenant_id AND ur.role = 'api_client')"
}

func nilIfEmpty(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

func defaultSegmentRules(rules map[string]any) map[string]any {
	if len(rules) == 0 {
		return map[string]any{
			"operator":   "AND",
			"conditions": []any{},
		}
	}
	return rules
}

func normalizeTagColor(color string) string {
	value := strings.TrimSpace(color)
	if value == "" {
		return "#6366f1"
	}
	return value
}

func normalizeOperator(value any) string {
	op := strings.ToUpper(strings.TrimSpace(fmt.Sprint(value)))
	if op == "OR" {
		return "OR"
	}
	return "AND"
}

func conditionStringValue(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func conditionFloatValue(value any) (float64, error) {
	switch v := value.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case int32:
		return float64(v), nil
	case json.Number:
		return v.Float64()
	default:
		return 0, fmt.Errorf("invalid numeric value")
	}
}

func conditionStringSlice(value any) []string {
	switch v := value.(type) {
	case []any:
		out := make([]string, 0, len(v))
		for _, item := range v {
			s := conditionStringValue(item)
			if s != "" {
				out = append(out, s)
			}
		}
		return out
	case []string:
		out := make([]string, 0, len(v))
		for _, item := range v {
			if strings.TrimSpace(item) != "" {
				out = append(out, strings.TrimSpace(item))
			}
		}
		return out
	default:
		s := conditionStringValue(value)
		if s == "" {
			return nil
		}
		return []string{s}
	}
}

func buildSegmentWhereClause(rules map[string]any, startArg int) (string, []any, error) {
	conditionsRaw, ok := rules["conditions"].([]any)
	if !ok || len(conditionsRaw) == 0 {
		return "TRUE", nil, nil
	}

	operator := normalizeOperator(rules["operator"])
	parts := make([]string, 0, len(conditionsRaw))
	args := make([]any, 0, len(conditionsRaw))
	argN := startArg

	for _, rawCondition := range conditionsRaw {
		cond, ok := rawCondition.(map[string]any)
		if !ok {
			continue
		}
		field := strings.TrimSpace(fmt.Sprint(cond["field"]))
		op := strings.TrimSpace(strings.ToLower(fmt.Sprint(cond["op"])))
		value := cond["value"]

		switch field {
		case "point_balance", "scan_count_30d", "scan_count_all", "redeem_count_all":
			num, err := conditionFloatValue(value)
			if err != nil {
				return "", nil, fmt.Errorf("invalid condition value for %s", field)
			}
			column := map[string]string{
				"point_balance":    "COALESCE(r.point_balance, 0)",
				"scan_count_30d":   "COALESCE(r.scan_count_30d, 0)",
				"scan_count_all":   "COALESCE(r.scan_count_all, 0)",
				"redeem_count_all": "COALESCE(r.redeem_count_all, 0)",
			}[field]
			switch op {
			case "=", "!=", ">", ">=", "<", "<=":
				parts = append(parts, fmt.Sprintf("%s %s $%d", column, op, argN))
				args = append(args, num)
				argN++
			default:
				return "", nil, fmt.Errorf("unsupported operator %s for %s", op, field)
			}
		case "last_scan_days_ago":
			num, err := conditionFloatValue(value)
			if err != nil {
				return "", nil, fmt.Errorf("invalid condition value for %s", field)
			}
			column := "COALESCE(EXTRACT(EPOCH FROM (NOW() - r.last_scan_at)) / 86400, 999999)"
			switch op {
			case "=", "!=", ">", ">=", "<", "<=":
				parts = append(parts, fmt.Sprintf("%s %s $%d", column, op, argN))
				args = append(args, num)
				argN++
			default:
				return "", nil, fmt.Errorf("unsupported operator %s for %s", op, field)
			}
		case "created_days_ago":
			num, err := conditionFloatValue(value)
			if err != nil {
				return "", nil, fmt.Errorf("invalid condition value for %s", field)
			}
			column := "EXTRACT(EPOCH FROM (NOW() - u.created_at)) / 86400"
			switch op {
			case "=", "!=", ">", ">=", "<", "<=":
				parts = append(parts, fmt.Sprintf("%s %s $%d", column, op, argN))
				args = append(args, num)
				argN++
			default:
				return "", nil, fmt.Errorf("unsupported operator %s for %s", op, field)
			}
		case "province", "status", "risk_level":
			column := map[string]string{
				"province":   "COALESCE(u.province, '')",
				"status":     "u.status",
				"risk_level": "COALESCE(r.risk_level, 'normal')",
			}[field]
			switch op {
			case "=", "!=":
				parts = append(parts, fmt.Sprintf("%s %s $%d", column, op, argN))
				args = append(args, conditionStringValue(value))
				argN++
			case "in", "not_in":
				items := conditionStringSlice(value)
				if len(items) == 0 {
					continue
				}
				if op == "not_in" {
					parts = append(parts, fmt.Sprintf("NOT (%s = ANY($%d))", column, argN))
				} else {
					parts = append(parts, fmt.Sprintf("%s = ANY($%d)", column, argN))
				}
				args = append(args, items)
				argN++
			default:
				return "", nil, fmt.Errorf("unsupported operator %s for %s", op, field)
			}
		case "tag_id":
			if op != "has" && op != "not_has" {
				return "", nil, fmt.Errorf("unsupported operator %s for %s", op, field)
			}
			sub := fmt.Sprintf(`EXISTS (
				SELECT 1 FROM customer_tag_assignments cta
				WHERE cta.tenant_id = u.tenant_id AND cta.user_id = u.id AND cta.tag_id::text = $%d
			)`, argN)
			if op == "not_has" {
				sub = "NOT " + sub
			}
			parts = append(parts, sub)
			args = append(args, conditionStringValue(value))
			argN++
		default:
			return "", nil, fmt.Errorf("unsupported field %s", field)
		}
	}

	if len(parts) == 0 {
		return "TRUE", nil, nil
	}
	return "(" + strings.Join(parts, " "+operator+" ") + ")", args, nil
}

func (s *Service) ListTags(ctx context.Context, tenantID string) ([]Tag, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id::text, tenant_id::text, name, color, COALESCE(auto_rule, '{}'::jsonb)::text, created_at::text, updated_at::text
		 FROM customer_tags
		 WHERE tenant_id = $1
		 ORDER BY name ASC`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("list tags: %w", err)
	}
	defer rows.Close()

	var items []Tag
	for rows.Next() {
		var item Tag
		var rawRule string
		if err := rows.Scan(&item.ID, &item.TenantID, &item.Name, &item.Color, &rawRule, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan tag: %w", err)
		}
		_ = json.Unmarshal([]byte(rawRule), &item.AutoRule)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) CreateTag(ctx context.Context, tenantID string, input TagInput) (*Tag, error) {
	var item Tag
	var rawRule string
	err := s.db.QueryRow(ctx,
		`INSERT INTO customer_tags (tenant_id, name, color, auto_rule, created_at, updated_at)
		 VALUES ($1, $2, $3, COALESCE($4::jsonb, '{}'::jsonb), NOW(), NOW())
		 RETURNING id::text, tenant_id::text, name, color, COALESCE(auto_rule, '{}'::jsonb)::text, created_at::text, updated_at::text`,
		tenantID, strings.TrimSpace(input.Name), normalizeTagColor(input.Color), input.AutoRule,
	).Scan(&item.ID, &item.TenantID, &item.Name, &item.Color, &rawRule, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create tag: %w", err)
	}
	_ = json.Unmarshal([]byte(rawRule), &item.AutoRule)
	return &item, nil
}

func (s *Service) UpdateTag(ctx context.Context, tenantID, id string, input TagInput) (*Tag, error) {
	var item Tag
	var rawRule string
	err := s.db.QueryRow(ctx,
		`UPDATE customer_tags
		 SET name = $3,
		     color = $4,
		     auto_rule = COALESCE($5::jsonb, '{}'::jsonb),
		     updated_at = NOW()
		 WHERE tenant_id = $1 AND id = $2
		 RETURNING id::text, tenant_id::text, name, color, COALESCE(auto_rule, '{}'::jsonb)::text, created_at::text, updated_at::text`,
		tenantID, id, strings.TrimSpace(input.Name), normalizeTagColor(input.Color), input.AutoRule,
	).Scan(&item.ID, &item.TenantID, &item.Name, &item.Color, &rawRule, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("update tag: %w", err)
	}
	_ = json.Unmarshal([]byte(rawRule), &item.AutoRule)
	return &item, nil
}

func (s *Service) DeleteTag(ctx context.Context, tenantID, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM customer_tags WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	if err != nil {
		return fmt.Errorf("delete tag: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("tag not found")
	}
	return nil
}

func (s *Service) ListCustomerTags(ctx context.Context, tenantID, userID string) ([]Tag, error) {
	rows, err := s.db.Query(ctx,
		`SELECT ct.id::text, ct.tenant_id::text, ct.name, ct.color, COALESCE(ct.auto_rule, '{}'::jsonb)::text, ct.created_at::text, ct.updated_at::text
		 FROM customer_tag_assignments cta
		 JOIN customer_tags ct ON ct.id = cta.tag_id
		 WHERE cta.tenant_id = $1 AND cta.user_id = $2
		 ORDER BY ct.name ASC`,
		tenantID, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list customer tags: %w", err)
	}
	defer rows.Close()

	var items []Tag
	for rows.Next() {
		var item Tag
		var rawRule string
		if err := rows.Scan(&item.ID, &item.TenantID, &item.Name, &item.Color, &rawRule, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan customer tag: %w", err)
		}
		_ = json.Unmarshal([]byte(rawRule), &item.AutoRule)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) ReplaceCustomerTags(ctx context.Context, tenantID, userID string, tagIDs []string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin replace customer tags: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM customer_tag_assignments WHERE tenant_id = $1 AND user_id = $2`, tenantID, userID); err != nil {
		return fmt.Errorf("clear customer tags: %w", err)
	}
	for _, tagID := range tagIDs {
		tagID = strings.TrimSpace(tagID)
		if tagID == "" {
			continue
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO customer_tag_assignments (tenant_id, user_id, tag_id, assigned_by, created_at)
			 VALUES ($1, $2, $3, 'admin', NOW())
			 ON CONFLICT (tenant_id, user_id, tag_id) DO NOTHING`,
			tenantID, userID, tagID,
		); err != nil {
			return fmt.Errorf("assign customer tag: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit replace customer tags: %w", err)
	}
	return nil
}

func (s *Service) ListSegments(ctx context.Context, tenantID string) ([]Segment, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id::text, tenant_id::text, name, description, COALESCE(rules, '{}'::jsonb)::text,
		        COALESCE(cached_count, 0), cached_at::text, created_at::text, updated_at::text
		 FROM customer_segments
		 WHERE tenant_id = $1
		 ORDER BY created_at DESC`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("list segments: %w", err)
	}
	defer rows.Close()

	var items []Segment
	for rows.Next() {
		var item Segment
		var rawRules string
		if err := rows.Scan(&item.ID, &item.TenantID, &item.Name, &item.Description, &rawRules, &item.CachedCount, &item.CachedAt, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan segment: %w", err)
		}
		_ = json.Unmarshal([]byte(rawRules), &item.Rules)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) CreateSegment(ctx context.Context, tenantID, createdBy string, input SegmentInput) (*Segment, error) {
	var item Segment
	var rawRules string
	err := s.db.QueryRow(ctx,
		`INSERT INTO customer_segments (tenant_id, name, description, rules, created_by, created_at, updated_at)
		 VALUES ($1, $2, NULLIF($3, ''), $4::jsonb, NULLIF($5, '')::uuid, NOW(), NOW())
		 RETURNING id::text, tenant_id::text, name, description, COALESCE(rules, '{}'::jsonb)::text,
		           COALESCE(cached_count, 0), cached_at::text, created_at::text, updated_at::text`,
		tenantID, strings.TrimSpace(input.Name), input.Description, defaultSegmentRules(input.Rules), createdBy,
	).Scan(&item.ID, &item.TenantID, &item.Name, &item.Description, &rawRules, &item.CachedCount, &item.CachedAt, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create segment: %w", err)
	}
	_ = json.Unmarshal([]byte(rawRules), &item.Rules)
	return &item, nil
}

func (s *Service) UpdateSegment(ctx context.Context, tenantID, id string, input SegmentInput) (*Segment, error) {
	var item Segment
	var rawRules string
	err := s.db.QueryRow(ctx,
		`UPDATE customer_segments
		 SET name = $3,
		     description = NULLIF($4, ''),
		     rules = $5::jsonb,
		     updated_at = NOW()
		 WHERE tenant_id = $1 AND id = $2
		 RETURNING id::text, tenant_id::text, name, description, COALESCE(rules, '{}'::jsonb)::text,
		           COALESCE(cached_count, 0), cached_at::text, created_at::text, updated_at::text`,
		tenantID, id, strings.TrimSpace(input.Name), input.Description, defaultSegmentRules(input.Rules),
	).Scan(&item.ID, &item.TenantID, &item.Name, &item.Description, &rawRules, &item.CachedCount, &item.CachedAt, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("update segment: %w", err)
	}
	_ = json.Unmarshal([]byte(rawRules), &item.Rules)
	return &item, nil
}

func (s *Service) DeleteSegment(ctx context.Context, tenantID, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM customer_segments WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	if err != nil {
		return fmt.Errorf("delete segment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("segment not found")
	}
	return nil
}

func (s *Service) getSegment(ctx context.Context, tenantID, id string) (*Segment, error) {
	var item Segment
	var rawRules string
	err := s.db.QueryRow(ctx,
		`SELECT id::text, tenant_id::text, name, description, COALESCE(rules, '{}'::jsonb)::text,
		        COALESCE(cached_count, 0), cached_at::text, created_at::text, updated_at::text
		 FROM customer_segments
		 WHERE tenant_id = $1 AND id = $2`,
		tenantID, id,
	).Scan(&item.ID, &item.TenantID, &item.Name, &item.Description, &rawRules, &item.CachedCount, &item.CachedAt, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("segment not found: %w", err)
	}
	_ = json.Unmarshal([]byte(rawRules), &item.Rules)
	return &item, nil
}

func (s *Service) PreviewSegment(ctx context.Context, tenantID, id string, limit, offset int) ([]SegmentPreviewCustomer, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	segment, err := s.getSegment(ctx, tenantID, id)
	if err != nil {
		return nil, 0, err
	}

	baseWhere := customerAudienceBaseWhere()
	clause, args, err := buildSegmentWhereClause(segment.Rules, 2)
	if err != nil {
		return nil, 0, err
	}
	where := baseWhere
	if clause != "" {
		where += " AND " + clause
	}

	queryArgs := append([]any{tenantID}, args...)
	var total int64
	countQuery := fmt.Sprintf(
		`SELECT COUNT(*)
		 FROM users u
		 LEFT JOIN customer_rfm_snapshots r ON r.tenant_id = u.tenant_id AND r.user_id = u.id
		 WHERE %s`,
		where,
	)
	if err := s.db.QueryRow(ctx, countQuery, queryArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count segment preview: %w", err)
	}

	listQuery := fmt.Sprintf(
		`SELECT u.id::text, u.display_name, u.first_name, u.last_name, u.email, u.phone, u.province, u.status,
		        COALESCE(r.point_balance, 0),
		        COALESCE(r.scan_count_30d, 0),
		        COALESCE(r.scan_count_all, 0),
		        COALESCE(r.risk_level, 'normal'),
		        r.last_scan_at::text
		 FROM users u
		 LEFT JOIN customer_rfm_snapshots r ON r.tenant_id = u.tenant_id AND r.user_id = u.id
		 WHERE %s
		 ORDER BY COALESCE(r.point_balance, 0) DESC, u.created_at DESC
		 LIMIT $%d OFFSET $%d`,
		where, len(queryArgs)+1, len(queryArgs)+2,
	)
	queryArgs = append(queryArgs, limit, offset)
	rows, err := s.db.Query(ctx, listQuery, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list segment preview: %w", err)
	}
	defer rows.Close()

	var items []SegmentPreviewCustomer
	for rows.Next() {
		var item SegmentPreviewCustomer
		if err := rows.Scan(&item.ID, &item.DisplayName, &item.FirstName, &item.LastName, &item.Email, &item.Phone, &item.Province, &item.Status, &item.PointBalance, &item.ScanCount30d, &item.ScanCountAll, &item.RiskLevel, &item.LastScanAt); err != nil {
			return nil, 0, fmt.Errorf("scan segment preview: %w", err)
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (s *Service) RefreshSegment(ctx context.Context, tenantID, id string) (int64, error) {
	segment, err := s.getSegment(ctx, tenantID, id)
	if err != nil {
		return 0, err
	}
	baseWhere := customerAudienceBaseWhere()
	clause, args, err := buildSegmentWhereClause(segment.Rules, 2)
	if err != nil {
		return 0, err
	}
	where := baseWhere
	if clause != "" {
		where += " AND " + clause
	}
	queryArgs := append([]any{tenantID}, args...)
	var total int64
	query := fmt.Sprintf(
		`SELECT COUNT(*)
		 FROM users u
		 LEFT JOIN customer_rfm_snapshots r ON r.tenant_id = u.tenant_id AND r.user_id = u.id
		 WHERE %s`,
		where,
	)
	if err := s.db.QueryRow(ctx, query, queryArgs...).Scan(&total); err != nil {
		return 0, fmt.Errorf("refresh segment count: %w", err)
	}
	if _, err := s.db.Exec(ctx,
		`UPDATE customer_segments SET cached_count = $3, cached_at = NOW(), updated_at = NOW()
		 WHERE tenant_id = $1 AND id = $2`,
		tenantID, id, total,
	); err != nil {
		return 0, fmt.Errorf("update segment cache: %w", err)
	}
	return total, nil
}

func (s *Service) RefreshRFMSnapshots(ctx context.Context, tenantID string) error {
	// สร้าง snapshot จากข้อมูลที่ sync มาไว้ใน V2 แล้วเท่านั้น เพื่อลดการ query ไป V1/AWS
	_, err := s.db.Exec(ctx, `
WITH customers AS (
	SELECT u.id, u.tenant_id, u.created_at
	FROM users u
	WHERE u.tenant_id = $1
	  AND EXISTS (
		SELECT 1 FROM user_roles ur
		WHERE ur.user_id = u.id AND ur.tenant_id = u.tenant_id AND ur.role = 'api_client'
	  )
),
scan_agg AS (
	SELECT sh.tenant_id, sh.user_id,
	       MAX(sh.scanned_at) FILTER (WHERE COALESCE(sh.scan_type, 'success') = 'success') AS last_scan_at,
	       COUNT(*) FILTER (
			WHERE COALESCE(sh.scan_type, 'success') = 'success'
			  AND sh.scanned_at >= NOW() - INTERVAL '30 days'
	       )::int AS scan_count_30d,
	       COUNT(*) FILTER (WHERE COALESCE(sh.scan_type, 'success') = 'success')::int AS scan_count_all,
	       COALESCE(SUM(sh.points_earned) FILTER (WHERE COALESCE(sh.scan_type, 'success') = 'success'), 0)::int AS points_earned_all
	FROM scan_history sh
	WHERE sh.tenant_id = $1
	GROUP BY sh.tenant_id, sh.user_id
),
redeem_agg AS (
	SELECT rr.tenant_id, rr.user_id,
	       COUNT(*) FILTER (WHERE rr.status IN (`+committedRedemptionStatuses()+`))::int AS redeem_count_all,
	       MAX(rr.created_at) FILTER (WHERE rr.status IN (`+committedRedemptionStatuses()+`)) AS last_redeem_at,
	       COALESCE(SUM(r.point_cost) FILTER (WHERE rr.status IN (`+committedRedemptionStatuses()+`)), 0)::int AS points_spent_all
	FROM reward_reservations rr
	JOIN rewards r ON r.id = rr.reward_id
	WHERE rr.tenant_id = $1
	GROUP BY rr.tenant_id, rr.user_id
),
ledger_latest AS (
	SELECT DISTINCT ON (pl.tenant_id, pl.user_id)
	       pl.tenant_id, pl.user_id, pl.balance_after::int AS point_balance
	FROM point_ledger pl
	WHERE pl.tenant_id = $1
	  AND pl.currency = 'point'
	ORDER BY pl.tenant_id, pl.user_id, pl.created_at DESC
),
prepared AS (
	SELECT c.tenant_id,
	       c.id AS user_id,
	       sa.last_scan_at,
	       COALESCE(sa.scan_count_30d, 0) AS scan_count_30d,
	       COALESCE(sa.scan_count_all, 0) AS scan_count_all,
	       COALESCE(sa.points_earned_all, 0) AS points_earned_all,
	       COALESCE(ra.points_spent_all, 0) AS points_spent_all,
	       COALESCE(ll.point_balance, COALESCE(sa.points_earned_all, 0) - COALESCE(ra.points_spent_all, 0), 0) AS point_balance,
	       COALESCE(ra.redeem_count_all, 0) AS redeem_count_all,
	       ra.last_redeem_at
	FROM customers c
	LEFT JOIN scan_agg sa ON sa.tenant_id = c.tenant_id AND sa.user_id = c.id
	LEFT JOIN redeem_agg ra ON ra.tenant_id = c.tenant_id AND ra.user_id = c.id
	LEFT JOIN ledger_latest ll ON ll.tenant_id = c.tenant_id AND ll.user_id = c.id
),
scored AS (
	SELECT p.*,
	       CASE
			WHEN p.last_scan_at IS NULL THEN '1-1-1'
			WHEN p.scan_count_30d >= 10 AND p.point_balance >= 100 THEN '5-5-5'
			WHEN p.scan_count_30d >= 5 THEN '4-4-4'
			WHEN p.scan_count_30d >= 2 THEN '3-3-3'
			WHEN p.scan_count_all >= 1 THEN '2-2-2'
			ELSE '1-1-1'
	       END AS rfm_score,
	       CASE
			WHEN p.last_scan_at IS NOT NULL
			 AND p.last_scan_at >= NOW() - INTERVAL '30 days'
			 AND p.scan_count_30d >= 8
			 AND p.point_balance >= 100
			  THEN 'champion'
			WHEN p.last_scan_at IS NOT NULL
			 AND p.last_scan_at >= NOW() - INTERVAL '45 days'
			 AND p.scan_count_30d >= 4
			  THEN 'loyal'
			WHEN p.last_scan_at IS NOT NULL
			 AND p.last_scan_at >= NOW() - INTERVAL '30 days'
			  THEN 'potential'
			WHEN p.last_scan_at IS NOT NULL
			 AND p.last_scan_at < NOW() - INTERVAL '60 days'
			 AND p.last_scan_at >= NOW() - INTERVAL '120 days'
			  THEN 'at_risk'
			WHEN p.last_scan_at IS NOT NULL
			 AND p.last_scan_at < NOW() - INTERVAL '120 days'
			 AND p.last_scan_at >= NOW() - INTERVAL '180 days'
			  THEN 'hibernating'
			WHEN p.last_scan_at IS NOT NULL
			 AND p.last_scan_at < NOW() - INTERVAL '180 days'
			  THEN 'lost'
			ELSE 'normal'
	       END AS risk_level
	FROM prepared p
)
INSERT INTO customer_rfm_snapshots (
	tenant_id, user_id, last_scan_at, scan_count_30d, scan_count_all, points_earned_all,
	points_spent_all, point_balance, redeem_count_all, last_redeem_at, rfm_score, risk_level, refreshed_at
)
SELECT tenant_id, user_id, last_scan_at, scan_count_30d, scan_count_all, points_earned_all,
	   points_spent_all, point_balance, redeem_count_all, last_redeem_at, rfm_score, risk_level, NOW()
FROM scored
ON CONFLICT (tenant_id, user_id)
DO UPDATE SET
	last_scan_at = EXCLUDED.last_scan_at,
	scan_count_30d = EXCLUDED.scan_count_30d,
	scan_count_all = EXCLUDED.scan_count_all,
	points_earned_all = EXCLUDED.points_earned_all,
	points_spent_all = EXCLUDED.points_spent_all,
	point_balance = EXCLUDED.point_balance,
	redeem_count_all = EXCLUDED.redeem_count_all,
	last_redeem_at = EXCLUDED.last_redeem_at,
	rfm_score = EXCLUDED.rfm_score,
	risk_level = EXCLUDED.risk_level,
	refreshed_at = NOW()
`, tenantID)
	if err != nil {
		return fmt.Errorf("refresh rfm snapshots: %w", err)
	}

	_, _ = s.db.Exec(ctx,
		`DELETE FROM customer_rfm_snapshots
		 WHERE tenant_id = $1
		   AND NOT EXISTS (
			SELECT 1 FROM users u
			WHERE u.id = customer_rfm_snapshots.user_id
			  AND u.tenant_id = customer_rfm_snapshots.tenant_id
			  AND EXISTS (
				SELECT 1 FROM user_roles ur
				WHERE ur.user_id = u.id AND ur.tenant_id = u.tenant_id AND ur.role = 'api_client'
			  )
		   )`,
		tenantID,
	)
	return nil
}

func (s *Service) ListRFMSnapshots(ctx context.Context, tenantID, riskLevel string, limit, offset int) ([]RFMSnapshot, int64, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	args := []any{tenantID}
	where := "u.tenant_id = $1"
	if strings.TrimSpace(riskLevel) != "" {
		where += " AND COALESCE(r.risk_level, 'normal') = $2"
		args = append(args, riskLevel)
	}

	countQuery := fmt.Sprintf(
		`SELECT COUNT(*)
		 FROM customer_rfm_snapshots r
		 JOIN users u ON u.id = r.user_id AND u.tenant_id = r.tenant_id
		 WHERE %s`,
		where,
	)
	var total int64
	if err := s.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count rfm snapshots: %w", err)
	}

	query := fmt.Sprintf(
		`SELECT r.user_id::text, u.display_name, u.first_name, u.last_name, u.email, u.phone, u.province, u.status,
		        r.last_scan_at::text, r.scan_count_30d, r.scan_count_all, r.points_earned_all, r.points_spent_all,
		        r.point_balance, r.redeem_count_all, r.rfm_score, r.risk_level, r.refreshed_at::text
		 FROM customer_rfm_snapshots r
		 JOIN users u ON u.id = r.user_id AND u.tenant_id = r.tenant_id
		 WHERE %s
		 ORDER BY
		   CASE COALESCE(r.risk_level, 'normal')
			 WHEN 'champion' THEN 1
			 WHEN 'loyal' THEN 2
			 WHEN 'potential' THEN 3
			 WHEN 'at_risk' THEN 4
			 WHEN 'hibernating' THEN 5
			 WHEN 'lost' THEN 6
			 ELSE 7
		   END,
		   r.point_balance DESC,
		   r.scan_count_30d DESC
		 LIMIT $%d OFFSET $%d`,
		where, len(args)+1, len(args)+2,
	)
	args = append(args, limit, offset)
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list rfm snapshots: %w", err)
	}
	defer rows.Close()

	var items []RFMSnapshot
	for rows.Next() {
		var item RFMSnapshot
		if err := rows.Scan(&item.UserID, &item.DisplayName, &item.FirstName, &item.LastName, &item.Email, &item.Phone, &item.Province, &item.Status, &item.LastScanAt, &item.ScanCount30d, &item.ScanCountAll, &item.PointsEarned, &item.PointsSpent, &item.PointBalance, &item.RedeemCount, &item.RFMScore, &item.RiskLevel, &item.RefreshedAt); err != nil {
			return nil, 0, fmt.Errorf("scan rfm snapshot: %w", err)
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (s *Service) GetRFMDistribution(ctx context.Context, tenantID string) ([]RFMDistributionItem, error) {
	rows, err := s.db.Query(ctx,
		`SELECT COALESCE(risk_level, 'normal') AS risk_level, COUNT(*)::bigint
		 FROM customer_rfm_snapshots
		 WHERE tenant_id = $1
		 GROUP BY COALESCE(risk_level, 'normal')
		 ORDER BY COUNT(*) DESC, risk_level ASC`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("get rfm distribution: %w", err)
	}
	defer rows.Close()

	var items []RFMDistributionItem
	for rows.Next() {
		var item RFMDistributionItem
		if err := rows.Scan(&item.RiskLevel, &item.Count); err != nil {
			return nil, fmt.Errorf("scan rfm distribution: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) TouchSegmentCaches(ctx context.Context, tenantID string) error {
	rows, err := s.db.Query(ctx, `SELECT id::text FROM customer_segments WHERE tenant_id = $1`, tenantID)
	if err != nil {
		return fmt.Errorf("list segments for refresh: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var segmentID string
		if err := rows.Scan(&segmentID); err != nil {
			return err
		}
		if _, err := s.RefreshSegment(ctx, tenantID, segmentID); err != nil && !strings.Contains(err.Error(), "segment not found") {
			return err
		}
	}
	return rows.Err()
}

func (s *Service) EnsureRFMSnapshots(ctx context.Context, tenantID string) error {
	var refreshedAt *time.Time
	err := s.db.QueryRow(ctx,
		`SELECT MAX(refreshed_at) FROM customer_rfm_snapshots WHERE tenant_id = $1`,
		tenantID,
	).Scan(&refreshedAt)
	if err != nil && err != pgx.ErrNoRows {
		return fmt.Errorf("check rfm snapshots: %w", err)
	}
	if refreshedAt != nil && time.Since(*refreshedAt) < 6*time.Hour {
		return nil
	}
	return s.RefreshRFMSnapshots(ctx, tenantID)
}
