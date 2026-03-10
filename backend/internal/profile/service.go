package profile

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrAddressNotFound = errors.New("address not found")

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

// Profile matches users table columns (migration 010)
type Profile struct {
	ID               string  `json:"id"`
	TenantID         string  `json:"tenant_id"`
	Email            *string `json:"email"`
	Phone            *string `json:"phone"`
	DisplayName      string  `json:"display_name"`
	FirstName        *string `json:"first_name"`
	LastName         *string `json:"last_name"`
	BirthDate        *string `json:"birth_date"`
	Gender           *string `json:"gender"`
	AvatarURL        *string `json:"avatar_url"`
	PhoneVerified    bool    `json:"phone_verified"`
	ProfileCompleted bool    `json:"profile_completed"`
	LastLoginAt      *string `json:"last_login_at"`
}

// Address matches user_addresses table
type Address struct {
	ID            string  `json:"id"`
	UserID        string  `json:"user_id"`
	TenantID      string  `json:"tenant_id"`
	Label         string  `json:"label"`
	RecipientName string  `json:"recipient_name"`
	Phone         string  `json:"phone"`
	AddressLine1  string  `json:"address_line1"`
	AddressLine2  *string `json:"address_line2"`
	District      *string `json:"district"`
	SubDistrict   *string `json:"sub_district"`
	Province      *string `json:"province"`
	PostalCode    *string `json:"postal_code"`
	IsDefault     bool    `json:"is_default"`
	CreatedAt     string  `json:"created_at"`
}

type UpdateProfileInput struct {
	FirstName   *string `json:"first_name"`
	LastName    *string `json:"last_name"`
	BirthDate   *string `json:"birth_date"`
	Gender      *string `json:"gender"`
	AvatarURL   *string `json:"avatar_url"`
	DisplayName *string `json:"display_name"`
}

type CreateAddressInput struct {
	Label         string  `json:"label" binding:"required"`
	RecipientName string  `json:"recipient_name" binding:"required"`
	Phone         string  `json:"phone" binding:"required"`
	AddressLine1  string  `json:"address_line1" binding:"required"`
	AddressLine2  *string `json:"address_line2"`
	District      *string `json:"district"`
	SubDistrict   *string `json:"sub_district"`
	Province      *string `json:"province"`
	PostalCode    *string `json:"postal_code"`
	IsDefault     bool    `json:"is_default"`
}

type UpdateAddressInput struct {
	Label         *string `json:"label"`
	RecipientName *string `json:"recipient_name"`
	Phone         *string `json:"phone"`
	AddressLine1  *string `json:"address_line1"`
	AddressLine2  *string `json:"address_line2"`
	District      *string `json:"district"`
	SubDistrict   *string `json:"sub_district"`
	Province      *string `json:"province"`
	PostalCode    *string `json:"postal_code"`
	IsDefault     *bool   `json:"is_default"`
}

func (s *Service) GetProfile(ctx context.Context, tenantID, userID string) (*Profile, error) {
	var p Profile
	err := s.db.QueryRow(ctx,
		`SELECT id, tenant_id, email, phone, display_name, first_name, last_name,
		        birth_date::text, gender, avatar_url, phone_verified, profile_completed, last_login_at::text
		 FROM users
		 WHERE id = $1 AND tenant_id = $2`,
		userID, tenantID,
	).Scan(&p.ID, &p.TenantID, &p.Email, &p.Phone, &p.DisplayName, &p.FirstName, &p.LastName,
		&p.BirthDate, &p.Gender, &p.AvatarURL, &p.PhoneVerified, &p.ProfileCompleted, &p.LastLoginAt)
	if err != nil {
		return nil, fmt.Errorf("get profile: %w", err)
	}
	return &p, nil
}

func (s *Service) UpdateProfile(ctx context.Context, tenantID, userID string, input UpdateProfileInput) (*Profile, error) {
	// Build dynamic update query (partial update with pointers)
	updates := []string{}
	args := []any{}
	argN := 1

	if input.FirstName != nil {
		updates = append(updates, fmt.Sprintf("first_name = $%d", argN))
		args = append(args, *input.FirstName)
		argN++
	}
	if input.LastName != nil {
		updates = append(updates, fmt.Sprintf("last_name = $%d", argN))
		args = append(args, *input.LastName)
		argN++
	}
	if input.BirthDate != nil {
		updates = append(updates, fmt.Sprintf("birth_date = $%d", argN))
		args = append(args, *input.BirthDate)
		argN++
	}
	if input.Gender != nil {
		validGenders := map[string]bool{"male": true, "female": true, "other": true}
		if !validGenders[*input.Gender] {
			return nil, fmt.Errorf("invalid gender: %s", *input.Gender)
		}
		updates = append(updates, fmt.Sprintf("gender = $%d", argN))
		args = append(args, *input.Gender)
		argN++
	}
	if input.AvatarURL != nil {
		updates = append(updates, fmt.Sprintf("avatar_url = $%d", argN))
		args = append(args, *input.AvatarURL)
		argN++
	}
	if input.DisplayName != nil {
		updates = append(updates, fmt.Sprintf("display_name = $%d", argN))
		args = append(args, *input.DisplayName)
		argN++
	}

	if len(updates) == 0 {
		return s.GetProfile(ctx, tenantID, userID)
	}

	args = append(args, userID, tenantID)
	query := fmt.Sprintf(
		`UPDATE users SET %s, updated_at = NOW() WHERE id = $%d AND tenant_id = $%d`,
		joinStrings(updates, ", "), argN, argN+1,
	)
	_, err := s.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("update profile: %w", err)
	}
	return s.GetProfile(ctx, tenantID, userID)
}

func (s *Service) ListAddresses(ctx context.Context, tenantID, userID string) ([]Address, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, tenant_id, label, recipient_name, phone, address_line1, address_line2,
		        district, sub_district, province, postal_code, is_default, created_at::text
		 FROM user_addresses
		 WHERE user_id = $1 AND tenant_id = $2
		 ORDER BY is_default DESC, created_at ASC`,
		userID, tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("list addresses: %w", err)
	}
	defer rows.Close()

	var addrs []Address
	for rows.Next() {
		var a Address
		if err := rows.Scan(&a.ID, &a.UserID, &a.TenantID, &a.Label, &a.RecipientName, &a.Phone,
			&a.AddressLine1, &a.AddressLine2, &a.District, &a.SubDistrict, &a.Province, &a.PostalCode,
			&a.IsDefault, &a.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan address: %w", err)
		}
		addrs = append(addrs, a)
	}
	return addrs, nil
}

func (s *Service) CreateAddress(ctx context.Context, tenantID, userID string, input CreateAddressInput) (*Address, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	if input.IsDefault {
		_, err = tx.Exec(ctx,
			`UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1 AND tenant_id = $2`,
			userID, tenantID,
		)
		if err != nil {
			return nil, fmt.Errorf("unset default addresses: %w", err)
		}
	}

	var a Address
	err = tx.QueryRow(ctx,
		`INSERT INTO user_addresses (user_id, tenant_id, label, recipient_name, phone, address_line1,
		                             address_line2, district, sub_district, province, postal_code, is_default)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		 RETURNING id, user_id, tenant_id, label, recipient_name, phone, address_line1, address_line2,
		           district, sub_district, province, postal_code, is_default, created_at::text`,
		userID, tenantID, input.Label, input.RecipientName, input.Phone, input.AddressLine1,
		input.AddressLine2, input.District, input.SubDistrict, input.Province, input.PostalCode, input.IsDefault,
	).Scan(&a.ID, &a.UserID, &a.TenantID, &a.Label, &a.RecipientName, &a.Phone, &a.AddressLine1,
		&a.AddressLine2, &a.District, &a.SubDistrict, &a.Province, &a.PostalCode, &a.IsDefault, &a.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create address: %w", err)
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return &a, nil
}

func (s *Service) getAddressByID(ctx context.Context, tenantID, userID, addressID string) (*Address, error) {
	var a Address
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id, tenant_id, label, recipient_name, phone, address_line1, address_line2,
		        district, sub_district, province, postal_code, is_default, created_at::text
		 FROM user_addresses
		 WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
		addressID, userID, tenantID,
	).Scan(&a.ID, &a.UserID, &a.TenantID, &a.Label, &a.RecipientName, &a.Phone, &a.AddressLine1,
		&a.AddressLine2, &a.District, &a.SubDistrict, &a.Province, &a.PostalCode, &a.IsDefault, &a.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrAddressNotFound
		}
		return nil, fmt.Errorf("get address: %w", err)
	}
	return &a, nil
}

func (s *Service) UpdateAddress(ctx context.Context, tenantID, userID, addressID string, input UpdateAddressInput) (*Address, error) {
	// If setting is_default, unset others first in a transaction
	if input.IsDefault != nil && *input.IsDefault {
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return nil, fmt.Errorf("begin tx: %w", err)
		}
		defer tx.Rollback(ctx)

		_, err = tx.Exec(ctx,
			`UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1 AND tenant_id = $2`,
			userID, tenantID,
		)
		if err != nil {
			return nil, fmt.Errorf("unset default addresses: %w", err)
		}

		_, err = tx.Exec(ctx,
			`UPDATE user_addresses SET is_default = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
			addressID, userID, tenantID,
		)
		if err != nil {
			return nil, fmt.Errorf("set default address: %w", err)
		}
		if err = tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("commit: %w", err)
		}
		// Continue with other fields if any
		input.IsDefault = nil // already handled
	}

	updates := []string{}
	args := []any{}
	argN := 1

	if input.Label != nil {
		updates = append(updates, fmt.Sprintf("label = $%d", argN))
		args = append(args, *input.Label)
		argN++
	}
	if input.RecipientName != nil {
		updates = append(updates, fmt.Sprintf("recipient_name = $%d", argN))
		args = append(args, *input.RecipientName)
		argN++
	}
	if input.Phone != nil {
		updates = append(updates, fmt.Sprintf("phone = $%d", argN))
		args = append(args, *input.Phone)
		argN++
	}
	if input.AddressLine1 != nil {
		updates = append(updates, fmt.Sprintf("address_line1 = $%d", argN))
		args = append(args, *input.AddressLine1)
		argN++
	}
	if input.AddressLine2 != nil {
		updates = append(updates, fmt.Sprintf("address_line2 = $%d", argN))
		args = append(args, *input.AddressLine2)
		argN++
	}
	if input.District != nil {
		updates = append(updates, fmt.Sprintf("district = $%d", argN))
		args = append(args, *input.District)
		argN++
	}
	if input.SubDistrict != nil {
		updates = append(updates, fmt.Sprintf("sub_district = $%d", argN))
		args = append(args, *input.SubDistrict)
		argN++
	}
	if input.Province != nil {
		updates = append(updates, fmt.Sprintf("province = $%d", argN))
		args = append(args, *input.Province)
		argN++
	}
	if input.PostalCode != nil {
		updates = append(updates, fmt.Sprintf("postal_code = $%d", argN))
		args = append(args, *input.PostalCode)
		argN++
	}
	if input.IsDefault != nil {
		updates = append(updates, fmt.Sprintf("is_default = $%d", argN))
		args = append(args, *input.IsDefault)
		argN++
	}

	if len(updates) == 0 {
		return s.getAddressByID(ctx, tenantID, userID, addressID)
	}

	updates = append(updates, "updated_at = NOW()")
	args = append(args, addressID, userID, tenantID)
	query := fmt.Sprintf(
		`UPDATE user_addresses SET %s WHERE id = $%d AND user_id = $%d AND tenant_id = $%d`,
		joinStrings(updates, ", "), argN, argN+1, argN+2,
	)
	result, err := s.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("update address: %w", err)
	}
	if result.RowsAffected() == 0 {
		return nil, ErrAddressNotFound
	}
	return s.getAddressByID(ctx, tenantID, userID, addressID)
}

func (s *Service) DeleteAddress(ctx context.Context, tenantID, userID, addressID string) error {
	result, err := s.db.Exec(ctx,
		`DELETE FROM user_addresses WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
		addressID, userID, tenantID,
	)
	if err != nil {
		return fmt.Errorf("delete address: %w", err)
	}
	if result.RowsAffected() == 0 {
		return ErrAddressNotFound
	}
	return nil
}

func (s *Service) SetDefaultAddress(ctx context.Context, tenantID, userID, addressID string) (*Address, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`UPDATE user_addresses SET is_default = FALSE WHERE user_id = $1 AND tenant_id = $2`,
		userID, tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("unset default addresses: %w", err)
	}

	result, err := tx.Exec(ctx,
		`UPDATE user_addresses SET is_default = TRUE, updated_at = NOW() WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
		addressID, userID, tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("set default address: %w", err)
	}
	if result.RowsAffected() == 0 {
		return nil, ErrAddressNotFound
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}
	return s.getAddressByID(ctx, tenantID, userID, addressID)
}

func joinStrings(ss []string, sep string) string {
	if len(ss) == 0 {
		return ""
	}
	result := ss[0]
	for i := 1; i < len(ss); i++ {
		result += sep + ss[i]
	}
	return result
}
