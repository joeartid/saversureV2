package reward

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

// Detail is the full reward detail for GetDetail.
type Detail struct {
	ID                 string  `json:"id"`
	Name               string  `json:"name"`
	Description        string  `json:"description"`
	PointCost          int     `json:"point_cost"`
	NormalPointCost    int     `json:"normal_point_cost"`
	Price              float64 `json:"price"`
	CostCurrency       string  `json:"cost_currency"`
	ImageURL           *string `json:"image_url,omitempty"`
	DeliveryType       string  `json:"delivery_type"`
	Type               string  `json:"type"`
	CampaignID         string  `json:"campaign_id"`
	TotalQty           int     `json:"total_qty"`
	ReservedQty        int     `json:"reserved_qty"`
	SoldQty            int     `json:"sold_qty"`
	AvailableQty       int     `json:"available_qty"`
	TierID             *string `json:"tier_id,omitempty"`
	TierName           *string `json:"tier_name,omitempty"`
	IsFlash            bool    `json:"is_flash"`
	FlashStart         *string `json:"flash_start,omitempty"`
	FlashEnd           *string `json:"flash_end,omitempty"`
	CouponAvailableCnt int     `json:"coupon_available_count"`
	CreatedAt          string  `json:"created_at"`
	ValidFrom          *string `json:"valid_from,omitempty"`
}

// PublicItem is a reward in the public list for ListPublic.
type PublicItem struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Description     string  `json:"description"`
	PointCost       int     `json:"point_cost"`
	NormalPointCost int     `json:"normal_point_cost"`
	Price           float64 `json:"price"`
	CostCurrency    string  `json:"cost_currency"`
	ImageURL        *string `json:"image_url,omitempty"`
	DeliveryType    string  `json:"delivery_type"`
	AvailableQty    int     `json:"available_qty"`
	IsFlash         bool    `json:"is_flash"`
	FlashStart      *string `json:"flash_start,omitempty"`
	FlashEnd        *string `json:"flash_end,omitempty"`
	TierID          *string `json:"tier_id,omitempty"`
	TierName        *string `json:"tier_name,omitempty"`
	ValidFrom       *string `json:"valid_from,omitempty"`
}

func (s *Service) GetDetail(ctx context.Context, tenantID, rewardID string) (*Detail, error) {
	var d Detail
	err := s.db.QueryRow(ctx,
		`SELECT r.id, r.name, COALESCE(r.description, ''), r.point_cost, COALESCE(r.normal_point_cost, 0), COALESCE(r.price, 0::numeric), COALESCE(r.cost_currency, 'point'), r.image_url,
		        COALESCE(r.delivery_type, 'none'), r.type, r.campaign_id,
		        ri.total_qty, ri.reserved_qty, ri.sold_qty,
		        (ri.total_qty - ri.reserved_qty - ri.sold_qty) as available_qty,
		        r.tier_id, rt.name as tier_name,
		        COALESCE(r.is_flash, false), r.flash_start::text, r.flash_end::text,
		        r.created_at::text, r.valid_from::text
		 FROM rewards r
		 JOIN reward_inventory ri ON ri.reward_id = r.id
		 LEFT JOIN reward_tiers rt ON rt.id = r.tier_id
		 WHERE r.id = $1 AND r.tenant_id = $2`,
		rewardID, tenantID,
	).Scan(&d.ID, &d.Name, &d.Description, &d.PointCost, &d.NormalPointCost, &d.Price, &d.CostCurrency, &d.ImageURL,
		&d.DeliveryType, &d.Type, &d.CampaignID,
		&d.TotalQty, &d.ReservedQty, &d.SoldQty, &d.AvailableQty,
		&d.TierID, &d.TierName,
		&d.IsFlash, &d.FlashStart, &d.FlashEnd,
		&d.CreatedAt, &d.ValidFrom)
	if err != nil {
		return nil, fmt.Errorf("reward not found: %w", err)
	}

	// Coupon availability count (for delivery_type = 'coupon')
	var couponCnt int
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM coupon_codes WHERE reward_id = $1 AND tenant_id = $2 AND claimed_by IS NULL`,
		rewardID, tenantID,
	).Scan(&couponCnt)
	d.CouponAvailableCnt = couponCnt

	return &d, nil
}

func (s *Service) ListPublic(ctx context.Context, tenantID string, tierID *string, limit, offset int) ([]PublicItem, int64, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	where := "r.tenant_id = $1 AND COALESCE(r.status, 'active') = 'active' AND (r.expires_at IS NULL OR r.expires_at > NOW()) AND (r.valid_from IS NULL OR r.valid_from <= NOW()) AND (ri.total_qty - ri.reserved_qty - ri.sold_qty) > 0"
	args := []any{tenantID}
	argN := 2

	if tierID != nil && *tierID != "" {
		where += fmt.Sprintf(" AND (r.tier_id IS NULL OR r.tier_id = $%d)", argN)
		args = append(args, *tierID)
		argN++
	}

	var total int64
	_ = s.db.QueryRow(ctx,
		fmt.Sprintf("SELECT COUNT(*) FROM rewards r JOIN reward_inventory ri ON ri.reward_id = r.id WHERE %s", where),
		args...,
	).Scan(&total)

	query := fmt.Sprintf(
		`SELECT r.id, r.name, COALESCE(r.description, ''), r.point_cost, COALESCE(r.normal_point_cost, 0), COALESCE(r.price, 0::numeric), COALESCE(r.cost_currency, 'point'), r.image_url,
		        COALESCE(r.delivery_type, 'none'),
		        (ri.total_qty - ri.reserved_qty - ri.sold_qty) as available_qty,
		        COALESCE(r.is_flash, false), r.flash_start::text, r.flash_end::text,
		        r.tier_id, rt.name as tier_name, r.valid_from::text
		 FROM rewards r
		 JOIN reward_inventory ri ON ri.reward_id = r.id
		 LEFT JOIN reward_tiers rt ON rt.id = r.tier_id
		 WHERE %s
		 ORDER BY r.created_at DESC
		 LIMIT $%d OFFSET $%d`,
		where, argN, argN+1,
	)
	args = append(args, limit, offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list rewards: %w", err)
	}
	defer rows.Close()

	var items []PublicItem
	for rows.Next() {
		var p PublicItem
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.PointCost, &p.NormalPointCost, &p.Price, &p.CostCurrency, &p.ImageURL,
			&p.DeliveryType, &p.AvailableQty,
			&p.IsFlash, &p.FlashStart, &p.FlashEnd,
			&p.TierID, &p.TierName, &p.ValidFrom); err != nil {
			return nil, 0, fmt.Errorf("scan reward: %w", err)
		}
		items = append(items, p)
	}
	return items, total, nil
}
