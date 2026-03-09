package platform

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type LedgerService struct {
	db *pgxpool.Pool
}

func NewLedgerService(db *pgxpool.Pool) *LedgerService {
	return &LedgerService{db: db}
}

type PlatformLedgerEntry struct {
	ID             string `json:"id"`
	PlatformUserID string `json:"platform_user_id"`
	EntryType      string `json:"entry_type"`
	Amount         int64  `json:"amount"`
	BalanceAfter   int64  `json:"balance_after"`
	Currency       string `json:"currency"`
	ReferenceType  string `json:"reference_type,omitempty"`
	ReferenceID    string `json:"reference_id,omitempty"`
	SourceTenantID string `json:"source_tenant_id,omitempty"`
	Description    string `json:"description,omitempty"`
	CreatedAt      string `json:"created_at"`
}

type PlatformBalance struct {
	PlatformUserID string `json:"platform_user_id"`
	Currency       string `json:"currency"`
	TotalEarned    int64  `json:"total_earned"`
	TotalSpent     int64  `json:"total_spent"`
	Current        int64  `json:"current"`
}

func (s *LedgerService) Credit(ctx context.Context, platformUserID string, amount int64, currency, refType, refID, sourceTenantID, description string) (*PlatformLedgerEntry, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("credit amount must be positive")
	}

	var entry PlatformLedgerEntry
	err := s.db.QueryRow(ctx,
		`INSERT INTO platform_point_ledger
			(platform_user_id, entry_type, amount, balance_after, currency, reference_type, reference_id, source_tenant_id, description)
		 VALUES ($1, 'credit', $2,
			COALESCE((SELECT balance_after FROM platform_point_ledger
				WHERE platform_user_id = $1 AND currency = $3
				ORDER BY created_at DESC LIMIT 1), 0) + $2,
			$3, $4, $5, $6, $7)
		 RETURNING id, platform_user_id, entry_type, amount, balance_after, currency,
			COALESCE(reference_type, ''), COALESCE(reference_id, ''),
			COALESCE(source_tenant_id::text, ''), COALESCE(description, ''), created_at::text`,
		platformUserID, amount, currency, refType, refID, nilIfEmpty(sourceTenantID), description,
	).Scan(&entry.ID, &entry.PlatformUserID, &entry.EntryType, &entry.Amount,
		&entry.BalanceAfter, &entry.Currency, &entry.ReferenceType, &entry.ReferenceID,
		&entry.SourceTenantID, &entry.Description, &entry.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("platform credit: %w", err)
	}
	return &entry, nil
}

func (s *LedgerService) Debit(ctx context.Context, platformUserID string, amount int64, currency, refType, refID, description string) (*PlatformLedgerEntry, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("debit amount must be positive")
	}

	var currentBalance int64
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(balance_after, 0) FROM platform_point_ledger
		 WHERE platform_user_id = $1 AND currency = $2
		 ORDER BY created_at DESC LIMIT 1`,
		platformUserID, currency,
	).Scan(&currentBalance)
	if err != nil {
		currentBalance = 0
	}
	if currentBalance < amount {
		return nil, fmt.Errorf("insufficient platform balance: have %d, need %d", currentBalance, amount)
	}

	var entry PlatformLedgerEntry
	err = s.db.QueryRow(ctx,
		`INSERT INTO platform_point_ledger
			(platform_user_id, entry_type, amount, balance_after, currency, reference_type, reference_id, description)
		 VALUES ($1, 'debit', $2, $3 - $2, $4, $5, $6, $7)
		 RETURNING id, platform_user_id, entry_type, amount, balance_after, currency,
			COALESCE(reference_type, ''), COALESCE(reference_id, ''),
			COALESCE(source_tenant_id::text, ''), COALESCE(description, ''), created_at::text`,
		platformUserID, amount, currentBalance, currency, refType, refID, description,
	).Scan(&entry.ID, &entry.PlatformUserID, &entry.EntryType, &entry.Amount,
		&entry.BalanceAfter, &entry.Currency, &entry.ReferenceType, &entry.ReferenceID,
		&entry.SourceTenantID, &entry.Description, &entry.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("platform debit: %w", err)
	}
	return &entry, nil
}

func (s *LedgerService) GetBalance(ctx context.Context, platformUserID, currency string) (*PlatformBalance, error) {
	var bal PlatformBalance
	bal.PlatformUserID = platformUserID
	bal.Currency = currency

	err := s.db.QueryRow(ctx,
		`SELECT
			COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN entry_type = 'debit' THEN amount ELSE 0 END), 0)
		 FROM platform_point_ledger
		 WHERE platform_user_id = $1 AND currency = $2`,
		platformUserID, currency,
	).Scan(&bal.TotalEarned, &bal.TotalSpent)
	if err != nil {
		return nil, err
	}
	bal.Current = bal.TotalEarned - bal.TotalSpent
	return &bal, nil
}

func (s *LedgerService) GetHistory(ctx context.Context, platformUserID, currency string, limit int) ([]PlatformLedgerEntry, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	rows, err := s.db.Query(ctx,
		`SELECT id, platform_user_id, entry_type, amount, balance_after, currency,
			COALESCE(reference_type, ''), COALESCE(reference_id, ''),
			COALESCE(source_tenant_id::text, ''), COALESCE(description, ''), created_at::text
		 FROM platform_point_ledger
		 WHERE platform_user_id = $1 AND currency = $2
		 ORDER BY created_at DESC LIMIT $3`,
		platformUserID, currency, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []PlatformLedgerEntry
	for rows.Next() {
		var e PlatformLedgerEntry
		if err := rows.Scan(&e.ID, &e.PlatformUserID, &e.EntryType, &e.Amount,
			&e.BalanceAfter, &e.Currency, &e.ReferenceType, &e.ReferenceID,
			&e.SourceTenantID, &e.Description, &e.CreatedAt); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return entries, nil
}

func nilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
