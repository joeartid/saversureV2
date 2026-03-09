package platform

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type IdentityService struct {
	db *pgxpool.Pool
}

func NewIdentityService(db *pgxpool.Pool) *IdentityService {
	return &IdentityService{db: db}
}

type CrossTenantLink struct {
	ID             string `json:"id"`
	PlatformUserID string `json:"platform_user_id"`
	TenantID       string `json:"tenant_id"`
	UserID         string `json:"user_id"`
	IdentityType   string `json:"identity_type"`
	IdentityKey    string `json:"identity_key"`
	LinkedAt       string `json:"linked_at"`
}

type PlatformUser struct {
	PlatformUserID string             `json:"platform_user_id"`
	Links          []CrossTenantLink  `json:"links"`
}

// LinkUser links a per-tenant user to a platform-wide identity.
// If identityKey (e.g. LINE user_id) already exists in another tenant, they share the same platform_user_id.
func (s *IdentityService) LinkUser(ctx context.Context, tenantID, userID, identityType, identityKey string) (*CrossTenantLink, error) {
	var existing CrossTenantLink
	err := s.db.QueryRow(ctx,
		`SELECT id, platform_user_id, tenant_id, user_id, identity_type, identity_key, linked_at::text
		 FROM cross_tenant_identities
		 WHERE tenant_id = $1 AND user_id = $2`,
		tenantID, userID,
	).Scan(&existing.ID, &existing.PlatformUserID, &existing.TenantID, &existing.UserID,
		&existing.IdentityType, &existing.IdentityKey, &existing.LinkedAt)
	if err == nil {
		return &existing, nil
	}

	var platformUserID string
	err = s.db.QueryRow(ctx,
		`SELECT platform_user_id FROM cross_tenant_identities
		 WHERE identity_type = $1 AND identity_key = $2
		 LIMIT 1`,
		identityType, identityKey,
	).Scan(&platformUserID)
	if err == pgx.ErrNoRows {
		platformUserID = uuid.New().String()
	} else if err != nil {
		return nil, fmt.Errorf("lookup platform user: %w", err)
	}

	var link CrossTenantLink
	err = s.db.QueryRow(ctx,
		`INSERT INTO cross_tenant_identities (platform_user_id, tenant_id, user_id, identity_type, identity_key)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (tenant_id, user_id) DO UPDATE SET identity_key = EXCLUDED.identity_key
		 RETURNING id, platform_user_id, tenant_id, user_id, identity_type, identity_key, linked_at::text`,
		platformUserID, tenantID, userID, identityType, identityKey,
	).Scan(&link.ID, &link.PlatformUserID, &link.TenantID, &link.UserID,
		&link.IdentityType, &link.IdentityKey, &link.LinkedAt)
	if err != nil {
		return nil, fmt.Errorf("link user: %w", err)
	}

	return &link, nil
}

// GetPlatformUser returns all linked brand accounts for a platform user.
func (s *IdentityService) GetPlatformUser(ctx context.Context, platformUserID string) (*PlatformUser, error) {
	rows, err := s.db.Query(ctx,
		`SELECT cti.id, cti.platform_user_id, cti.tenant_id, cti.user_id,
			cti.identity_type, cti.identity_key, cti.linked_at::text,
			t.name AS tenant_name, t.slug AS tenant_slug
		 FROM cross_tenant_identities cti
		 JOIN tenants t ON t.id = cti.tenant_id
		 WHERE cti.platform_user_id = $1
		 ORDER BY cti.linked_at`,
		platformUserID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pu := &PlatformUser{PlatformUserID: platformUserID}
	for rows.Next() {
		var link CrossTenantLink
		var tenantName, tenantSlug string
		if err := rows.Scan(&link.ID, &link.PlatformUserID, &link.TenantID, &link.UserID,
			&link.IdentityType, &link.IdentityKey, &link.LinkedAt, &tenantName, &tenantSlug); err != nil {
			continue
		}
		pu.Links = append(pu.Links, link)
	}

	if len(pu.Links) == 0 {
		return nil, fmt.Errorf("platform user not found")
	}

	return pu, nil
}

// FindPlatformUserByIdentity finds the platform user from an identity key (e.g. LINE user_id).
func (s *IdentityService) FindPlatformUserByIdentity(ctx context.Context, identityType, identityKey string) (string, error) {
	var platformUserID string
	err := s.db.QueryRow(ctx,
		`SELECT platform_user_id FROM cross_tenant_identities
		 WHERE identity_type = $1 AND identity_key = $2 LIMIT 1`,
		identityType, identityKey,
	).Scan(&platformUserID)
	if err != nil {
		return "", fmt.Errorf("identity not found: %w", err)
	}
	return platformUserID, nil
}
