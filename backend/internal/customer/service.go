package customer

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

type Customer struct {
	ID           string  `json:"id"`
	TenantID     string  `json:"tenant_id"`
	Email        *string `json:"email"`
	Phone        *string `json:"phone"`
	DisplayName  *string `json:"display_name"`
	FirstName    *string `json:"first_name"`
	LastName     *string `json:"last_name"`
	Status       string  `json:"status"`
	Province     *string `json:"province"`
	Occupation   *string `json:"occupation"`
	CustomerFlag string  `json:"customer_flag"`
	PointBalance int     `json:"point_balance"`
	ScanCount    int     `json:"scan_count"`
	RedeemCount  int     `json:"redeem_count"`
	CreatedAt    string  `json:"created_at"`
}

type ListFilter struct {
	Search string
	Limit  int
	Offset int
}

type UpdateInput struct {
	Status       *string `json:"status"`
	Province     *string `json:"province"`
	Occupation   *string `json:"occupation"`
	CustomerFlag *string `json:"customer_flag"`
}

func (s *Service) List(ctx context.Context, tenantID string, f ListFilter) ([]Customer, int64, error) {
	if f.Limit <= 0 {
		f.Limit = 50
	}

	where := "u.tenant_id = $1 AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.tenant_id = u.tenant_id AND ur.role = 'api_client')"
	args := []any{tenantID}
	argN := 2

	if f.Search != "" {
		where += fmt.Sprintf(" AND (u.email ILIKE $%d OR u.first_name ILIKE $%d OR u.last_name ILIKE $%d OR u.phone ILIKE $%d OR u.province ILIKE $%d OR u.display_name ILIKE $%d)", argN, argN, argN, argN, argN, argN)
		args = append(args, "%"+f.Search+"%")
		argN++
	}

	var total int64
	_ = s.db.QueryRow(ctx,
		fmt.Sprintf("SELECT COUNT(*) FROM users u WHERE %s", where),
		args...,
	).Scan(&total)

	query := fmt.Sprintf(
		`SELECT u.id, u.tenant_id, u.email, u.phone, u.display_name, u.first_name, u.last_name, u.status,
		        u.province, u.occupation, COALESCE(u.customer_flag, 'green'),
		        COALESCE((SELECT balance_after FROM point_ledger WHERE tenant_id = u.tenant_id AND user_id = u.id ORDER BY created_at DESC LIMIT 1), 0),
		        COALESCE((SELECT COUNT(*) FROM codes WHERE tenant_id = u.tenant_id AND scanned_by = u.id), 0),
		        COALESCE((SELECT COUNT(*) FROM reward_reservations WHERE tenant_id = u.tenant_id AND user_id = u.id AND status = 'CONFIRMED'), 0),
		        u.created_at::text
		 FROM users u
		 WHERE %s
		 ORDER BY u.created_at DESC
		 LIMIT $%d OFFSET $%d`,
		where, argN, argN+1,
	)
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list customers: %w", err)
	}
	defer rows.Close()

	var customers []Customer
	for rows.Next() {
		var c Customer
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Email, &c.Phone, &c.DisplayName, &c.FirstName, &c.LastName,
			&c.Status, &c.Province, &c.Occupation, &c.CustomerFlag,
			&c.PointBalance, &c.ScanCount, &c.RedeemCount, &c.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan customer: %w", err)
		}
		customers = append(customers, c)
	}
	return customers, total, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*Customer, error) {
	var c Customer
	err := s.db.QueryRow(ctx,
		`SELECT u.id, u.tenant_id, u.email, u.phone, u.display_name, u.first_name, u.last_name, u.status,
		        u.province, u.occupation, COALESCE(u.customer_flag, 'green'),
		        COALESCE((SELECT balance_after FROM point_ledger WHERE tenant_id = u.tenant_id AND user_id = u.id ORDER BY created_at DESC LIMIT 1), 0),
		        COALESCE((SELECT COUNT(*) FROM codes WHERE tenant_id = u.tenant_id AND scanned_by = u.id), 0),
		        COALESCE((SELECT COUNT(*) FROM reward_reservations WHERE tenant_id = u.tenant_id AND user_id = u.id AND status = 'CONFIRMED'), 0),
		        u.created_at::text
		 FROM users u
		 WHERE u.id = $1 AND u.tenant_id = $2`,
		id, tenantID,
	).Scan(&c.ID, &c.TenantID, &c.Email, &c.Phone, &c.DisplayName, &c.FirstName, &c.LastName,
		&c.Status, &c.Province, &c.Occupation, &c.CustomerFlag,
		&c.PointBalance, &c.ScanCount, &c.RedeemCount, &c.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("customer not found: %w", err)
	}
	return &c, nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, input UpdateInput) (*Customer, error) {
	if input.Status != nil {
		validStatuses := map[string]bool{"active": true, "suspended": true, "banned": true}
		if !validStatuses[*input.Status] {
			return nil, fmt.Errorf("invalid status: %s", *input.Status)
		}
		_, err := s.db.Exec(ctx,
			`UPDATE users SET status = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
			id, tenantID, *input.Status,
		)
		if err != nil {
			return nil, fmt.Errorf("update customer status: %w", err)
		}
	}
	if input.CustomerFlag != nil {
		validFlags := map[string]bool{"white": true, "green": true, "yellow": true, "orange": true, "black": true, "gray": true}
		if !validFlags[*input.CustomerFlag] {
			return nil, fmt.Errorf("invalid customer_flag: %s", *input.CustomerFlag)
		}
		_, err := s.db.Exec(ctx,
			`UPDATE users SET customer_flag = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
			id, tenantID, *input.CustomerFlag,
		)
		if err != nil {
			return nil, fmt.Errorf("update customer flag: %w", err)
		}
	}
	if input.Province != nil {
		_, _ = s.db.Exec(ctx,
			`UPDATE users SET province = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
			id, tenantID, *input.Province,
		)
	}
	if input.Occupation != nil {
		_, _ = s.db.Exec(ctx,
			`UPDATE users SET occupation = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
			id, tenantID, *input.Occupation,
		)
	}
	return s.GetByID(ctx, tenantID, id)
}

// DetailProfile is the user profile for GetDetail.
type DetailProfile struct {
	ID            string  `json:"id"`
	Email         string  `json:"email"`
	Phone         *string `json:"phone"`
	DisplayName   string  `json:"display_name"`
	FirstName     *string `json:"first_name"`
	LastName      *string `json:"last_name"`
	BirthDate     *string `json:"birth_date"`
	Gender        *string `json:"gender"`
	AvatarURL     *string `json:"avatar_url"`
	Province      *string `json:"province"`
	Occupation    *string `json:"occupation"`
	CustomerFlag  string  `json:"customer_flag"`
	PhoneVerified bool    `json:"phone_verified"`
	Status        string  `json:"status"`
	CreatedAt     string  `json:"created_at"`
	LastLoginAt   *string `json:"last_login_at"`
}

// ScanHistoryEntry is a single scan record for GetDetail.
type ScanHistoryEntry struct {
	ID           string   `json:"id"`
	CampaignID   string   `json:"campaign_id"`
	PointsEarned int      `json:"points_earned"`
	ScannedAt    string   `json:"scanned_at"`
	Latitude     *float64 `json:"latitude,omitempty"`
	Longitude    *float64 `json:"longitude,omitempty"`
}

// PointLedgerEntry is a single ledger entry for GetDetail.
type PointLedgerEntry struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"`
	Amount      int     `json:"amount"`
	Source      *string `json:"source,omitempty"`
	Description *string `json:"description,omitempty"`
	CreatedAt   string  `json:"created_at"`
}

// RedemptionEntry is a single redemption for GetDetail.
type RedemptionEntry struct {
	ID         string `json:"id"`
	Status     string `json:"status"`
	CreatedAt  string `json:"created_at"`
	RewardName string `json:"reward_name"`
	PointCost  int    `json:"point_cost"`
}

// AddressEntry is a user address for GetDetail.
type AddressEntry struct {
	ID           string  `json:"id"`
	Label        string  `json:"label"`
	RecipientName string `json:"recipient_name"`
	Phone        string `json:"phone"`
	AddressLine1 string `json:"address_line1"`
	AddressLine2 *string `json:"address_line2,omitempty"`
	District     *string `json:"district,omitempty"`
	SubDistrict  *string `json:"sub_district,omitempty"`
	Province     *string `json:"province,omitempty"`
	PostalCode   *string `json:"postal_code,omitempty"`
	IsDefault    bool    `json:"is_default"`
	CreatedAt    string  `json:"created_at"`
}

// DetailResult is the full customer detail for GetDetail.
type DetailResult struct {
	Profile      DetailProfile       `json:"profile"`
	Balance      int                 `json:"balance"`
	ScanHistory  []ScanHistoryEntry  `json:"scan_history"`
	PointLedger  []PointLedgerEntry  `json:"point_ledger"`
	Redemptions  []RedemptionEntry   `json:"redemptions"`
	Addresses    []AddressEntry     `json:"addresses"`
}

func (s *Service) GetDetail(ctx context.Context, tenantID, customerID string) (*DetailResult, error) {
	var profile DetailProfile
	err := s.db.QueryRow(ctx,
		`SELECT id, email, phone, COALESCE(display_name, ''), first_name, last_name,
		        birth_date::text, gender, avatar_url,
		        province, occupation, COALESCE(customer_flag, 'green'),
		        COALESCE(phone_verified, false), status,
		        created_at::text, last_login_at::text
		 FROM users WHERE id = $1 AND tenant_id = $2`,
		customerID, tenantID,
	).Scan(&profile.ID, &profile.Email, &profile.Phone, &profile.DisplayName, &profile.FirstName, &profile.LastName,
		&profile.BirthDate, &profile.Gender, &profile.AvatarURL,
		&profile.Province, &profile.Occupation, &profile.CustomerFlag,
		&profile.PhoneVerified, &profile.Status,
		&profile.CreatedAt, &profile.LastLoginAt)
	if err != nil {
		return nil, fmt.Errorf("customer not found: %w", err)
	}

	var balance int
	_ = s.db.QueryRow(ctx,
		`SELECT COALESCE((SELECT balance_after FROM point_ledger WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1), 0)`,
		tenantID, customerID,
	).Scan(&balance)

	// Scan history: use codes table (scanned_by = user)
	scanRows, err := s.db.Query(ctx,
		`SELECT c.id, b.campaign_id,
		        COALESCE(p.points_per_scan, (cam.settings->>'points_per_scan')::int, 1),
		        c.scanned_at::text
		 FROM codes c
		 JOIN batches b ON b.id = c.batch_id
		 JOIN campaigns cam ON cam.id = b.campaign_id
		 LEFT JOIN products p ON p.id = b.product_id
		 WHERE c.scanned_by = $1 AND c.tenant_id = $2
		 ORDER BY c.scanned_at DESC LIMIT 10`,
		customerID, tenantID,
	)
	var scans []ScanHistoryEntry
	if err == nil {
		defer scanRows.Close()
		for scanRows.Next() {
			var sh ScanHistoryEntry
			if err := scanRows.Scan(&sh.ID, &sh.CampaignID, &sh.PointsEarned, &sh.ScannedAt); err != nil {
				continue
			}
			scans = append(scans, sh)
		}
	}

	// Point ledger (last 20)
	ledgerRows, errLedger := s.db.Query(ctx,
		`SELECT id, entry_type, amount, reference_type, description, created_at::text
		 FROM point_ledger WHERE tenant_id = $1 AND user_id = $2
		 ORDER BY created_at DESC LIMIT 20`,
		tenantID, customerID,
	)
	var ledger []PointLedgerEntry
	if errLedger == nil {
		defer ledgerRows.Close()
		for ledgerRows.Next() {
			var e PointLedgerEntry
			var refType *string
			if err := ledgerRows.Scan(&e.ID, &e.Type, &e.Amount, &refType, &e.Description, &e.CreatedAt); err != nil {
				continue
			}
			e.Source = refType
			ledger = append(ledger, e)
		}
	}

	// Redemption history (last 10)
	redRows, errRed := s.db.Query(ctx,
		`SELECT rr.id, rr.status, rr.created_at::text, r.name, r.point_cost
		 FROM reward_reservations rr
		 JOIN rewards r ON r.id = rr.reward_id
		 WHERE rr.user_id = $1 AND rr.tenant_id = $2
		 ORDER BY rr.created_at DESC LIMIT 10`,
		customerID, tenantID,
	)
	var redemptions []RedemptionEntry
	if errRed == nil {
		defer redRows.Close()
		for redRows.Next() {
			var r RedemptionEntry
			if err := redRows.Scan(&r.ID, &r.Status, &r.CreatedAt, &r.RewardName, &r.PointCost); err != nil {
				continue
			}
			redemptions = append(redemptions, r)
		}
	}

	// Addresses
	addrRows, errAddr := s.db.Query(ctx,
		`SELECT id, label, recipient_name, phone, address_line1, address_line2, district, sub_district, province, postal_code, is_default, created_at::text
		 FROM user_addresses WHERE user_id = $1 AND tenant_id = $2`,
		customerID, tenantID,
	)
	var addresses []AddressEntry
	if errAddr == nil {
		defer addrRows.Close()
		for addrRows.Next() {
			var a AddressEntry
			if err := addrRows.Scan(&a.ID, &a.Label, &a.RecipientName, &a.Phone, &a.AddressLine1,
				&a.AddressLine2, &a.District, &a.SubDistrict, &a.Province, &a.PostalCode, &a.IsDefault, &a.CreatedAt); err != nil {
				continue
			}
			addresses = append(addresses, a)
		}
	}

	return &DetailResult{
		Profile:     profile,
		Balance:     balance,
		ScanHistory: scans,
		PointLedger: ledger,
		Redemptions: redemptions,
		Addresses:   addresses,
	}, nil
}
