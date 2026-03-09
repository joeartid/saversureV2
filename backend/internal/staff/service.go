package staff

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

type StaffUser struct {
	ID          string  `json:"id"`
	TenantID    string  `json:"tenant_id"`
	Email       *string `json:"email"`
	Phone       *string `json:"phone"`
	FirstName   *string `json:"first_name"`
	LastName    *string `json:"last_name"`
	Role        string  `json:"role"`
	Status      string  `json:"status"`
	FactoryID   *string `json:"factory_id"`
	FactoryName *string `json:"factory_name"`
	CreatedAt   string  `json:"created_at"`
}

type CreateInput struct {
	TenantID  string  `json:"-"`
	Email     string  `json:"email" binding:"required,email"`
	Password  string  `json:"password" binding:"required,min=6"`
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	Role      string  `json:"role" binding:"required"`
	FactoryID *string `json:"factory_id"`
}

type UpdateInput struct {
	Role      *string `json:"role"`
	Status    *string `json:"status"`
	FactoryID *string `json:"factory_id"`
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Phone     *string `json:"phone"`
}

type ResetPasswordInput struct {
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

var validStaffRoles = map[string]bool{
	"brand_admin": true, "brand_staff": true, "factory_user": true,
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int) ([]StaffUser, int64, error) {
	if limit <= 0 {
		limit = 50
	}

	var total int64
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*)
		 FROM users u
		 JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
		 WHERE u.tenant_id = $1 AND ur.role NOT IN ('customer', 'api_client')`,
		tenantID,
	).Scan(&total)

	rows, err := s.db.Query(ctx,
		`SELECT u.id, u.tenant_id, u.email, u.phone, u.first_name, u.last_name,
		        ur.role, u.status, u.factory_id, f.name, u.created_at::text
		 FROM users u
		 JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
		 LEFT JOIN factories f ON f.id = u.factory_id
		 WHERE u.tenant_id = $1 AND ur.role NOT IN ('customer', 'api_client')
		 ORDER BY u.created_at DESC
		 LIMIT $2 OFFSET $3`,
		tenantID, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list staff: %w", err)
	}
	defer rows.Close()

	var staff []StaffUser
	for rows.Next() {
		var u StaffUser
		if err := rows.Scan(&u.ID, &u.TenantID, &u.Email, &u.Phone, &u.FirstName, &u.LastName,
			&u.Role, &u.Status, &u.FactoryID, &u.FactoryName, &u.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan staff: %w", err)
		}
		staff = append(staff, u)
	}
	return staff, total, nil
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*StaffUser, error) {
	if !validStaffRoles[input.Role] {
		return nil, fmt.Errorf("invalid role: %s (allowed: brand_admin, brand_staff, factory_user, viewer)", input.Role)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	displayName := input.Email
	if input.FirstName != "" {
		displayName = input.FirstName
		if input.LastName != "" {
			displayName += " " + input.LastName
		}
	}

	var userID string
	err = tx.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, password_hash, display_name, first_name, last_name, status, factory_id)
		 VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
		 RETURNING id`,
		input.TenantID, input.Email, string(hash), displayName, input.FirstName, input.LastName, input.FactoryID,
	).Scan(&userID)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO user_roles (user_id, tenant_id, role) VALUES ($1, $2, $3)`,
		userID, input.TenantID, input.Role,
	)
	if err != nil {
		return nil, fmt.Errorf("assign role: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	var u StaffUser
	err = s.db.QueryRow(ctx,
		`SELECT u.id, u.tenant_id, u.email, u.phone, u.first_name, u.last_name,
		        ur.role, u.status, u.factory_id, f.name, u.created_at::text
		 FROM users u
		 JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
		 LEFT JOIN factories f ON f.id = u.factory_id
		 WHERE u.id = $1 AND u.tenant_id = $2`,
		userID, input.TenantID,
	).Scan(&u.ID, &u.TenantID, &u.Email, &u.Phone, &u.FirstName, &u.LastName,
		&u.Role, &u.Status, &u.FactoryID, &u.FactoryName, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("load created staff: %w", err)
	}
	return &u, nil
}

func (s *Service) Get(ctx context.Context, tenantID, id string) (*StaffUser, error) {
	var u StaffUser
	err := s.db.QueryRow(ctx,
		`SELECT u.id, u.tenant_id, u.email, u.phone, u.first_name, u.last_name,
		        ur.role, u.status, u.factory_id, f.name, u.created_at::text
		 FROM users u
		 JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
		 LEFT JOIN factories f ON f.id = u.factory_id
		 WHERE u.id = $1 AND u.tenant_id = $2`,
		id, tenantID,
	).Scan(&u.ID, &u.TenantID, &u.Email, &u.Phone, &u.FirstName, &u.LastName,
		&u.Role, &u.Status, &u.FactoryID, &u.FactoryName, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("staff not found")
	}
	return &u, nil
}

func (s *Service) ResetPassword(ctx context.Context, tenantID, id, newPassword string) error {
	// ป้องกันแก้ super_admin จาก tenant อื่น
	var role string
	err := s.db.QueryRow(ctx,
		`SELECT role FROM user_roles WHERE user_id = $1 AND tenant_id = $2`,
		id, tenantID,
	).Scan(&role)
	if err != nil {
		return fmt.Errorf("staff not found")
	}
	if role == "super_admin" {
		return fmt.Errorf("cannot reset super_admin password via this endpoint")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	result, err := s.db.Exec(ctx,
		`UPDATE users SET password_hash = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
		id, tenantID, string(hash),
	)
	if err != nil {
		return fmt.Errorf("update password: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("staff not found")
	}
	return nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, input UpdateInput) (*StaffUser, error) {
	if input.Role != nil {
		if !validStaffRoles[*input.Role] {
			return nil, fmt.Errorf("invalid role: %s", *input.Role)
		}
		_, err := s.db.Exec(ctx,
			`UPDATE user_roles SET role = $3
			 WHERE user_id = $1 AND tenant_id = $2
			   AND role NOT IN ('super_admin')`,
			id, tenantID, *input.Role,
		)
		if err != nil {
			return nil, fmt.Errorf("update role: %w", err)
		}
	}

	if input.Status != nil {
		validStatuses := map[string]bool{"active": true, "suspended": true}
		if !validStatuses[*input.Status] {
			return nil, fmt.Errorf("invalid status: %s", *input.Status)
		}
		_, err := s.db.Exec(ctx,
			`UPDATE users SET status = $3, updated_at = NOW()
			 WHERE id = $1 AND tenant_id = $2
			   AND id NOT IN (SELECT user_id FROM user_roles WHERE tenant_id = $2 AND role = 'super_admin')`,
			id, tenantID, *input.Status,
		)
		if err != nil {
			return nil, fmt.Errorf("update status: %w", err)
		}
	}

	if input.FirstName != nil || input.LastName != nil || input.Phone != nil {
		_, err := s.db.Exec(ctx,
			`UPDATE users SET
			   first_name   = COALESCE($3, first_name),
			   last_name    = COALESCE($4, last_name),
			   phone        = COALESCE($5, phone),
			   display_name = COALESCE(NULLIF(TRIM(COALESCE($3, first_name) || ' ' || COALESCE($4, last_name)), ''), email),
			   updated_at   = NOW()
			 WHERE id = $1 AND tenant_id = $2
			   AND id NOT IN (SELECT user_id FROM user_roles WHERE tenant_id = $2 AND role = 'super_admin')`,
			id, tenantID, input.FirstName, input.LastName, input.Phone,
		)
		if err != nil {
			return nil, fmt.Errorf("update profile: %w", err)
		}
	}

	if input.FactoryID != nil || (input.Role != nil && *input.Role != "factory_user") {
		var factoryVal interface{}
		if input.FactoryID != nil && *input.FactoryID != "" {
			factoryVal = *input.FactoryID
		}
		_, err := s.db.Exec(ctx,
			`UPDATE users SET factory_id = $3, updated_at = NOW()
			 WHERE id = $1 AND tenant_id = $2
			   AND id NOT IN (SELECT user_id FROM user_roles WHERE tenant_id = $2 AND role = 'super_admin')`,
			id, tenantID, factoryVal,
		)
		if err != nil {
			return nil, fmt.Errorf("update factory_id: %w", err)
		}
	}

	var u StaffUser
	err := s.db.QueryRow(ctx,
		`SELECT u.id, u.tenant_id, u.email, u.phone, u.first_name, u.last_name,
		        ur.role, u.status, u.factory_id, f.name, u.created_at::text
		 FROM users u
		 JOIN user_roles ur ON ur.user_id = u.id AND ur.tenant_id = u.tenant_id
		 LEFT JOIN factories f ON f.id = u.factory_id
		 WHERE u.id = $1 AND u.tenant_id = $2`,
		id, tenantID,
	).Scan(&u.ID, &u.TenantID, &u.Email, &u.Phone, &u.FirstName, &u.LastName,
		&u.Role, &u.Status, &u.FactoryID, &u.FactoryName, &u.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("staff not found: %w", err)
	}
	return &u, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	var role string
	err := s.db.QueryRow(ctx,
		`SELECT role FROM user_roles WHERE user_id = $1 AND tenant_id = $2`,
		id, tenantID,
	).Scan(&role)
	if err != nil {
		return fmt.Errorf("staff not found")
	}
	if role == "super_admin" {
		return fmt.Errorf("cannot delete super_admin")
	}

	_, err = s.db.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete role: %w", err)
	}
	result, err := s.db.Exec(ctx, `DELETE FROM users WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("staff not found")
	}
	return nil
}
