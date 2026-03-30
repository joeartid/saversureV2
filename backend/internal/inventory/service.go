package inventory

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrOutOfStock = errors.New("reward out of stock")

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

type Reward struct {
	ID              string  `json:"id"`
	TenantID        string  `json:"tenant_id"`
	CampaignID      string  `json:"campaign_id"`
	Name            string  `json:"name"`
	Description     string  `json:"description"`
	Type            string  `json:"type"`
	PointCost       int     `json:"point_cost"`
	NormalPointCost int     `json:"normal_point_cost"`
	Price           float64 `json:"price"`
	CostCurrency    string  `json:"cost_currency"`
	ImageURL        *string `json:"image_url"`
	DeliveryType    string  `json:"delivery_type"`
	Status          string  `json:"status"`
	ValidFrom       *string `json:"valid_from"`
	ExpiresAt       *string `json:"expires_at"`
	TotalQty        int     `json:"total_qty"`
	ReservedQty     int     `json:"reserved_qty"`
	SoldQty         int     `json:"sold_qty"`
	AvailableQty    int     `json:"available_qty"`
	CreatedAt       string  `json:"created_at"`
}

type CreateRewardInput struct {
	CampaignID      string  `json:"campaign_id" binding:"required"`
	Name            string  `json:"name" binding:"required"`
	Description     string  `json:"description"`
	Type            string  `json:"type" binding:"required"`
	PointCost       int     `json:"point_cost" binding:"required,min=1"`
	NormalPointCost int     `json:"normal_point_cost"`
	Price           float64 `json:"price"`
	CostCurrency    string  `json:"cost_currency"`
	ImageURL        *string `json:"image_url"`
	DeliveryType    string  `json:"delivery_type"`
	Status          string  `json:"status"`
	ValidFrom       *string `json:"valid_from"`
	ExpiresAt       *string `json:"expires_at"`
	TotalQty        int     `json:"total_qty" binding:"required,min=1"`
}

type UpdateRewardInput struct {
	Name            *string  `json:"name"`
	Description     *string  `json:"description"`
	Type            *string  `json:"type"`
	PointCost       *int     `json:"point_cost"`
	NormalPointCost *int     `json:"normal_point_cost"`
	Price           *float64 `json:"price"`
	CostCurrency    *string  `json:"cost_currency"`
	ImageURL        *string  `json:"image_url"`
	DeliveryType    *string  `json:"delivery_type"`
	Status          *string  `json:"status"`
	ValidFrom       *string  `json:"valid_from"`
	ExpiresAt       *string  `json:"expires_at"`
}

type UpdateInventoryInput struct {
	TotalQty *int `json:"total_qty"`
}

const rewardSelectCols = `r.id, r.tenant_id, r.campaign_id, r.name, COALESCE(r.description, ''), r.type, r.point_cost,
	COALESCE(r.normal_point_cost, 0), COALESCE(r.price, 0::numeric), COALESCE(r.cost_currency, 'point'), r.image_url, COALESCE(r.delivery_type, 'none'),
	COALESCE(r.status, 'active'), r.valid_from::text, r.expires_at::text,
	ri.total_qty, ri.reserved_qty, ri.sold_qty, (ri.total_qty - ri.reserved_qty - ri.sold_qty) as available_qty,
	r.created_at::text`

func scanReward(scanner interface{ Scan(dest ...any) error }) (*Reward, error) {
	var r Reward
	err := scanner.Scan(&r.ID, &r.TenantID, &r.CampaignID, &r.Name, &r.Description, &r.Type, &r.PointCost,
		&r.NormalPointCost, &r.Price, &r.CostCurrency, &r.ImageURL, &r.DeliveryType,
		&r.Status, &r.ValidFrom, &r.ExpiresAt,
		&r.TotalQty, &r.ReservedQty, &r.SoldQty, &r.AvailableQty,
		&r.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *Service) CreateReward(ctx context.Context, tenantID string, input CreateRewardInput) (*Reward, error) {
	if input.CostCurrency == "" {
		input.CostCurrency = "point"
	}
	if input.DeliveryType == "" {
		input.DeliveryType = "none"
	}
	if input.Status == "" {
		input.Status = "active"
	}

	row := s.db.QueryRow(ctx,
		`WITH ins AS (
			INSERT INTO rewards (tenant_id, campaign_id, name, description, type, point_cost, normal_point_cost, price, cost_currency, image_url, delivery_type, status, valid_from, expires_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz)
			RETURNING *
		), inv AS (
			INSERT INTO reward_inventory (reward_id, total_qty, reserved_qty, sold_qty)
			SELECT id, $15, 0, 0 FROM ins
			RETURNING reward_id, total_qty, reserved_qty, sold_qty
		)
		SELECT `+rewardSelectCols+`
		FROM ins r JOIN inv ri ON ri.reward_id = r.id`,
		tenantID, input.CampaignID, input.Name, input.Description, input.Type, input.PointCost,
		input.NormalPointCost, input.Price, input.CostCurrency, input.ImageURL, input.DeliveryType, input.Status, input.ValidFrom, input.ExpiresAt,
		input.TotalQty,
	)
	return scanReward(row)
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]Reward, int64, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	var total int64
	err := s.db.QueryRow(ctx,
		`SELECT count(*) FROM rewards WHERE tenant_id = $1`, tenantID,
	).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count rewards: %w", err)
	}

	rows, err := s.db.Query(ctx,
		`SELECT `+rewardSelectCols+`
		 FROM rewards r
		 JOIN reward_inventory ri ON ri.reward_id = r.id
		 WHERE r.tenant_id = $1
		 ORDER BY r.created_at DESC
		 LIMIT $2 OFFSET $3`, tenantID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("list rewards: %w", err)
	}
	defer rows.Close()

	var rewards []Reward
	for rows.Next() {
		r, err := scanReward(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan reward: %w", err)
		}
		rewards = append(rewards, *r)
	}
	return rewards, total, nil
}

func (s *Service) UpdateReward(ctx context.Context, tenantID, rewardID string, input UpdateRewardInput) (*Reward, error) {
	row := s.db.QueryRow(ctx,
		`UPDATE rewards SET
			name = COALESCE($3, name),
			description = COALESCE($4, description),
			type = COALESCE($5, type),
			point_cost = COALESCE($6, point_cost),
			normal_point_cost = COALESCE($7, normal_point_cost),
			price = COALESCE($8, price),
			cost_currency = COALESCE($9, cost_currency),
			image_url = COALESCE($10, image_url),
			delivery_type = COALESCE($11, delivery_type),
			status = COALESCE($12, status),
			valid_from = CASE WHEN $13::text = '__clear__' THEN NULL WHEN $13::text IS NOT NULL THEN $13::timestamptz ELSE valid_from END,
			expires_at = CASE WHEN $14::text = '__clear__' THEN NULL WHEN $14::text IS NOT NULL THEN $14::timestamptz ELSE expires_at END,
			updated_at = NOW()
		 WHERE id = $2 AND tenant_id = $1
		 RETURNING id`,
		tenantID, rewardID,
		input.Name, input.Description, input.Type, input.PointCost,
		input.NormalPointCost, input.Price, input.CostCurrency, input.ImageURL, input.DeliveryType, input.Status, input.ValidFrom, input.ExpiresAt,
	)

	var id string
	if err := row.Scan(&id); err != nil {
		return nil, fmt.Errorf("update reward: %w", err)
	}

	r, err := s.GetByID(ctx, tenantID, rewardID)
	if err != nil {
		return nil, err
	}
	return r, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, rewardID string) (*Reward, error) {
	row := s.db.QueryRow(ctx,
		`SELECT `+rewardSelectCols+`
		 FROM rewards r
		 JOIN reward_inventory ri ON ri.reward_id = r.id
		 WHERE r.id = $1 AND r.tenant_id = $2`,
		rewardID, tenantID)
	return scanReward(row)
}

func (s *Service) UpdateInventory(ctx context.Context, tenantID, rewardID string, input UpdateInventoryInput) (*Reward, error) {
	_, err := s.db.Exec(ctx,
		`UPDATE reward_inventory ri SET
			total_qty = COALESCE($3, ri.total_qty),
			version = ri.version + 1
		 FROM rewards rw
		 WHERE ri.reward_id = $2 AND rw.id = ri.reward_id AND rw.tenant_id = $1`,
		tenantID, rewardID, input.TotalQty,
	)
	if err != nil {
		return nil, fmt.Errorf("update inventory: %w", err)
	}
	return s.GetByID(ctx, tenantID, rewardID)
}

// AtomicReserve performs the 2-phase reservation step 1 (reserve) with row-level locking.
// CRITICAL: This is the anti-oversell mechanism. Uses SELECT FOR UPDATE.
func (s *Service) AtomicReserve(ctx context.Context, tx pgx.Tx, rewardID string) error {
	var available int
	err := tx.QueryRow(ctx,
		`SELECT (total_qty - reserved_qty - sold_qty)
		 FROM reward_inventory
		 WHERE reward_id = $1
		 FOR UPDATE`, rewardID,
	).Scan(&available)
	if err != nil {
		return fmt.Errorf("lock inventory: %w", err)
	}

	if available <= 0 {
		return ErrOutOfStock
	}

	_, err = tx.Exec(ctx,
		`UPDATE reward_inventory
		 SET reserved_qty = reserved_qty + 1, version = version + 1
		 WHERE reward_id = $1`, rewardID)
	if err != nil {
		return fmt.Errorf("reserve: %w", err)
	}

	return nil
}

// ConfirmReservation moves a reservation from reserved to sold.
func (s *Service) ConfirmReservation(ctx context.Context, tx pgx.Tx, rewardID string) error {
	_, err := tx.Exec(ctx,
		`UPDATE reward_inventory
		 SET reserved_qty = reserved_qty - 1, sold_qty = sold_qty + 1, version = version + 1
		 WHERE reward_id = $1`, rewardID)
	return err
}

// ReleaseReservation releases a reserved unit back to available.
func (s *Service) ReleaseReservation(ctx context.Context, tx pgx.Tx, rewardID string) error {
	_, err := tx.Exec(ctx,
		`UPDATE reward_inventory
		 SET reserved_qty = reserved_qty - 1, version = version + 1
		 WHERE reward_id = $1`, rewardID)
	return err
}
