package platform

import (
	"context"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ExchangeService struct {
	db         *pgxpool.Pool
	identitySvc *IdentityService
	ledgerSvc   *LedgerService
}

func NewExchangeService(db *pgxpool.Pool, identitySvc *IdentityService, ledgerSvc *LedgerService) *ExchangeService {
	return &ExchangeService{db: db, identitySvc: identitySvc, ledgerSvc: ledgerSvc}
}

type ExchangeRequest struct {
	TenantID string `json:"tenant_id"`
	UserID   string `json:"user_id"`
	Amount   int64  `json:"amount"`
}

type ExchangeResult struct {
	BrandPointsDebited  int64   `json:"brand_points_debited"`
	PlatformPointsCredited int64 `json:"platform_points_credited"`
	ExchangeRate        float64 `json:"exchange_rate"`
	PlatformUserID      string  `json:"platform_user_id"`
	NewBrandBalance     int64   `json:"new_brand_balance"`
	NewPlatformBalance  int64   `json:"new_platform_balance"`
}

// Exchange converts brand points to platform (Saversure) points atomically.
func (s *ExchangeService) Exchange(ctx context.Context, req ExchangeRequest) (*ExchangeResult, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	var exchangeRate float64
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(exchange_rate, 1.0) FROM tenants WHERE id = $1`,
		req.TenantID,
	).Scan(&exchangeRate)
	if err != nil {
		return nil, fmt.Errorf("tenant not found: %w", err)
	}

	platformPoints := int64(math.Floor(float64(req.Amount) * exchangeRate))
	if platformPoints <= 0 {
		return nil, fmt.Errorf("exchange would yield 0 platform points")
	}

	// Find or create platform identity
	var identityType, identityKey string
	err = s.db.QueryRow(ctx,
		`SELECT COALESCE(line_user_id, ''), COALESCE(phone, '')
		 FROM users WHERE id = $1 AND tenant_id = $2`,
		req.UserID, req.TenantID,
	).Scan(&identityType, &identityKey)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Determine identity key: prefer LINE, fallback to phone
	idType := "line"
	idKey := identityType
	if idKey == "" {
		idType = "phone"
		idKey = identityKey
	}
	if idKey == "" {
		return nil, fmt.Errorf("user has no LINE or phone identity for cross-tenant linking")
	}

	link, err := s.identitySvc.LinkUser(ctx, req.TenantID, req.UserID, idType, idKey)
	if err != nil {
		return nil, fmt.Errorf("link identity: %w", err)
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Debit brand points
	var brandBalanceAfter int64
	var currentBrandBalance int64
	err = tx.QueryRow(ctx,
		`SELECT COALESCE(balance_after, 0) FROM point_ledger
		 WHERE tenant_id = $1 AND user_id = $2 AND currency = 'point'
		 ORDER BY created_at DESC LIMIT 1`,
		req.TenantID, req.UserID,
	).Scan(&currentBrandBalance)
	if err != nil {
		currentBrandBalance = 0
	}
	if currentBrandBalance < req.Amount {
		return nil, fmt.Errorf("insufficient brand balance: have %d, need %d", currentBrandBalance, req.Amount)
	}

	brandBalanceAfter = currentBrandBalance - req.Amount
	_, err = tx.Exec(ctx,
		`INSERT INTO point_ledger (tenant_id, user_id, entry_type, amount, balance_after, currency, reference_type, reference_id, description)
		 VALUES ($1, $2, 'debit', $3, $4, 'point', 'platform_exchange', $5, $6)`,
		req.TenantID, req.UserID, req.Amount, brandBalanceAfter,
		link.PlatformUserID,
		fmt.Sprintf("Exchange %d brand pts → %d saversure pts", req.Amount, platformPoints),
	)
	if err != nil {
		return nil, fmt.Errorf("debit brand points: %w", err)
	}

	// 2. Credit platform points
	var platformBalanceAfter int64
	var currentPlatformBalance int64
	err = tx.QueryRow(ctx,
		`SELECT COALESCE(balance_after, 0) FROM platform_point_ledger
		 WHERE platform_user_id = $1 AND currency = 'saversure_point'
		 ORDER BY created_at DESC LIMIT 1`,
		link.PlatformUserID,
	).Scan(&currentPlatformBalance)
	if err != nil {
		currentPlatformBalance = 0
	}

	platformBalanceAfter = currentPlatformBalance + platformPoints
	_, err = tx.Exec(ctx,
		`INSERT INTO platform_point_ledger
			(platform_user_id, entry_type, amount, balance_after, currency, reference_type, reference_id, source_tenant_id, description)
		 VALUES ($1, 'credit', $2, $3, 'saversure_point', 'brand_exchange', $4, $5, $6)`,
		link.PlatformUserID, platformPoints, platformBalanceAfter,
		req.TenantID+":"+req.UserID, req.TenantID,
		fmt.Sprintf("Exchange from brand: %d pts (rate: %.4f)", req.Amount, exchangeRate),
	)
	if err != nil {
		return nil, fmt.Errorf("credit platform points: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit exchange: %w", err)
	}

	return &ExchangeResult{
		BrandPointsDebited:     req.Amount,
		PlatformPointsCredited: platformPoints,
		ExchangeRate:           exchangeRate,
		PlatformUserID:         link.PlatformUserID,
		NewBrandBalance:        brandBalanceAfter,
		NewPlatformBalance:     platformBalanceAfter,
	}, nil
}
