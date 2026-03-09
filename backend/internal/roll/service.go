package roll

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrRollNotFound           = errors.New("roll not found")
	ErrInvalidTransition      = errors.New("invalid status transition")
	ErrProductRequired        = errors.New("product_id is required for mapping")
	ErrEvidenceRequired       = errors.New("at least one evidence file is required for QC approval")
	ErrSamePersonQC           = errors.New("QC reviewer must be a different person from the mapper")
	ErrCannotUnmap            = errors.New("can only unmap rolls in 'mapped' or 'qc_rejected' status")
	ErrRejectReasonRequired   = errors.New("rejection reason is required")
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

type Roll struct {
	ID                string   `json:"id"`
	TenantID          string   `json:"tenant_id"`
	BatchID           string   `json:"batch_id"`
	RollNumber        int      `json:"roll_number"`
	SerialStart       int64    `json:"serial_start"`
	SerialEnd         int64    `json:"serial_end"`
	CodeCount         int      `json:"code_count"`
	Status            string   `json:"status"`
	ProductID         *string  `json:"product_id"`
	FactoryID         *string  `json:"factory_id"`
	MappedBy          *string  `json:"mapped_by"`
	MappedAt          *string  `json:"mapped_at"`
	MappingEvidence   []string `json:"mapping_evidence_urls"`
	MappingNote       *string  `json:"mapping_note"`
	QCBy              *string  `json:"qc_by"`
	QCAt              *string  `json:"qc_at"`
	QCNote            *string  `json:"qc_note"`
	QCEvidence        []string `json:"qc_evidence_urls"`
	DistributedAt     *string  `json:"distributed_at"`
	CreatedAt         string   `json:"created_at"`
	BatchPrefix       *string  `json:"batch_prefix,omitempty"`
	ProductName       *string  `json:"product_name,omitempty"`
	ProductSKU        *string  `json:"product_sku,omitempty"`
	FactoryName       *string  `json:"factory_name,omitempty"`
	MappedByName      *string  `json:"mapped_by_name,omitempty"`
	QCByName          *string  `json:"qc_by_name,omitempty"`
}

type ListFilter struct {
	Status    string
	BatchID   string
	ProductID string
	FactoryID string
	Mapped    string // "true" = mapped only, "false" = unmapped only, "" = all
	QCBy      string
	Search    string
	SortBy    string
	SortOrder string // "asc" or "desc"
	Limit     int
	Offset    int
}

var allowedSortColumns = map[string]string{
	"roll_number":  "r.roll_number",
	"status":       "r.status",
	"created_at":   "r.created_at",
	"factory_name": "f.name",
	"product_name": "p.name",
	"mapped_at":    "r.mapped_at",
}

type AssignInput struct {
	FactoryID string `json:"factory_id" binding:"required"`
}

type Stats struct {
	PendingPrint int64 `json:"pending_print"`
	Printed      int64 `json:"printed"`
	Mapped       int64 `json:"mapped"`
	QCApproved   int64 `json:"qc_approved"`
	QCRejected   int64 `json:"qc_rejected"`
	Distributed  int64 `json:"distributed"`
	Recalled     int64 `json:"recalled"`
	Total        int64 `json:"total"`
}

var ErrFactoryRequired = errors.New("factory_id is required for mapping")
var ErrMappingEvidenceRequired = errors.New("at least one evidence photo is required for mapping")
var ErrFactoryMismatch = errors.New("this roll is not assigned to your factory")

type MapInput struct {
	ProductID    string   `json:"product_id" binding:"required"`
	FactoryID    string   `json:"factory_id" binding:"required"`
	EvidenceURLs []string `json:"evidence_urls" binding:"required"`
	Note         string   `json:"note"`
}

type QCInput struct {
	Action       string   `json:"action" binding:"required"`
	EvidenceURLs []string `json:"evidence_urls"`
	Note         string   `json:"note"`
}

const rollSelectCols = `r.id, r.tenant_id, r.batch_id, r.roll_number,
	r.serial_start, r.serial_end, r.code_count, r.status,
	r.product_id, r.factory_id,
	r.mapped_by, r.mapped_at::text, r.mapping_evidence_urls, r.mapping_note,
	r.qc_by, r.qc_at::text, r.qc_note, r.qc_evidence_urls,
	r.distributed_at::text, r.created_at::text,
	b.prefix, p.name, p.sku, f.name,
	mu.display_name, qu.display_name`

const rollJoins = `FROM rolls r
	JOIN batches b ON b.id = r.batch_id
	LEFT JOIN products p ON p.id = r.product_id
	LEFT JOIN factories f ON f.id = r.factory_id
	LEFT JOIN users mu ON mu.id = r.mapped_by
	LEFT JOIN users qu ON qu.id = r.qc_by`

func scanRoll(row pgx.Row) (*Roll, error) {
	var r Roll
	err := row.Scan(
		&r.ID, &r.TenantID, &r.BatchID, &r.RollNumber,
		&r.SerialStart, &r.SerialEnd, &r.CodeCount, &r.Status,
		&r.ProductID, &r.FactoryID,
		&r.MappedBy, &r.MappedAt, &r.MappingEvidence, &r.MappingNote,
		&r.QCBy, &r.QCAt, &r.QCNote, &r.QCEvidence,
		&r.DistributedAt, &r.CreatedAt,
		&r.BatchPrefix, &r.ProductName, &r.ProductSKU, &r.FactoryName,
		&r.MappedByName, &r.QCByName,
	)
	if err != nil {
		return nil, err
	}
	if r.MappingEvidence == nil {
		r.MappingEvidence = []string{}
	}
	if r.QCEvidence == nil {
		r.QCEvidence = []string{}
	}
	return &r, nil
}

func (s *Service) List(ctx context.Context, tenantID string, f ListFilter) ([]Roll, int64, error) {
	if f.Limit <= 0 {
		f.Limit = 50
	}

	where := "r.tenant_id = $1"
	args := []any{tenantID}
	argN := 2

	if f.Status != "" {
		where += fmt.Sprintf(" AND r.status = $%d", argN)
		args = append(args, f.Status)
		argN++
	}
	if f.BatchID != "" {
		where += fmt.Sprintf(" AND r.batch_id = $%d", argN)
		args = append(args, f.BatchID)
		argN++
	}
	if f.ProductID != "" {
		where += fmt.Sprintf(" AND r.product_id = $%d", argN)
		args = append(args, f.ProductID)
		argN++
	}
	if f.FactoryID != "" {
		where += fmt.Sprintf(" AND r.factory_id = $%d", argN)
		args = append(args, f.FactoryID)
		argN++
	}
	if f.Mapped == "true" {
		where += " AND r.product_id IS NOT NULL"
	} else if f.Mapped == "false" {
		where += " AND r.product_id IS NULL"
	}
	if f.QCBy != "" {
		where += fmt.Sprintf(" AND r.qc_by = $%d", argN)
		args = append(args, f.QCBy)
		argN++
	}
	if f.Search != "" {
		where += fmt.Sprintf(" AND (b.prefix ILIKE '%%' || $%d || '%%' OR CAST(r.roll_number AS TEXT) = $%d)", argN, argN)
		args = append(args, f.Search)
		argN++
	}

	var total int64
	err := s.db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM rolls r WHERE %s", where), args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count rolls: %w", err)
	}

	orderClause := "b.prefix, r.roll_number"
	if col, ok := allowedSortColumns[f.SortBy]; ok {
		dir := "ASC"
		if f.SortOrder == "desc" {
			dir = "DESC"
		}
		orderClause = fmt.Sprintf("%s %s NULLS LAST", col, dir)
	}

	query := fmt.Sprintf(
		`SELECT %s %s WHERE %s ORDER BY %s LIMIT $%d OFFSET $%d`,
		rollSelectCols, rollJoins, where, orderClause, argN, argN+1,
	)
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list rolls: %w", err)
	}
	defer rows.Close()

	var rolls []Roll
	for rows.Next() {
		r, err := scanRoll(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan roll: %w", err)
		}
		rolls = append(rolls, *r)
	}
	return rolls, total, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*Roll, error) {
	query := fmt.Sprintf(`SELECT %s %s WHERE r.id = $1 AND r.tenant_id = $2`, rollSelectCols, rollJoins)
	r, err := scanRoll(s.db.QueryRow(ctx, query, id, tenantID))
	if err != nil {
		return nil, ErrRollNotFound
	}
	return r, nil
}

func (s *Service) GetStats(ctx context.Context, tenantID string, factoryID string) (*Stats, error) {
	var st Stats
	var err error
	if factoryID != "" {
		err = s.db.QueryRow(ctx,
			`SELECT
				COUNT(*) FILTER (WHERE status = 'pending_print'),
				COUNT(*) FILTER (WHERE status = 'printed'),
				COUNT(*) FILTER (WHERE status = 'mapped'),
				COUNT(*) FILTER (WHERE status = 'qc_approved'),
				COUNT(*) FILTER (WHERE status = 'qc_rejected'),
				COUNT(*) FILTER (WHERE status = 'distributed'),
				COUNT(*) FILTER (WHERE status = 'recalled'),
				COUNT(*)
			 FROM rolls WHERE tenant_id = $1 AND factory_id = $2`, tenantID, factoryID,
		).Scan(&st.PendingPrint, &st.Printed, &st.Mapped, &st.QCApproved,
			&st.QCRejected, &st.Distributed, &st.Recalled, &st.Total)
	} else {
		err = s.db.QueryRow(ctx,
			`SELECT
				COUNT(*) FILTER (WHERE status = 'pending_print'),
				COUNT(*) FILTER (WHERE status = 'printed'),
				COUNT(*) FILTER (WHERE status = 'mapped'),
				COUNT(*) FILTER (WHERE status = 'qc_approved'),
				COUNT(*) FILTER (WHERE status = 'qc_rejected'),
				COUNT(*) FILTER (WHERE status = 'distributed'),
				COUNT(*) FILTER (WHERE status = 'recalled'),
				COUNT(*)
			 FROM rolls WHERE tenant_id = $1`, tenantID,
		).Scan(&st.PendingPrint, &st.Printed, &st.Mapped, &st.QCApproved,
			&st.QCRejected, &st.Distributed, &st.Recalled, &st.Total)
	}
	if err != nil {
		return nil, fmt.Errorf("get roll stats: %w", err)
	}
	return &st, nil
}

func (s *Service) MapProduct(ctx context.Context, tenantID, rollID, actorID string, input MapInput, role string) (*Roll, error) {
	if input.ProductID == "" {
		return nil, ErrProductRequired
	}
	if input.FactoryID == "" {
		return nil, ErrFactoryRequired
	}
	if len(input.EvidenceURLs) == 0 {
		return nil, ErrMappingEvidenceRequired
	}

	r, err := s.GetByID(ctx, tenantID, rollID)
	if err != nil {
		return nil, err
	}

	// factory_user can only map rolls pre-assigned to their factory
	if role == "factory_user" {
		if r.FactoryID == nil || *r.FactoryID != input.FactoryID {
			return nil, ErrFactoryMismatch
		}
	}

	if r.Status != "printed" && r.Status != "qc_rejected" {
		return nil, ErrInvalidTransition
	}

	var note *string
	if input.Note != "" {
		note = &input.Note
	}

	_, err = s.db.Exec(ctx,
		`UPDATE rolls SET
			product_id = $3, factory_id = $4, mapped_by = $5,
			mapped_at = NOW(), status = 'mapped',
			mapping_evidence_urls = $6, mapping_note = $7,
			qc_by = NULL, qc_at = NULL, qc_note = NULL, qc_evidence_urls = '{}',
			updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2`,
		rollID, tenantID, input.ProductID, input.FactoryID, actorID, input.EvidenceURLs, note,
	)
	if err != nil {
		return nil, fmt.Errorf("map product: %w", err)
	}

	return s.GetByID(ctx, tenantID, rollID)
}

func (s *Service) Unmap(ctx context.Context, tenantID, rollID string) (*Roll, error) {
	r, err := s.GetByID(ctx, tenantID, rollID)
	if err != nil {
		return nil, err
	}

	if r.Status != "mapped" && r.Status != "qc_rejected" {
		return nil, ErrCannotUnmap
	}

	_, err = s.db.Exec(ctx,
		`UPDATE rolls SET
			product_id = NULL, factory_id = NULL,
			mapped_by = NULL, mapped_at = NULL,
			mapping_evidence_urls = NULL, mapping_note = NULL,
			qc_by = NULL, qc_at = NULL, qc_note = NULL, qc_evidence_urls = '{}',
			status = 'printed', updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2`,
		rollID, tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("unmap: %w", err)
	}

	return s.GetByID(ctx, tenantID, rollID)
}

func (s *Service) QCReview(ctx context.Context, tenantID, rollID, actorID string, input QCInput) (*Roll, error) {
	r, err := s.GetByID(ctx, tenantID, rollID)
	if err != nil {
		return nil, err
	}

	if r.Status != "mapped" {
		return nil, ErrInvalidTransition
	}

	switch input.Action {
	case "approve":
		// รูปหลักฐานของ QC เป็น optional — QC ดูจากรูปที่โรงงาน map มาแล้วตัดสินใจ
		if r.MappedBy != nil && *r.MappedBy == actorID {
			return nil, ErrSamePersonQC
		}
		_, err = s.db.Exec(ctx,
			`UPDATE rolls SET
				qc_by = $3, qc_at = NOW(), qc_note = $4,
				qc_evidence_urls = $5, status = 'qc_approved', updated_at = NOW()
			 WHERE id = $1 AND tenant_id = $2`,
			rollID, tenantID, actorID, input.Note, input.EvidenceURLs,
		)
	case "reject":
		if input.Note == "" {
			return nil, ErrRejectReasonRequired
		}
		_, err = s.db.Exec(ctx,
			`UPDATE rolls SET
				qc_by = $3, qc_at = NOW(), qc_note = $4,
				qc_evidence_urls = $5, status = 'qc_rejected', updated_at = NOW()
			 WHERE id = $1 AND tenant_id = $2`,
			rollID, tenantID, actorID, input.Note, input.EvidenceURLs,
		)
	default:
		return nil, fmt.Errorf("invalid QC action: %s (must be 'approve' or 'reject')", input.Action)
	}

	if err != nil {
		return nil, fmt.Errorf("qc review: %w", err)
	}

	return s.GetByID(ctx, tenantID, rollID)
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, rollID, status string) (*Roll, error) {
	validTransitions := map[string][]string{
		"pending_print": {"printed"},
		"qc_approved":   {"distributed"},
	}

	r, err := s.GetByID(ctx, tenantID, rollID)
	if err != nil {
		return nil, err
	}

	allowed := validTransitions[r.Status]
	valid := false
	for _, s := range allowed {
		if s == status {
			valid = true
			break
		}
	}
	if !valid {
		return nil, fmt.Errorf("%w: cannot transition from '%s' to '%s'", ErrInvalidTransition, r.Status, status)
	}

	extra := ""
	if status == "distributed" {
		extra = ", distributed_at = NOW()"
	}

	_, err = s.db.Exec(ctx,
		fmt.Sprintf(`UPDATE rolls SET status = $3, updated_at = NOW()%s WHERE id = $1 AND tenant_id = $2`, extra),
		rollID, tenantID, status,
	)
	if err != nil {
		return nil, fmt.Errorf("update status: %w", err)
	}

	return s.GetByID(ctx, tenantID, rollID)
}

func (s *Service) BulkMap(ctx context.Context, tenantID, actorID string, rollIDs []string, input MapInput) (int, error) {
	if input.ProductID == "" {
		return 0, ErrProductRequired
	}
	if input.FactoryID == "" {
		return 0, ErrFactoryRequired
	}
	if len(input.EvidenceURLs) == 0 {
		return 0, ErrMappingEvidenceRequired
	}

	var note *string
	if input.Note != "" {
		note = &input.Note
	}

	tag, err := s.db.Exec(ctx,
		`UPDATE rolls SET
			product_id = $3, factory_id = $4, mapped_by = $5,
			mapped_at = NOW(), status = 'mapped',
			mapping_evidence_urls = $6, mapping_note = $7,
			qc_by = NULL, qc_at = NULL, qc_note = NULL, qc_evidence_urls = '{}',
			updated_at = NOW()
		 WHERE tenant_id = $1 AND id = ANY($2)
			AND status IN ('printed', 'qc_rejected')`,
		tenantID, rollIDs, input.ProductID, input.FactoryID, actorID, input.EvidenceURLs, note,
	)
	if err != nil {
		return 0, fmt.Errorf("bulk map: %w", err)
	}

	return int(tag.RowsAffected()), nil
}

// Assign sets the factory_id for a single roll (admin pre-assignment).
func (s *Service) Assign(ctx context.Context, tenantID, rollID string, input AssignInput) (*Roll, error) {
	tag, err := s.db.Exec(ctx,
		`UPDATE rolls SET factory_id = $3, updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2`,
		rollID, tenantID, input.FactoryID,
	)
	if err != nil {
		return nil, fmt.Errorf("assign factory: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, ErrRollNotFound
	}
	return s.GetByID(ctx, tenantID, rollID)
}

// BulkAssign sets the factory_id for multiple rolls (admin pre-assignment).
func (s *Service) BulkAssign(ctx context.Context, tenantID string, rollIDs []string, factoryID string) (int, error) {
	tag, err := s.db.Exec(ctx,
		`UPDATE rolls SET factory_id = $3, updated_at = NOW()
		 WHERE tenant_id = $1 AND id = ANY($2)`,
		tenantID, rollIDs, factoryID,
	)
	if err != nil {
		return 0, fmt.Errorf("bulk assign: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

func (s *Service) BulkUpdateStatus(ctx context.Context, tenantID string, rollIDs []string, status string) (int, error) {
	fromStatus := ""
	extra := ""
	switch status {
	case "printed":
		fromStatus = "pending_print"
	case "distributed":
		fromStatus = "qc_approved"
		extra = ", distributed_at = NOW()"
	default:
		return 0, fmt.Errorf("%w: unsupported bulk status '%s'", ErrInvalidTransition, status)
	}

	tag, err := s.db.Exec(ctx,
		fmt.Sprintf(`UPDATE rolls SET status = $3, updated_at = NOW()%s
		 WHERE tenant_id = $1 AND id = ANY($2) AND status = $4`, extra),
		tenantID, rollIDs, status, fromStatus,
	)
	if err != nil {
		return 0, fmt.Errorf("bulk status: %w", err)
	}

	return int(tag.RowsAffected()), nil
}

// CreateRollsForBatch generates roll records after a batch is created.
func (s *Service) CreateRollsForBatch(ctx context.Context, tx pgx.Tx, tenantID, batchID string, serialStart, serialEnd int64, codesPerRoll int) error {
	totalCodes := serialEnd - serialStart + 1
	rollNum := 1

	for offset := int64(0); offset < totalCodes; offset += int64(codesPerRoll) {
		rStart := serialStart + offset
		rEnd := rStart + int64(codesPerRoll) - 1
		if rEnd > serialEnd {
			rEnd = serialEnd
		}
		count := int(rEnd - rStart + 1)

		_, err := tx.Exec(ctx,
			`INSERT INTO rolls (tenant_id, batch_id, roll_number, serial_start, serial_end, code_count)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			tenantID, batchID, rollNum, rStart, rEnd, count,
		)
		if err != nil {
			return fmt.Errorf("create roll %d: %w", rollNum, err)
		}
		rollNum++
	}

	return nil
}
