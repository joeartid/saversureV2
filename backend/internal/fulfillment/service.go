package fulfillment

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

type FulfillmentItem struct {
	ID                string  `json:"id"`
	RewardID          string  `json:"reward_id"`
	RewardName        *string `json:"reward_name"`
	UserID            string  `json:"user_id"`
	UserName          *string `json:"user_name"`
	UserPhone         *string `json:"user_phone"`
	FulfillmentStatus string  `json:"fulfillment_status"`
	TrackingNumber    *string `json:"tracking_number"`
	DeliveryType      *string `json:"delivery_type"`
	CouponCode        *string `json:"coupon_code"`
	AddressID         *string `json:"address_id"`
	RecipientName     *string `json:"recipient_name"`
	RecipientPhone    *string `json:"recipient_phone"`
	AddressLine1      *string `json:"address_line1"`
	AddressLine2      *string `json:"address_line2"`
	District          *string `json:"district"`
	SubDistrict       *string `json:"sub_district"`
	Province          *string `json:"province"`
	PostalCode        *string `json:"postal_code"`
	ShippedAt         *string `json:"shipped_at"`
	DeliveredAt       *string `json:"delivered_at"`
	CreatedAt         string  `json:"created_at"`
	ConfirmedAt       *string `json:"confirmed_at"`
}

type ListFilter struct {
	Status string
	Limit  int
	Offset int
}

const fulfillmentSelectCols = `
	rr.id, rr.reward_id, r.name, rr.user_id,
	COALESCE(
	  NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''),
	  NULLIF(u.display_name, ''),
	  u.email,
	  u.phone
	),
	u.phone,
	COALESCE(rr.fulfillment_status, 'pending'),
	rr.tracking_number, rr.delivery_type, rr.coupon_code,
	rr.address_id,
	COALESCE(rr.recipient_name, ua.recipient_name),
	COALESCE(rr.recipient_phone, ua.phone, u.phone),
	COALESCE(rr.shipping_address_line1, ua.address_line1),
	COALESCE(rr.shipping_address_line2, ua.address_line2),
	COALESCE(rr.shipping_district, ua.district),
	COALESCE(rr.shipping_sub_district, ua.sub_district),
	COALESCE(rr.shipping_province, ua.province),
	COALESCE(rr.shipping_postal_code, ua.postal_code),
	rr.shipped_at::text, rr.delivered_at::text,
	rr.created_at::text, rr.confirmed_at::text`

func (s *Service) List(ctx context.Context, tenantID string, filter ListFilter) ([]FulfillmentItem, int, error) {
	where := `rr.tenant_id = $1 AND rr.status = 'CONFIRMED'`
	args := []any{tenantID}
	argIdx := 2

	if filter.Status != "" {
		where += fmt.Sprintf(` AND rr.fulfillment_status = $%d`, argIdx)
		args = append(args, filter.Status)
		argIdx++
	}

	var total int
	err := s.db.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM reward_reservations rr WHERE %s`, where), args...,
	).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count fulfillment: %w", err)
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	args = append(args, limit, filter.Offset)

	rows, err := s.db.Query(ctx, fmt.Sprintf(`
		SELECT %s
		FROM reward_reservations rr
		LEFT JOIN rewards r ON r.id = rr.reward_id
		LEFT JOIN users u ON u.id = rr.user_id
		LEFT JOIN user_addresses ua ON ua.id = rr.address_id
		WHERE %s
		ORDER BY rr.confirmed_at DESC NULLS LAST
		LIMIT $%d OFFSET $%d
	`, fulfillmentSelectCols, where, argIdx, argIdx+1), args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list fulfillment: %w", err)
	}
	defer rows.Close()

	var items []FulfillmentItem
	for rows.Next() {
		fi, err := scanFulfillment(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan fulfillment: %w", err)
		}
		items = append(items, fi)
	}
	return items, total, nil
}

func (s *Service) ListByIDs(ctx context.Context, tenantID string, ids []string) ([]FulfillmentItem, error) {
	rows, err := s.db.Query(ctx, fmt.Sprintf(`
		SELECT %s
		FROM reward_reservations rr
		LEFT JOIN rewards r ON r.id = rr.reward_id
		LEFT JOIN users u ON u.id = rr.user_id
		LEFT JOIN user_addresses ua ON ua.id = rr.address_id
		WHERE rr.tenant_id = $1 AND rr.status = 'CONFIRMED' AND rr.id = ANY($2)
		ORDER BY rr.confirmed_at DESC NULLS LAST
	`, fulfillmentSelectCols), tenantID, ids)
	if err != nil {
		return nil, fmt.Errorf("list fulfillment by ids: %w", err)
	}
	defer rows.Close()

	var items []FulfillmentItem
	for rows.Next() {
		fi, err := scanFulfillment(rows)
		if err != nil {
			return nil, fmt.Errorf("scan fulfillment by ids: %w", err)
		}
		items = append(items, fi)
	}
	return items, nil
}

func scanFulfillment(scanner interface{ Scan(dest ...any) error }) (FulfillmentItem, error) {
	var fi FulfillmentItem
	err := scanner.Scan(
		&fi.ID, &fi.RewardID, &fi.RewardName, &fi.UserID,
		&fi.UserName, &fi.UserPhone,
		&fi.FulfillmentStatus,
		&fi.TrackingNumber, &fi.DeliveryType, &fi.CouponCode,
		&fi.AddressID,
		&fi.RecipientName, &fi.RecipientPhone,
		&fi.AddressLine1, &fi.AddressLine2, &fi.District, &fi.SubDistrict, &fi.Province, &fi.PostalCode,
		&fi.ShippedAt, &fi.DeliveredAt,
		&fi.CreatedAt, &fi.ConfirmedAt,
	)
	return fi, err
}

type UpdateStatusInput struct {
	FulfillmentStatus string  `json:"fulfillment_status" binding:"required"`
	TrackingNumber    *string `json:"tracking_number"`
}

func (s *Service) UpdateStatus(ctx context.Context, tenantID, reservationID string, input UpdateStatusInput) error {
	now := time.Now().UTC().Format(time.RFC3339)

	var shippedClause, deliveredClause string
	args := []any{input.FulfillmentStatus, input.TrackingNumber, reservationID, tenantID}

	switch input.FulfillmentStatus {
	case "shipped":
		shippedClause = ", shipped_at = $5"
		args = append(args, now)
	case "delivered":
		deliveredClause = ", delivered_at = $5"
		args = append(args, now)
	}

	query := fmt.Sprintf(`
		UPDATE reward_reservations
		SET fulfillment_status = $1,
			tracking_number = COALESCE($2, tracking_number)
			%s%s
		WHERE id = $3 AND tenant_id = $4 AND status = 'CONFIRMED'
	`, shippedClause, deliveredClause)

	tag, err := s.db.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update fulfillment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("reservation not found or not confirmed")
	}
	return nil
}

// BulkUpdateStatus updates fulfillment status for multiple reservations
func (s *Service) BulkUpdateStatus(ctx context.Context, tenantID string, ids []string, input UpdateStatusInput) (int, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	updated := 0

	for _, id := range ids {
		args := []any{input.FulfillmentStatus, input.TrackingNumber, id, tenantID}
		var extra string
		switch input.FulfillmentStatus {
		case "shipped":
			extra = ", shipped_at = $5"
			args = append(args, now)
		case "delivered":
			extra = ", delivered_at = $5"
			args = append(args, now)
		}

		tag, err := s.db.Exec(ctx, fmt.Sprintf(`
			UPDATE reward_reservations
			SET fulfillment_status = $1,
				tracking_number = COALESCE($2, tracking_number)
				%s
			WHERE id = $3 AND tenant_id = $4 AND status = 'CONFIRMED'
		`, extra), args...)
		if err == nil && tag.RowsAffected() > 0 {
			updated++
		}
	}
	return updated, nil
}
