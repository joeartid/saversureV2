package donation

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

type Donation struct {
	ID              string  `json:"id"`
	TenantID        string  `json:"tenant_id"`
	Title           string  `json:"title"`
	Description     *string `json:"description"`
	ImageURL        *string `json:"image_url"`
	TargetPoints    int     `json:"target_points"`
	CollectedPoints int     `json:"collected_points"`
	Status          string  `json:"status"`
	StartDate       *string `json:"start_date"`
	EndDate         *string `json:"end_date"`
	CreatedAt       string  `json:"created_at"`
	DonorCount      int     `json:"donor_count,omitempty"`
}

type DonationHistory struct {
	ID         string `json:"id"`
	DonationID string `json:"donation_id"`
	UserID     string `json:"user_id"`
	Points     int    `json:"points"`
	CreatedAt  string `json:"created_at"`
}

type MyDonationEntry struct {
	ID               string  `json:"id"`
	DonationID       string  `json:"donation_id"`
	DonationTitle    string  `json:"donation_title"`
	DonationImageURL *string `json:"donation_image_url"`
	Points           int     `json:"points"`
	CreatedAt        string  `json:"created_at"`
}

type CreateInput struct {
	TenantID     string `json:"-"`
	Title        string `json:"title" binding:"required"`
	Description  string `json:"description"`
	ImageURL     string `json:"image_url"`
	TargetPoints int    `json:"target_points"`
	StartDate    string `json:"start_date"`
	EndDate      string `json:"end_date"`
}

type UpdateInput struct {
	Title        *string `json:"title"`
	Description  *string `json:"description"`
	ImageURL     *string `json:"image_url"`
	TargetPoints *int    `json:"target_points"`
	Status       *string `json:"status"`
	StartDate    *string `json:"start_date"`
	EndDate      *string `json:"end_date"`
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]Donation, int64, error) {
	if limit <= 0 {
		limit = 50
	}

	var total int64
	_ = s.db.QueryRow(ctx, "SELECT COUNT(*) FROM donations WHERE tenant_id = $1", tenantID).Scan(&total)

	rows, err := s.db.Query(ctx,
		`SELECT d.id, d.tenant_id, d.title, d.description, d.image_url, d.target_points,
		        d.collected_points, d.status, d.start_date::text, d.end_date::text, d.created_at::text,
		        (SELECT COUNT(DISTINCT user_id) FROM donation_histories WHERE donation_id = d.id)
		 FROM donations d WHERE d.tenant_id = $1
		 ORDER BY d.created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list donations: %w", err)
	}
	defer rows.Close()

	var items []Donation
	for rows.Next() {
		var d Donation
		if err := rows.Scan(&d.ID, &d.TenantID, &d.Title, &d.Description, &d.ImageURL,
			&d.TargetPoints, &d.CollectedPoints, &d.Status, &d.StartDate, &d.EndDate,
			&d.CreatedAt, &d.DonorCount); err != nil {
			return nil, 0, fmt.Errorf("scan donation: %w", err)
		}
		items = append(items, d)
	}
	return items, total, nil
}

func (s *Service) ListActive(ctx context.Context, tenantID string) ([]Donation, error) {
	rows, err := s.db.Query(ctx,
		`SELECT d.id, d.tenant_id, d.title, d.description, d.image_url, d.target_points,
		        d.collected_points, d.status, d.start_date::text, d.end_date::text, d.created_at::text,
		        (SELECT COUNT(DISTINCT user_id) FROM donation_histories WHERE donation_id = d.id)
		 FROM donations d WHERE d.tenant_id = $1 AND d.status = 'active'
		 ORDER BY d.created_at DESC`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("list active donations: %w", err)
	}
	defer rows.Close()

	var items []Donation
	for rows.Next() {
		var d Donation
		if err := rows.Scan(&d.ID, &d.TenantID, &d.Title, &d.Description, &d.ImageURL,
			&d.TargetPoints, &d.CollectedPoints, &d.Status, &d.StartDate, &d.EndDate,
			&d.CreatedAt, &d.DonorCount); err != nil {
			return nil, fmt.Errorf("scan donation: %w", err)
		}
		items = append(items, d)
	}
	return items, nil
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Donation, error) {
	var d Donation
	err := s.db.QueryRow(ctx,
		`INSERT INTO donations (tenant_id, title, description, image_url, target_points,
		        start_date, end_date)
		 VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), $5,
		        CASE WHEN $6 = '' THEN NULL ELSE $6::timestamptz END,
		        CASE WHEN $7 = '' THEN NULL ELSE $7::timestamptz END)
		 RETURNING id, tenant_id, title, description, image_url, target_points,
		        collected_points, status, start_date::text, end_date::text, created_at::text`,
		input.TenantID, input.Title, input.Description, input.ImageURL, input.TargetPoints,
		input.StartDate, input.EndDate,
	).Scan(&d.ID, &d.TenantID, &d.Title, &d.Description, &d.ImageURL,
		&d.TargetPoints, &d.CollectedPoints, &d.Status, &d.StartDate, &d.EndDate, &d.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create donation: %w", err)
	}
	return &d, nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, input UpdateInput) (*Donation, error) {
	if input.Title != nil {
		s.db.Exec(ctx, `UPDATE donations SET title = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.Title)
	}
	if input.Description != nil {
		s.db.Exec(ctx, `UPDATE donations SET description = NULLIF($3,''), updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.Description)
	}
	if input.ImageURL != nil {
		s.db.Exec(ctx, `UPDATE donations SET image_url = NULLIF($3,''), updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.ImageURL)
	}
	if input.TargetPoints != nil {
		s.db.Exec(ctx, `UPDATE donations SET target_points = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.TargetPoints)
	}
	if input.Status != nil {
		valid := map[string]bool{"active": true, "ended": true, "cancelled": true}
		if !valid[*input.Status] {
			return nil, fmt.Errorf("invalid status: %s", *input.Status)
		}
		s.db.Exec(ctx, `UPDATE donations SET status = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.Status)
	}

	var d Donation
	err := s.db.QueryRow(ctx,
		`SELECT id, tenant_id, title, description, image_url, target_points, collected_points, status,
		        start_date::text, end_date::text, created_at::text
		 FROM donations WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	).Scan(&d.ID, &d.TenantID, &d.Title, &d.Description, &d.ImageURL,
		&d.TargetPoints, &d.CollectedPoints, &d.Status, &d.StartDate, &d.EndDate, &d.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("donation not found: %w", err)
	}
	return &d, nil
}

func (s *Service) Donate(ctx context.Context, tenantID, donationID, userID string, points int) (*DonationHistory, error) {
	if points <= 0 {
		return nil, fmt.Errorf("points must be positive")
	}

	var status string
	var title string
	err := s.db.QueryRow(ctx, `SELECT status, title FROM donations WHERE id = $1 AND tenant_id = $2`, donationID, tenantID).Scan(&status, &title)
	if err != nil {
		return nil, fmt.Errorf("donation not found: %w", err)
	}
	if status != "active" {
		return nil, fmt.Errorf("donation is not active")
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// User lock to prevent race conditions on balance deduction
	var dummy int
	err = tx.QueryRow(ctx, `SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, userID).Scan(&dummy)
	if err != nil {
		return nil, fmt.Errorf("lock user: %w", err)
	}

	var balance int
	_ = tx.QueryRow(ctx,
		`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)
		 FROM point_ledger WHERE user_id = $1 AND currency = 'point'`, userID,
	).Scan(&balance)
	if balance < points {
		return nil, fmt.Errorf("insufficient points (need %d, have %d)", points, balance)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO point_ledger (user_id, tenant_id, entry_type, amount, balance_after, reference_type, reference_id, currency)
		 VALUES ($1, $2, 'debit', $3, $4, 'donation', $5, 'point')`,
		userID, tenantID, points, balance-points, donationID,
	)
	if err != nil {
		return nil, fmt.Errorf("deduct points: %w", err)
	}

	_, err = tx.Exec(ctx,
		`UPDATE donations SET collected_points = collected_points + $2, updated_at = NOW() WHERE id = $1`,
		donationID, points,
	)
	if err != nil {
		return nil, fmt.Errorf("update collected: %w", err)
	}

	var h DonationHistory
	err = tx.QueryRow(ctx,
		`INSERT INTO donation_histories (donation_id, user_id, tenant_id, points)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, donation_id, user_id, points, created_at::text`,
		donationID, userID, tenantID, points,
	).Scan(&h.ID, &h.DonationID, &h.UserID, &h.Points, &h.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create history: %w", err)
	}

	// Insert notification
	notifBody := fmt.Sprintf("คุณได้ร่วมบริจาค %d แต้ม ให้โครงการ %s สำเร็จแล้ว", points, title)
	_, err = tx.Exec(ctx,
		`INSERT INTO notifications (tenant_id, user_id, type, title, body, ref_type, ref_id)
		 VALUES ($1, $2, 'campaign', 'ร่วมบริจาคสำเร็จ', $3, 'donation', $4)`,
		tenantID, userID, notifBody, donationID,
	)
	if err != nil {
		return nil, fmt.Errorf("create notification: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return &h, nil
}

func (s *Service) GetMyDonations(ctx context.Context, userID string, limit, offset int) ([]MyDonationEntry, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.Query(ctx,
		`SELECT dh.id, dh.donation_id, d.title, d.image_url, dh.points, dh.created_at::text
		 FROM donation_histories dh
		 JOIN donations d ON d.id = dh.donation_id
		 WHERE dh.user_id = $1
		 ORDER BY dh.created_at DESC LIMIT $2 OFFSET $3`,
		userID, limit, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("list my donations: %w", err)
	}
	defer rows.Close()

	var items []MyDonationEntry
	for rows.Next() {
		var e MyDonationEntry
		if err := rows.Scan(&e.ID, &e.DonationID, &e.DonationTitle, &e.DonationImageURL, &e.Points, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan my donation: %w", err)
		}
		items = append(items, e)
	}
	return items, nil
}

func (s *Service) GetHistory(ctx context.Context, donationID string, limit, offset int) ([]DonationHistory, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.Query(ctx,
		`SELECT id, donation_id, user_id, points, created_at::text
		 FROM donation_histories WHERE donation_id = $1
		 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
		donationID, limit, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("list history: %w", err)
	}
	defer rows.Close()

	var items []DonationHistory
	for rows.Next() {
		var h DonationHistory
		if err := rows.Scan(&h.ID, &h.DonationID, &h.UserID, &h.Points, &h.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan history: %w", err)
		}
		items = append(items, h)
	}
	return items, nil
}
