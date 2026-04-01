package redemption

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"saversure/internal/coupon"
	"saversure/internal/inventory"
	"saversure/internal/ledger"
)

var (
	ErrReservationNotFound = errors.New("reservation not found")
	ErrReservationExpired  = errors.New("reservation has expired")
	ErrAlreadyConfirmed    = errors.New("reservation already confirmed")
	ErrDefaultAddressRequired = errors.New("default shipping address is required")
	ErrAddressNotFound       = errors.New("shipping address not found")
)

type Service struct {
	db           *pgxpool.Pool
	inventorySvc *inventory.Service
	ledgerSvc    *ledger.Service
	couponSvc    *coupon.Service
}

func NewService(db *pgxpool.Pool, inventorySvc *inventory.Service, ledgerSvc *ledger.Service, couponSvc *coupon.Service) *Service {
	return &Service{
		db:           db,
		inventorySvc: inventorySvc,
		ledgerSvc:    ledgerSvc,
		couponSvc:    couponSvc,
	}
}

type Reservation struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	RewardID  string    `json:"reward_id"`
	TenantID  string    `json:"tenant_id"`
	Status    string    `json:"status"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt string    `json:"created_at"`
}

type RedeemInput struct {
	RewardID  string  `json:"reward_id" binding:"required"`
	AddressID *string `json:"address_id,omitempty"`
}

type RedeemResult struct {
	ReservationID string  `json:"reservation_id"`
	RewardID      string  `json:"reward_id"`
	Status        string  `json:"status"`
	ExpiresAt     string  `json:"expires_at"`
	CreatedAt     string  `json:"created_at"`
	ConfirmedAt   *string `json:"confirmed_at,omitempty"`
	DeliveryType  string  `json:"delivery_type"`
	CouponCode    *string `json:"coupon_code,omitempty"`
	AddressID     *string `json:"address_id,omitempty"`
}

type shippingAddress struct {
	ID            string
	RecipientName string
	Phone         string
	AddressLine1  string
	AddressLine2  *string
	District      *string
	SubDistrict   *string
	Province      *string
	PostalCode    *string
}

type rewardMeta struct {
	PointCost    int
	CostCurrency string
	Type         string
	DeliveryType string
}

func normalizeDeliveryType(meta rewardMeta) string {
	if meta.DeliveryType != "" && meta.DeliveryType != "none" {
		return meta.DeliveryType
	}
	switch meta.Type {
	case "coupon":
		return "coupon"
	case "digital":
		return "digital"
	case "ticket":
		return "ticket"
	}
	return meta.DeliveryType
}

func (s *Service) loadRewardMeta(ctx context.Context, tx pgx.Tx, tenantID, rewardID string) (rewardMeta, error) {
	var meta rewardMeta
	err := tx.QueryRow(ctx,
		`SELECT point_cost, COALESCE(cost_currency, 'point'), type, COALESCE(delivery_type, 'none')
		 FROM rewards
		 WHERE id = $1 AND tenant_id = $2`,
		rewardID, tenantID,
	).Scan(&meta.PointCost, &meta.CostCurrency, &meta.Type, &meta.DeliveryType)
	if err != nil {
		return rewardMeta{}, fmt.Errorf("reward not found: %w", err)
	}
	meta.DeliveryType = normalizeDeliveryType(meta)
	return meta, nil
}

func (s *Service) getAddressByID(ctx context.Context, tx pgx.Tx, tenantID, userID, addressID string) (*shippingAddress, error) {
	// Validate UUID format before querying database
	if _, err := uuid.Parse(addressID); err != nil {
		return nil, nil // Return nil to trigger address not found flow
	}

	var addr shippingAddress
	err := tx.QueryRow(ctx,
		`SELECT id, recipient_name, phone, address_line1, address_line2, district, sub_district, province, postal_code
		 FROM user_addresses
		 WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
		addressID, tenantID, userID,
	).Scan(
		&addr.ID,
		&addr.RecipientName,
		&addr.Phone,
		&addr.AddressLine1,
		&addr.AddressLine2,
		&addr.District,
		&addr.SubDistrict,
		&addr.Province,
		&addr.PostalCode,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("load shipping address: %w", err)
	}
	return &addr, nil
}

func (s *Service) getDefaultAddress(ctx context.Context, tx pgx.Tx, tenantID, userID string) (*shippingAddress, error) {
	var addr shippingAddress
	err := tx.QueryRow(ctx,
		`SELECT id, recipient_name, phone, address_line1, address_line2, district, sub_district, province, postal_code
		 FROM user_addresses
		 WHERE tenant_id = $1 AND user_id = $2 AND is_default = TRUE
		 ORDER BY created_at ASC
		 LIMIT 1`,
		tenantID, userID,
	).Scan(
		&addr.ID,
		&addr.RecipientName,
		&addr.Phone,
		&addr.AddressLine1,
		&addr.AddressLine2,
		&addr.District,
		&addr.SubDistrict,
		&addr.Province,
		&addr.PostalCode,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("load default address: %w", err)
	}
	return &addr, nil
}

func (s *Service) getResultByIdempotency(ctx context.Context, tenantID, userID, idempotencyKey string) (*RedeemResult, error) {
	var result RedeemResult
	var rewardType string
	err := s.db.QueryRow(ctx,
		`SELECT rr.id, rr.reward_id, rr.status, rr.expires_at::text, rr.created_at::text,
		        rr.confirmed_at::text, COALESCE(r.delivery_type, 'none'), r.type, rr.coupon_code, rr.address_id
		 FROM reward_reservations rr
		 JOIN rewards r ON r.id = rr.reward_id
		 WHERE rr.tenant_id = $1 AND rr.user_id = $2 AND rr.idempotency_key = $3
		 ORDER BY rr.created_at DESC
		 LIMIT 1`,
		tenantID, userID, idempotencyKey,
	).Scan(&result.ReservationID, &result.RewardID, &result.Status, &result.ExpiresAt, &result.CreatedAt,
		&result.ConfirmedAt, &result.DeliveryType, &rewardType, &result.CouponCode, &result.AddressID)
	if err != nil {
		return nil, fmt.Errorf("load reservation by idempotency key: %w", err)
	}
	result.DeliveryType = normalizeDeliveryType(rewardMeta{Type: rewardType, DeliveryType: result.DeliveryType})
	return &result, nil
}

// RedeemNow completes reserve -> confirm in one atomic transaction so stock,
// points, reservation status, and coupon assignment stay consistent.
func (s *Service) RedeemNow(ctx context.Context, tenantID, userID string, input RedeemInput, idempotencyKey string) (*RedeemResult, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	meta, err := s.loadRewardMeta(ctx, tx, tenantID, input.RewardID)
	if err != nil {
		return nil, err
	}

	var shippingAddr *shippingAddress
	var addressID *string
	if meta.DeliveryType == "shipping" {
		if input.AddressID != nil && *input.AddressID != "" {
			shippingAddr, err = s.getAddressByID(ctx, tx, tenantID, userID, *input.AddressID)
			if err != nil {
				return nil, err
			}
			if shippingAddr == nil {
				return nil, ErrAddressNotFound
			}
		} else {
			shippingAddr, err = s.getDefaultAddress(ctx, tx, tenantID, userID)
			if err != nil {
				return nil, err
			}
		}
		if shippingAddr == nil {
			return nil, ErrDefaultAddressRequired
		}
		addressID = &shippingAddr.ID
	}

	if err := s.inventorySvc.AtomicReserve(ctx, tx, input.RewardID); err != nil {
		if errors.Is(err, inventory.ErrOutOfStock) {
			return nil, err
		}
		return nil, fmt.Errorf("reserve inventory: %w", err)
	}

	if err := s.ledgerSvc.Debit(ctx, tx, tenantID, userID, meta.PointCost, "redemption", input.RewardID,
		"Redeemed reward", meta.CostCurrency); err != nil {
		return nil, fmt.Errorf("debit points: %w", err)
	}

	expiresAt := time.Now().Add(10 * time.Minute)
	var reservationID, status, createdAt string
	var confirmedAt *string
	err = tx.QueryRow(ctx,
		`INSERT INTO reward_reservations (
			user_id, reward_id, tenant_id, status, idempotency_key, expires_at, address_id
		)
		 VALUES ($1, $2, $3, 'PENDING', $4, $5, $6)
		 RETURNING id, status, created_at::text`,
		userID, input.RewardID, tenantID, idempotencyKey, expiresAt, addressID,
	).Scan(&reservationID, &status, &createdAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && idempotencyKey != "" {
			return s.getResultByIdempotency(ctx, tenantID, userID, idempotencyKey)
		}
		return nil, fmt.Errorf("create reservation: %w", err)
	}

	if err := s.inventorySvc.ConfirmReservation(ctx, tx, input.RewardID); err != nil {
		return nil, fmt.Errorf("confirm inventory: %w", err)
	}

	var couponCode *string
	if meta.DeliveryType == "coupon" {
		if s.couponSvc == nil {
			return nil, fmt.Errorf("coupon service is not configured")
		}
		code, err := s.couponSvc.ClaimNextTx(ctx, tx, tenantID, input.RewardID, userID)
		if err != nil {
			return nil, err
		}
		couponCode = &code
	}

	err = tx.QueryRow(ctx,
		`UPDATE reward_reservations
		 SET status = 'CONFIRMED', confirmed_at = NOW(), coupon_code = $2
		 WHERE id = $1
		 RETURNING status, confirmed_at::text`,
		reservationID, couponCode,
	).Scan(&status, &confirmedAt)
	if err != nil {
		return nil, fmt.Errorf("confirm reservation: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &RedeemResult{
		ReservationID: reservationID,
		RewardID:      input.RewardID,
		Status:        status,
		ExpiresAt:     expiresAt.Format(time.RFC3339),
		CreatedAt:     createdAt,
		ConfirmedAt:   confirmedAt,
		DeliveryType:  meta.DeliveryType,
		CouponCode:    couponCode,
		AddressID:     addressID,
	}, nil
}

func nullIfNoAddress(addr *shippingAddress, getter func(*shippingAddress) string) *string {
	if addr == nil {
		return nil
	}
	value := getter(addr)
	return &value
}

func nullIfNoAddressPtr(addr *shippingAddress, getter func(*shippingAddress) *string) *string {
	if addr == nil {
		return nil
	}
	return getter(addr)
}

// Reserve performs Phase 1 of the 2-phase redemption.
// Uses atomic DB transaction with row-level locking to prevent oversell.
// RULE #1: Oversell must NEVER happen. If uncertain, REJECT safely.
func (s *Service) Reserve(ctx context.Context, tenantID, userID string, input RedeemInput, idempotencyKey string) (*Reservation, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	meta, err := s.loadRewardMeta(ctx, tx, tenantID, input.RewardID)
	if err != nil {
		return nil, err
	}

	if err := s.inventorySvc.AtomicReserve(ctx, tx, input.RewardID); err != nil {
		if errors.Is(err, inventory.ErrOutOfStock) {
			return nil, err
		}
		return nil, fmt.Errorf("reserve inventory: %w", err)
	}

	if err := s.ledgerSvc.Debit(ctx, tx, tenantID, userID, meta.PointCost, "redemption", input.RewardID,
		"Redeemed reward (reserved)", meta.CostCurrency); err != nil {
		return nil, fmt.Errorf("debit points: %w", err)
	}

	// Create reservation record
	expiresAt := time.Now().Add(10 * time.Minute)
	var r Reservation
	err = tx.QueryRow(ctx,
		`INSERT INTO reward_reservations (user_id, reward_id, tenant_id, status, idempotency_key, expires_at)
		 VALUES ($1, $2, $3, 'PENDING', $4, $5)
		 RETURNING id, user_id, reward_id, tenant_id, status, expires_at, created_at`,
		userID, input.RewardID, tenantID, idempotencyKey, expiresAt,
	).Scan(&r.ID, &r.UserID, &r.RewardID, &r.TenantID, &r.Status, &r.ExpiresAt, &r.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create reservation: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &r, nil
}

// Confirm performs Phase 2 of the 2-phase redemption.
// Moves the reservation from PENDING to CONFIRMED and inventory from reserved to sold.
func (s *Service) Confirm(ctx context.Context, tenantID, userID, reservationID string) (*Reservation, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var r Reservation
	err = tx.QueryRow(ctx,
		`SELECT id, user_id, reward_id, tenant_id, status, expires_at, created_at
		 FROM reward_reservations
		 WHERE id = $1 AND tenant_id = $2 AND user_id = $3
		 FOR UPDATE`,
		reservationID, tenantID, userID,
	).Scan(&r.ID, &r.UserID, &r.RewardID, &r.TenantID, &r.Status, &r.ExpiresAt, &r.CreatedAt)
	if err != nil {
		return nil, ErrReservationNotFound
	}

	if r.Status == "CONFIRMED" {
		return nil, ErrAlreadyConfirmed
	}

	if r.Status != "PENDING" {
		return nil, fmt.Errorf("reservation status is %s, expected PENDING", r.Status)
	}

	if time.Now().After(r.ExpiresAt) {
		// Expired: release the reservation
		if err := s.inventorySvc.ReleaseReservation(ctx, tx, r.RewardID); err != nil {
			return nil, fmt.Errorf("release expired reservation inventory: %w", err)
		}
		if _, err := tx.Exec(ctx, `UPDATE reward_reservations SET status = 'EXPIRED' WHERE id = $1`, r.ID); err != nil {
			return nil, fmt.Errorf("mark reservation expired: %w", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit expired reservation: %w", err)
		}
		return nil, ErrReservationExpired
	}

	// Move from reserved to sold
	if err := s.inventorySvc.ConfirmReservation(ctx, tx, r.RewardID); err != nil {
		return nil, fmt.Errorf("confirm inventory: %w", err)
	}

	err = tx.QueryRow(ctx,
		`UPDATE reward_reservations SET status = 'CONFIRMED', confirmed_at = NOW()
		 WHERE id = $1
		 RETURNING id, user_id, reward_id, tenant_id, status, expires_at, created_at`,
		reservationID,
	).Scan(&r.ID, &r.UserID, &r.RewardID, &r.TenantID, &r.Status, &r.ExpiresAt, &r.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("confirm reservation: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &r, nil
}
