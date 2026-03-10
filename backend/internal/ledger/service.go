package ledger

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

type Entry struct {
	ID            string     `json:"id"`
	TenantID      string     `json:"tenant_id"`
	UserID        string     `json:"user_id"`
	CampaignID    *string    `json:"campaign_id,omitempty"`
	EntryType     string     `json:"entry_type"`
	Amount        int        `json:"amount"`
	BalanceAfter  int        `json:"balance_after"`
	Currency      string     `json:"currency"`
	ReferenceType *string    `json:"reference_type,omitempty"`
	ReferenceID   *string    `json:"reference_id,omitempty"`
	Description   *string    `json:"description"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	ExpiryAction  *string    `json:"expiry_action,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

type Balance struct {
	UserID       string `json:"user_id"`
	TenantID     string `json:"tenant_id"`
	TotalEarned  int    `json:"total_earned"`
	TotalSpent   int    `json:"total_spent"`
	TotalExpired int    `json:"total_expired"`
	Current      int    `json:"current"`
}

// Credit adds points to a user's ledger (append-only). No expiry.
func (s *Service) Credit(ctx context.Context, tx pgx.Tx, tenantID, userID, campaignID string, amount int, refType, refID, description, currency string) error {
	return s.CreditWithExpiry(ctx, tx, tenantID, userID, campaignID, amount, refType, refID, description, currency, nil, "", "")
}

// CreditWithExpiry adds points/currency with optional expiry tracking per ledger entry.
func (s *Service) CreditWithExpiry(ctx context.Context, tx pgx.Tx, tenantID, userID, campaignID string, amount int, refType, refID, description, currency string, expiresAt *time.Time, expiryAction, sourcePromotionID string) error {
	if currency == "" {
		currency = "point"
	}

	var campaignPtr, expiryActionPtr, promoIDPtr *string
	if campaignID != "" {
		campaignPtr = &campaignID
	}
	if expiryAction != "" {
		expiryActionPtr = &expiryAction
	}
	if sourcePromotionID != "" {
		promoIDPtr = &sourcePromotionID
	}

	_, err := tx.Exec(ctx,
		`INSERT INTO point_ledger
			(tenant_id, user_id, campaign_id, entry_type, amount, balance_after,
			 reference_type, reference_id, description, currency,
			 expires_at, expiry_action, source_promotion_id)
		 VALUES ($1, $2, $3, 'credit', $4,
			COALESCE((SELECT balance_after FROM point_ledger
				WHERE tenant_id = $1 AND user_id = $2 AND currency = $8
				ORDER BY created_at DESC LIMIT 1), 0) + $4,
			$5, $6, $7, $8, $9, $10, $11)`,
		tenantID, userID, campaignPtr, amount,
		refType, refID, description,
		currency, expiresAt, expiryActionPtr, promoIDPtr,
	)
	if err != nil {
		return fmt.Errorf("credit ledger: %w", err)
	}
	return nil
}

// Debit subtracts points from a user's ledger (append-only).
func (s *Service) Debit(ctx context.Context, tx pgx.Tx, tenantID, userID string, amount int, refType, refID, description, currency string) error {
	if currency == "" {
		currency = "point"
	}
	var currentBalance int
	err := tx.QueryRow(ctx,
		`SELECT COALESCE((SELECT balance_after FROM point_ledger
			WHERE tenant_id = $1 AND user_id = $2 AND currency = $3
			ORDER BY created_at DESC LIMIT 1), 0)`,
		tenantID, userID, currency,
	).Scan(&currentBalance)
	if err != nil {
		return fmt.Errorf("get balance: %w", err)
	}

	if currentBalance < amount {
		return fmt.Errorf("insufficient balance: have %d, need %d", currentBalance, amount)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO point_ledger (tenant_id, user_id, entry_type, amount, balance_after, reference_type, reference_id, description, currency)
		 VALUES ($1, $2, 'debit', $3, $4, $5, $6, $7, $8)`,
		tenantID, userID, amount, currentBalance-amount, refType, refID, description, currency,
	)
	if err != nil {
		return fmt.Errorf("debit ledger: %w", err)
	}
	return nil
}

func (s *Service) GetBalance(ctx context.Context, tenantID, userID string) (*Balance, error) {
	var b Balance
	b.UserID = userID
	b.TenantID = tenantID

	err := s.db.QueryRow(ctx,
		`SELECT
			COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN entry_type = 'expiry' THEN amount ELSE 0 END), 0),
			COALESCE((SELECT balance_after FROM point_ledger
				WHERE tenant_id = $1 AND user_id = $2 AND currency = 'point'
				ORDER BY created_at DESC LIMIT 1), 0)
		 FROM point_ledger WHERE tenant_id = $1 AND user_id = $2 AND currency = 'point'`,
		tenantID, userID,
	).Scan(&b.TotalEarned, &b.TotalSpent, &b.TotalExpired, &b.Current)
	if err != nil {
		return nil, fmt.Errorf("get balance: %w", err)
	}
	return &b, nil
}

// RefundPoints credits back points to a user (admin action)
func (s *Service) RefundPoints(ctx context.Context, tenantID, userID string, amount int, reason, adminUserID string) (*Entry, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("refund amount must be positive")
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var e Entry
	err = tx.QueryRow(ctx,
		`INSERT INTO point_ledger (tenant_id, user_id, entry_type, amount, balance_after, reference_type, reference_id, description, currency)
		 VALUES ($1, $2, 'credit', $3,
			COALESCE((SELECT balance_after FROM point_ledger
				WHERE tenant_id = $1 AND user_id = $2 AND currency = 'point'
				ORDER BY created_at DESC LIMIT 1), 0) + $3,
			'refund', $4, $5, 'point')
		 RETURNING id, tenant_id, user_id, campaign_id, entry_type, amount, balance_after, currency,
				   reference_type, reference_id, description, created_at::text`,
		tenantID, userID, amount, adminUserID, reason,
	).Scan(&e.ID, &e.TenantID, &e.UserID, &e.CampaignID, &e.EntryType, &e.Amount, &e.BalanceAfter,
		&e.Currency, &e.ReferenceType, &e.ReferenceID, &e.Description, &e.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("refund: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return &e, nil
}

func (s *Service) GetHistory(ctx context.Context, tenantID, userID string, limit, offset int) ([]Entry, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.Query(ctx,
		`SELECT id, tenant_id, user_id, campaign_id, entry_type, amount, balance_after, currency,
				reference_type, reference_id, description, created_at
		 FROM point_ledger WHERE tenant_id = $1 AND user_id = $2
		 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		tenantID, userID, limit, offset,
	)
	if err != nil {
		return nil, fmt.Errorf("get history: %w", err)
	}
	defer rows.Close()

	var entries []Entry
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.ID, &e.TenantID, &e.UserID, &e.CampaignID, &e.EntryType, &e.Amount,
			&e.BalanceAfter, &e.Currency, &e.ReferenceType, &e.ReferenceID, &e.Description, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan entry: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, nil
}
