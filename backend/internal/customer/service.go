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
	AvatarURL    *string `json:"avatar_url"`
	Status       string  `json:"status"`
	Province     *string `json:"province"`
	Occupation   *string `json:"occupation"`
	CustomerFlag string  `json:"customer_flag"`
	PointBalance int     `json:"point_balance"`
	ScanCount    int     `json:"scan_count"`
	RedeemCount  int     `json:"redeem_count"`
	CreatedAt    string  `json:"created_at"`
	Tags         []CustomerTagBadge `json:"tags"`
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
	AdminNotes   *string `json:"admin_notes"`
}

type CustomerTagBadge struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

func committedRedemptionStatusList() string {
	return "'CONFIRMED','SHIPPING','SHIPPED','COMPLETED'"
}

func derivedBalanceExpr(userAlias string) string {
	return fmt.Sprintf(
		`COALESCE(
			CASE
				WHEN EXISTS (
					SELECT 1
					FROM point_ledger pl
					WHERE pl.tenant_id = %[1]s.tenant_id
					  AND pl.user_id = %[1]s.id
				)
				THEN (
					SELECT CASE
						WHEN latest.reference_type = 'v1_live_sync_balance'
						 AND latest.created_at < COALESCE((
							SELECT MAX(sh.scanned_at)
							FROM scan_history sh
							WHERE sh.tenant_id = %[1]s.tenant_id
							  AND sh.user_id = %[1]s.id
							  AND COALESCE(sh.scan_type, 'success') = 'success'
						), latest.created_at)
						THEN (
							(SELECT COALESCE(SUM(points_earned), 0)
							 FROM scan_history
							 WHERE tenant_id = %[1]s.tenant_id
							   AND user_id = %[1]s.id
							   AND COALESCE(scan_type, 'success') = 'success')
							-
							COALESCE((
								SELECT SUM(r.point_cost)
								FROM reward_reservations rr
								JOIN rewards r ON r.id = rr.reward_id
								WHERE rr.tenant_id = %[1]s.tenant_id
								  AND rr.user_id = %[1]s.id
								  AND rr.status IN (%[2]s)
							), 0)
						)
						ELSE latest.balance_after
					END
					FROM (
						SELECT balance_after, reference_type, created_at
						FROM point_ledger
						WHERE tenant_id = %[1]s.tenant_id AND user_id = %[1]s.id
						ORDER BY created_at DESC
						LIMIT 1
					) latest
				)
				ELSE (
					(SELECT COALESCE(SUM(points_earned), 0)
					 FROM scan_history
					 WHERE tenant_id = %[1]s.tenant_id
					   AND user_id = %[1]s.id
					   AND COALESCE(scan_type, 'success') = 'success')
					-
					COALESCE((
						SELECT SUM(r.point_cost)
						FROM reward_reservations rr
						JOIN rewards r ON r.id = rr.reward_id
						WHERE rr.tenant_id = %[1]s.tenant_id
						  AND rr.user_id = %[1]s.id
						  AND rr.status IN (%[2]s)
					), 0)
				)
			END,
			0
		)`,
		userAlias,
		committedRedemptionStatusList(),
	)
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
		`SELECT u.id, u.tenant_id, u.email, u.phone, u.display_name, u.first_name, u.last_name, u.avatar_url, u.status,
		        u.province, u.occupation, COALESCE(u.customer_flag, 'green'),
		        %s,
		        COALESCE((SELECT COUNT(*) FROM scan_history WHERE tenant_id = u.tenant_id AND user_id = u.id AND COALESCE(scan_type, 'success') = 'success'), 0),
		        COALESCE((SELECT COUNT(*) FROM reward_reservations WHERE tenant_id = u.tenant_id AND user_id = u.id AND status IN (`+committedRedemptionStatusList()+`)), 0),
		        u.created_at::text
		 FROM users u
		 WHERE %s
		 ORDER BY u.created_at DESC
		 LIMIT $%d OFFSET $%d`,
		derivedBalanceExpr("u"), where, argN, argN+1,
	)
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list customers: %w", err)
	}
	defer rows.Close()

	var customers []Customer
	customerIDs := make([]string, 0)
	for rows.Next() {
		var c Customer
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Email, &c.Phone, &c.DisplayName, &c.FirstName, &c.LastName, &c.AvatarURL,
			&c.Status, &c.Province, &c.Occupation, &c.CustomerFlag,
			&c.PointBalance, &c.ScanCount, &c.RedeemCount, &c.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan customer: %w", err)
		}
		c.Tags = []CustomerTagBadge{}
		customers = append(customers, c)
		customerIDs = append(customerIDs, c.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	tagMap, err := s.loadCustomerTagsMap(ctx, tenantID, customerIDs)
	if err != nil {
		return nil, 0, err
	}
	for i := range customers {
		customers[i].Tags = tagMap[customers[i].ID]
	}
	return customers, total, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*Customer, error) {
	var c Customer
	err := s.db.QueryRow(ctx,
		`SELECT u.id, u.tenant_id, u.email, u.phone, u.display_name, u.first_name, u.last_name, u.avatar_url, u.status,
		        u.province, u.occupation, COALESCE(u.customer_flag, 'green'),
		        `+derivedBalanceExpr("u")+`,
		        COALESCE((SELECT COUNT(*) FROM scan_history WHERE tenant_id = u.tenant_id AND user_id = u.id AND COALESCE(scan_type, 'success') = 'success'), 0),
		        COALESCE((SELECT COUNT(*) FROM reward_reservations WHERE tenant_id = u.tenant_id AND user_id = u.id AND status IN (`+committedRedemptionStatusList()+`)), 0),
		        u.created_at::text
		 FROM users u
		 WHERE u.id = $1 AND u.tenant_id = $2`,
		id, tenantID,
	).Scan(&c.ID, &c.TenantID, &c.Email, &c.Phone, &c.DisplayName, &c.FirstName, &c.LastName, &c.AvatarURL,
		&c.Status, &c.Province, &c.Occupation, &c.CustomerFlag,
		&c.PointBalance, &c.ScanCount, &c.RedeemCount, &c.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("customer not found: %w", err)
	}
	tags, err := s.loadCustomerTags(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	c.Tags = tags
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
	if input.AdminNotes != nil {
		_, err := s.db.Exec(ctx,
			`UPDATE users
			 SET admin_notes = NULLIF($3, ''),
			     admin_notes_updated_at = NOW(),
			     updated_at = NOW()
			 WHERE id = $1 AND tenant_id = $2`,
			id, tenantID, *input.AdminNotes,
		)
		if err != nil {
			return nil, fmt.Errorf("update admin notes: %w", err)
		}
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
	AdminNotes    *string `json:"admin_notes"`
}

// ScanHistoryEntry is a single scan record for GetDetail.
type ScanHistoryEntry struct {
	ID           string   `json:"id"`
	CampaignID   string   `json:"campaign_id"`
	PointsEarned int      `json:"points_earned"`
	ScannedAt    string   `json:"scanned_at"`
	ScanType     string   `json:"scan_type"`
	Latitude     *float64 `json:"latitude,omitempty"`
	Longitude    *float64 `json:"longitude,omitempty"`
	Province     *string  `json:"province,omitempty"`
	District     *string  `json:"district,omitempty"`
	SubDistrict  *string  `json:"sub_district,omitempty"`
	PostalCode   *string  `json:"postal_code,omitempty"`
	ProductName  *string  `json:"product_name,omitempty"`
	ProductSKU   *string  `json:"product_sku,omitempty"`
	ProductImageURL *string `json:"product_image_url,omitempty"`

	LegacySerial          *string `json:"legacy_serial,omitempty"`
	LegacyProductName     *string `json:"legacy_product_name,omitempty"`
	LegacyProductSKU      *string `json:"legacy_product_sku,omitempty"`
	LegacyProductImageURL *string `json:"legacy_product_image_url,omitempty"`
	LegacyStatus          *int    `json:"legacy_status,omitempty"`

	DataSource string `json:"data_source"`
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
	ID             string  `json:"id"`
	Status         string  `json:"status"`
	CreatedAt      string  `json:"created_at"`
	RewardName     string  `json:"reward_name"`
	RewardImageURL *string `json:"reward_image_url,omitempty"`
	PointCost      int     `json:"point_cost"`
}

// AddressEntry is a user address for GetDetail.
type AddressEntry struct {
	ID            string  `json:"id"`
	Label         string  `json:"label"`
	RecipientName string  `json:"recipient_name"`
	Phone         string  `json:"phone"`
	AddressLine1  string  `json:"address_line1"`
	AddressLine2  *string `json:"address_line2,omitempty"`
	District      *string `json:"district,omitempty"`
	SubDistrict   *string `json:"sub_district,omitempty"`
	Province      *string `json:"province,omitempty"`
	PostalCode    *string `json:"postal_code,omitempty"`
	IsDefault     bool    `json:"is_default"`
	CreatedAt     string  `json:"created_at"`
}

// DetailResult is the full customer detail for GetDetail.
type DetailResult struct {
	Profile     DetailProfile      `json:"profile"`
	Balance     int                `json:"balance"`
	ScanHistory []ScanHistoryEntry `json:"scan_history"`
	PointLedger []PointLedgerEntry `json:"point_ledger"`
	Redemptions []RedemptionEntry  `json:"redemptions"`
	Addresses   []AddressEntry     `json:"addresses"`
	Tags        []CustomerTagBadge `json:"tags"`
}

func (s *Service) GetDetail(ctx context.Context, tenantID, customerID string) (*DetailResult, error) {
	var profile DetailProfile
	err := s.db.QueryRow(ctx,
		`SELECT id, COALESCE(email, ''), phone, COALESCE(display_name, ''), first_name, last_name,
		        birth_date::text, gender, avatar_url,
		        province, occupation, COALESCE(customer_flag, 'green'),
		        COALESCE(phone_verified, false), status,
		        created_at::text, last_login_at::text, admin_notes
		 FROM users WHERE id = $1 AND tenant_id = $2`,
		customerID, tenantID,
	).Scan(&profile.ID, &profile.Email, &profile.Phone, &profile.DisplayName, &profile.FirstName, &profile.LastName,
		&profile.BirthDate, &profile.Gender, &profile.AvatarURL,
		&profile.Province, &profile.Occupation, &profile.CustomerFlag,
		&profile.PhoneVerified, &profile.Status,
		&profile.CreatedAt, &profile.LastLoginAt, &profile.AdminNotes)
	if err != nil {
		return nil, fmt.Errorf("customer not found: %w", err)
	}

	var balance int
	_ = s.db.QueryRow(ctx,
		`SELECT `+derivedBalanceExpr("u")+`
		 FROM users u
		 WHERE u.tenant_id = $1 AND u.id = $2`,
		tenantID, customerID,
	).Scan(&balance)

	scanRows, err := s.db.Query(ctx,
		`SELECT sh.id, COALESCE(sh.campaign_id::text, ''),
		        COALESCE(sh.points_earned, 0),
		        sh.scanned_at::text,
		        COALESCE(sh.scan_type, 'success'),
		        sh.latitude, sh.longitude,
		        sh.province, sh.district, sh.sub_district, sh.postal_code,
		        COALESCE(rp.name, bp.name, lp.name, sh.legacy_product_name),
		        COALESCE(rp.sku, bp.sku, lp.sku, sh.legacy_product_sku),
		        COALESCE(rp.image_url, bp.image_url, lp.image_url, sh.legacy_product_image_url),
		        sh.legacy_qr_code_serial,
		        sh.legacy_product_name,
		        sh.legacy_product_sku,
		        sh.legacy_product_image_url,
		        sh.legacy_status,
		        CASE WHEN sh.legacy_qr_code_id IS NOT NULL THEN 'v1' ELSE 'v2' END
		 FROM scan_history sh
		 LEFT JOIN codes c ON c.id = sh.code_id AND c.tenant_id = sh.tenant_id
		 LEFT JOIN batches b ON b.id = sh.batch_id
		 LEFT JOIN rolls r ON r.batch_id = sh.batch_id AND c.serial_number BETWEEN r.serial_start AND r.serial_end
		 LEFT JOIN products rp ON rp.id = r.product_id
		 LEFT JOIN products bp ON bp.id = b.product_id
		 LEFT JOIN migration_entity_maps lpm ON lpm.tenant_id = sh.tenant_id AND lpm.entity_type = 'product' AND lpm.source_system = 'v1' AND lpm.source_id = sh.legacy_product_v1_id::text
		 LEFT JOIN products lp ON lp.id::text = lpm.target_id AND lp.tenant_id = sh.tenant_id
		 WHERE sh.user_id = $1 AND sh.tenant_id = $2
		 ORDER BY sh.scanned_at DESC LIMIT 50`,
		customerID, tenantID,
	)
	var scans []ScanHistoryEntry
	if err == nil {
		defer scanRows.Close()
		for scanRows.Next() {
			var sh ScanHistoryEntry
			if err := scanRows.Scan(
				&sh.ID, &sh.CampaignID, &sh.PointsEarned, &sh.ScannedAt,
				&sh.ScanType,
				&sh.Latitude, &sh.Longitude,
				&sh.Province, &sh.District, &sh.SubDistrict, &sh.PostalCode,
				&sh.ProductName, &sh.ProductSKU, &sh.ProductImageURL,
				&sh.LegacySerial,
				&sh.LegacyProductName,
				&sh.LegacyProductSKU,
				&sh.LegacyProductImageURL,
				&sh.LegacyStatus,
				&sh.DataSource,
			); err != nil {
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
	if len(ledger) == 0 {
		for _, sh := range scans {
			if sh.ScanType != "success" || sh.PointsEarned <= 0 {
				continue
			}
			source := "scan_history"
			description := "Derived from migrated scan history"
			ledger = append(ledger, PointLedgerEntry{
				ID:          "scan-" + sh.ID,
				Type:        "credit",
				Amount:      sh.PointsEarned,
				Source:      &source,
				Description: &description,
				CreatedAt:   sh.ScannedAt,
			})
			if len(ledger) >= 20 {
				break
			}
		}
	}

	// Redemption history (last 10)
	redRows, errRed := s.db.Query(ctx,
		`SELECT rr.id, rr.status, rr.created_at::text, r.name, r.image_url, r.point_cost
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
			if err := redRows.Scan(&r.ID, &r.Status, &r.CreatedAt, &r.RewardName, &r.RewardImageURL, &r.PointCost); err != nil {
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

	tags, err := s.loadCustomerTags(ctx, tenantID, customerID)
	if err != nil {
		return nil, err
	}

	return &DetailResult{
		Profile:     profile,
		Balance:     balance,
		ScanHistory: scans,
		PointLedger: ledger,
		Redemptions: redemptions,
		Addresses:   addresses,
		Tags:        tags,
	}, nil
}

func (s *Service) loadCustomerTags(ctx context.Context, tenantID, customerID string) ([]CustomerTagBadge, error) {
	tagMap, err := s.loadCustomerTagsMap(ctx, tenantID, []string{customerID})
	if err != nil {
		return nil, err
	}
	return tagMap[customerID], nil
}

func (s *Service) loadCustomerTagsMap(ctx context.Context, tenantID string, customerIDs []string) (map[string][]CustomerTagBadge, error) {
	result := make(map[string][]CustomerTagBadge, len(customerIDs))
	if len(customerIDs) == 0 {
		return result, nil
	}

	rows, err := s.db.Query(ctx,
		`SELECT cta.user_id::text, ct.id::text, ct.name, ct.color
		 FROM customer_tag_assignments cta
		 JOIN customer_tags ct ON ct.id = cta.tag_id
		 WHERE cta.tenant_id = $1 AND cta.user_id = ANY($2::uuid[])
		 ORDER BY ct.name ASC`,
		tenantID, customerIDs,
	)
	if err != nil {
		return nil, fmt.Errorf("load customer tags: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var userID string
		var tag CustomerTagBadge
		if err := rows.Scan(&userID, &tag.ID, &tag.Name, &tag.Color); err != nil {
			return nil, fmt.Errorf("scan customer tag: %w", err)
		}
		result[userID] = append(result[userID], tag)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for _, customerID := range customerIDs {
		if result[customerID] == nil {
			result[customerID] = []CustomerTagBadge{}
		}
	}
	return result, nil
}
