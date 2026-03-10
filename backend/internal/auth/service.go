package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"saversure/internal/middleware"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserExists         = errors.New("user already exists")
	ErrUserNotFound       = errors.New("user not found")
	ErrPhoneExists        = errors.New("phone number already registered")
)

type ConsumerRegisterInput struct {
	TenantID    string `json:"tenant_id" binding:"required"`
	Phone       string `json:"phone" binding:"required"`
	OtpID       string `json:"otp_id" binding:"required"`
	OtpCode     string `json:"otp_code" binding:"required"`
	FirstName   string `json:"first_name" binding:"required"`
	LastName    string `json:"last_name" binding:"required"`
	DisplayName string `json:"display_name"`
	BirthDate   string `json:"birth_date"`
	Gender      string `json:"gender"`
	Password    string `json:"password" binding:"required,min=6"`
	PDPAConsent bool   `json:"pdpa_consent"`
}

type OTPService interface {
	RequestOTP(ctx context.Context, phone string) (otpID, refCode string, err error)
	VerifyOTP(ctx context.Context, otpID, otpCode string) (bool, error)
}

type Service struct {
	db          *pgxpool.Pool
	jwtSecret   string
	accessTTL   time.Duration
	refreshTTL  time.Duration
	otpVerifier OTPService
}

func NewService(db *pgxpool.Pool, jwtSecret string, accessTTL, refreshTTL time.Duration) *Service {
	return &Service{
		db:         db,
		jwtSecret:  jwtSecret,
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
}

func (s *Service) SetOTPVerifier(v OTPService) {
	s.otpVerifier = v
}

type RegisterInput struct {
	Email       string `json:"email" binding:"required,email"`
	Phone       string `json:"phone"`
	Password    string `json:"password" binding:"required,min=8"`
	DisplayName string `json:"display_name" binding:"required"`
	TenantID    string `json:"tenant_id" binding:"required"`
	PDPAConsent bool   `json:"pdpa_consent" binding:"required"`
}

type LoginInput struct {
	TenantID string `json:"tenant_id" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type TokenPair struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	ExpiresIn        int64  `json:"expires_in"`
	ProfileCompleted *bool  `json:"profile_completed,omitempty"`
}

type PasswordResetRequestInput struct {
	TenantID string `json:"tenant_id" binding:"required"`
	Phone    string `json:"phone" binding:"required"`
}

type PasswordResetInput struct {
	TenantID    string `json:"tenant_id" binding:"required"`
	Phone       string `json:"phone" binding:"required"`
	OtpID       string `json:"otp_id" binding:"required"`
	OtpCode     string `json:"otp_code" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

func (s *Service) Register(ctx context.Context, input RegisterInput, ipAddr string) (*TokenPair, error) {
	if !input.PDPAConsent {
		return nil, errors.New("PDPA consent is required")
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

	var userID string
	err = tx.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, phone, password_hash, display_name, status)
		 VALUES ($1, $2, $3, $4, $5, 'active')
		 ON CONFLICT (tenant_id, email) DO NOTHING
		 RETURNING id`,
		input.TenantID, input.Email, input.Phone, string(hash), input.DisplayName,
	).Scan(&userID)

	if err != nil {
		return nil, ErrUserExists
	}

	// Assign default role
	_, err = tx.Exec(ctx,
		`INSERT INTO user_roles (user_id, tenant_id, role) VALUES ($1, $2, 'api_client')`,
		userID, input.TenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("assign role: %w", err)
	}

	// Record PDPA consent
	_, err = tx.Exec(ctx,
		`INSERT INTO pdpa_consents (user_id, consent_type, ip_address) VALUES ($1, 'registration', $2)`,
		userID, ipAddr,
	)
	if err != nil {
		return nil, fmt.Errorf("record consent: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return s.generateTokenPair(userID, input.TenantID, "api_client", nil)
}

func (s *Service) RegisterConsumer(ctx context.Context, input ConsumerRegisterInput, ipAddr string) (*TokenPair, error) {
	if !input.PDPAConsent {
		return nil, errors.New("PDPA consent is required")
	}
	if s.otpVerifier == nil {
		return nil, errors.New("OTP verification is not configured")
	}

	ok, err := s.otpVerifier.VerifyOTP(ctx, input.OtpID, input.OtpCode)
	if err != nil {
		return nil, fmt.Errorf("OTP verify: %w", err)
	}
	if !ok {
		return nil, errors.New("invalid or expired OTP code")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	displayName := input.DisplayName
	if displayName == "" {
		displayName = input.FirstName + " " + input.LastName
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var existing int
	_ = tx.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND phone = $2`,
		input.TenantID, input.Phone,
	).Scan(&existing)
	if existing > 0 {
		return nil, ErrPhoneExists
	}

	var userID string
	birthDate := input.BirthDate
	if birthDate == "" {
		birthDate = "NULL"
	}

	err = tx.QueryRow(ctx,
		`INSERT INTO users (tenant_id, phone, password_hash, display_name, first_name, last_name,
		        birth_date, gender, phone_verified, profile_completed, status)
		 VALUES ($1, $2, $3, $4, $5, $6,
		        CASE WHEN $7 = 'NULL' THEN NULL ELSE $7::date END,
		        NULLIF($8, ''), TRUE, TRUE, 'active')
		 RETURNING id`,
		input.TenantID, input.Phone, string(hash), displayName,
		input.FirstName, input.LastName, birthDate, input.Gender,
	).Scan(&userID)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO user_roles (user_id, tenant_id, role) VALUES ($1, $2, 'api_client')`,
		userID, input.TenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("assign role: %w", err)
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO pdpa_consents (user_id, consent_type, ip_address) VALUES ($1, 'registration', $2)`,
		userID, ipAddr,
	)
	if err != nil {
		return nil, fmt.Errorf("record consent: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	tokens, err := s.generateTokenPair(userID, input.TenantID, "api_client", nil)
	if err != nil {
		return nil, err
	}
	pc := true
	tokens.ProfileCompleted = &pc
	return tokens, nil
}

func (s *Service) LoginByPhone(ctx context.Context, tenantID, phone, password string) (*TokenPair, error) {
	var userID, passwordHash, resolvedTenantID, role string
	var profileCompleted bool
	var factoryID *string
	err := s.db.QueryRow(ctx,
		`SELECT u.id, u.password_hash, u.tenant_id, ur.role, u.factory_id, u.profile_completed
		 FROM users u
		 JOIN user_roles ur ON ur.user_id = u.id
		 WHERE u.tenant_id = $1 AND u.phone = $2 AND u.status = 'active'
		 LIMIT 1`,
		tenantID, phone,
	).Scan(&userID, &passwordHash, &resolvedTenantID, &role, &factoryID, &profileCompleted)
	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	s.db.Exec(ctx, `UPDATE users SET last_login_at = NOW() WHERE id = $1`, userID)

	tokens, err := s.generateTokenPair(userID, resolvedTenantID, role, factoryID)
	if err != nil {
		return nil, err
	}
	tokens.ProfileCompleted = &profileCompleted
	return tokens, nil
}

func (s *Service) Login(ctx context.Context, input LoginInput) (*TokenPair, error) {
	var userID, passwordHash, tenantID, role string
	var profileCompleted bool
	var factoryID *string

	err := s.db.QueryRow(ctx,
		`SELECT u.id, u.password_hash, u.tenant_id, ur.role, u.factory_id, u.profile_completed
		 FROM users u
		 JOIN user_roles ur ON ur.user_id = u.id
		 WHERE u.tenant_id = $1 AND LOWER(u.email) = LOWER($2) AND u.status = 'active'
		 LIMIT 1`,
		input.TenantID, input.Email,
	).Scan(&userID, &passwordHash, &tenantID, &role, &factoryID, &profileCompleted)

	if err != nil {
		return nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(input.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	s.db.Exec(ctx, `UPDATE users SET last_login_at = NOW() WHERE id = $1`, userID)

	tokens, err := s.generateTokenPair(userID, tenantID, role, factoryID)
	if err != nil {
		return nil, err
	}
	tokens.ProfileCompleted = &profileCompleted
	return tokens, nil
}

func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(refreshToken, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(s.jwtSecret), nil
	})

	if err != nil || !token.Valid {
		return nil, ErrInvalidCredentials
	}

	return s.generateTokenPair(claims.UserID, claims.TenantID, claims.Role, claims.FactoryID)
}

// PDPAConsent represents a consent record
type PDPAConsent struct {
	ID          string `json:"id"`
	ConsentType string `json:"consent_type"`
	AcceptedAt  string `json:"accepted_at"`
	IPAddress   string `json:"ip_address,omitempty"`
}

func (s *Service) GetPDPAConsents(ctx context.Context, userID string) ([]PDPAConsent, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, consent_type, accepted_at, ip_address
		 FROM pdpa_consents WHERE user_id = $1 ORDER BY accepted_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("query consents: %w", err)
	}
	defer rows.Close()

	var consents []PDPAConsent
	for rows.Next() {
		var c PDPAConsent
		var acceptedAt time.Time
		var ipAddr *string
		if err := rows.Scan(&c.ID, &c.ConsentType, &acceptedAt, &ipAddr); err != nil {
			return nil, fmt.Errorf("scan consent: %w", err)
		}
		c.AcceptedAt = acceptedAt.Format(time.RFC3339)
		if ipAddr != nil {
			c.IPAddress = *ipAddr
		}
		consents = append(consents, c)
	}
	return consents, rows.Err()
}

type CompleteProfileInput struct {
	FirstName string `json:"first_name" binding:"required"`
	LastName  string `json:"last_name" binding:"required"`
	Phone     string `json:"phone" binding:"required"`
	OtpID     string `json:"otp_id" binding:"required"`
	OtpCode   string `json:"otp_code" binding:"required"`
	Email     string `json:"email"`
}

func (s *Service) CompleteProfile(ctx context.Context, tenantID, userID string, input CompleteProfileInput) (*TokenPair, error) {
	if s.otpVerifier == nil {
		return nil, errors.New("OTP verification is not configured")
	}

	ok, err := s.otpVerifier.VerifyOTP(ctx, input.OtpID, input.OtpCode)
	if err != nil {
		return nil, fmt.Errorf("OTP verify: %w", err)
	}
	if !ok {
		return nil, errors.New("invalid or expired OTP code")
	}

	var existing int
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND phone = $2 AND id != $3 AND phone IS NOT NULL AND phone != ''`,
		tenantID, input.Phone, userID,
	).Scan(&existing)
	if existing > 0 {
		return nil, ErrPhoneExists
	}

	displayName := input.FirstName + " " + input.LastName

	emailExpr := "email"
	args := []any{input.FirstName, input.LastName, input.Phone, displayName, userID, tenantID}
	if input.Email != "" {
		emailExpr = "$7"
		args = append(args, input.Email)
	}

	query := fmt.Sprintf(
		`UPDATE users SET first_name = $1, last_name = $2, phone = $3, display_name = $4,
		 phone_verified = true, profile_completed = true, updated_at = NOW(),
		 email = %s
		 WHERE id = $5 AND tenant_id = $6`, emailExpr)

	_, err = s.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("update profile: %w", err)
	}

	pc := true
	tokens, err := s.generateTokenPair(userID, tenantID, "api_client", nil)
	if err != nil {
		return nil, err
	}
	tokens.ProfileCompleted = &pc
	return tokens, nil
}

func (s *Service) RequestPasswordReset(ctx context.Context, input PasswordResetRequestInput) (string, string, error) {
	if s.otpVerifier == nil {
		return "", "", errors.New("OTP verification is not configured")
	}

	var userID string
	err := s.db.QueryRow(ctx,
		`SELECT id
		 FROM users
		 WHERE tenant_id = $1 AND phone = $2 AND status = 'active'
		 LIMIT 1`,
		input.TenantID, input.Phone,
	).Scan(&userID)
	if err != nil {
		return "", "", ErrUserNotFound
	}

	otpID, refCode, err := s.otpVerifier.RequestOTP(ctx, input.Phone)
	if err != nil {
		return "", "", fmt.Errorf("request OTP: %w", err)
	}
	return otpID, refCode, nil
}

func (s *Service) ResetPassword(ctx context.Context, input PasswordResetInput) error {
	if s.otpVerifier == nil {
		return errors.New("OTP verification is not configured")
	}

	ok, err := s.otpVerifier.VerifyOTP(ctx, input.OtpID, input.OtpCode)
	if err != nil {
		return fmt.Errorf("OTP verify: %w", err)
	}
	if !ok {
		return errors.New("invalid or expired OTP code")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(input.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	cmd, err := s.db.Exec(ctx,
		`UPDATE users
		 SET password_hash = $1, updated_at = NOW()
		 WHERE tenant_id = $2 AND phone = $3 AND status = 'active'`,
		string(hash), input.TenantID, input.Phone,
	)
	if err != nil {
		return fmt.Errorf("update password: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrUserNotFound
	}

	return nil
}

func (s *Service) WithdrawPDPAConsent(ctx context.Context, userID, ipAddr string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`INSERT INTO pdpa_consents (user_id, consent_type, ip_address) VALUES ($1, 'withdrawal', $2)`,
		userID, ipAddr,
	)
	if err != nil {
		return fmt.Errorf("record withdrawal: %w", err)
	}

	_, err = tx.Exec(ctx,
		`UPDATE users SET deletion_requested_at = NOW(), updated_at = NOW() WHERE id = $1`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("mark deletion requested: %w", err)
	}

	return tx.Commit(ctx)
}

func (s *Service) generateTokenPair(userID, tenantID, role string, factoryID *string) (*TokenPair, error) {
	now := time.Now()

	accessClaims := middleware.Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
		UserID:    userID,
		TenantID:  tenantID,
		Role:      role,
		FactoryID: factoryID,
	}

	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).SignedString([]byte(s.jwtSecret))
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	refreshClaims := middleware.Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(now.Add(s.refreshTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
		UserID:    userID,
		TenantID:  tenantID,
		Role:      role,
		FactoryID: factoryID,
	}

	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString([]byte(s.jwtSecret))
	if err != nil {
		return nil, fmt.Errorf("sign refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(s.accessTTL.Seconds()),
	}, nil
}
