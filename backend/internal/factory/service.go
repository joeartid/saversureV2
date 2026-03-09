package factory

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

type Factory struct {
	ID           string  `json:"id"`
	TenantID     string  `json:"tenant_id"`
	Name         string  `json:"name"`
	Code         *string `json:"code"`
	FactoryType  string  `json:"factory_type"`
	ExportFormat int     `json:"export_format"`
	CodesPerRoll int     `json:"codes_per_roll"`
	RollsPerFile int     `json:"rolls_per_file"`
	ContactName  *string `json:"contact_name"`
	ContactPhone *string `json:"contact_phone"`
	ContactEmail *string `json:"contact_email"`
	Address      *string `json:"address"`
	Status       string  `json:"status"`
	CreatedAt    string  `json:"created_at"`
}

type CreateInput struct {
	TenantID     string `json:"-"`
	Name         string `json:"name" binding:"required"`
	Code         string `json:"code"`
	FactoryType  string `json:"factory_type"`
	ExportFormat *int   `json:"export_format"`
	CodesPerRoll *int   `json:"codes_per_roll"`
	RollsPerFile *int   `json:"rolls_per_file"`
	ContactName  string `json:"contact_name"`
	ContactPhone string `json:"contact_phone"`
	ContactEmail string `json:"contact_email"`
	Address      string `json:"address"`
}

type UpdateInput struct {
	Name         *string `json:"name"`
	Code         *string `json:"code"`
	FactoryType  *string `json:"factory_type"`
	ExportFormat *int    `json:"export_format"`
	CodesPerRoll *int    `json:"codes_per_roll"`
	RollsPerFile *int    `json:"rolls_per_file"`
	ContactName  *string `json:"contact_name"`
	ContactPhone *string `json:"contact_phone"`
	ContactEmail *string `json:"contact_email"`
	Address      *string `json:"address"`
	Status       *string `json:"status"`
}

func (s *Service) List(ctx context.Context, tenantID string, limit, offset int, factoryType string) ([]Factory, int64, error) {
	if limit <= 0 {
		limit = 50
	}

	where := "tenant_id = $1"
	args := []any{tenantID}
	argN := 2
	if factoryType != "" {
		where += fmt.Sprintf(" AND factory_type = $%d", argN)
		args = append(args, factoryType)
		argN++
	}

	var total int64
	_ = s.db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM factories WHERE %s", where), args...).Scan(&total)

	query := fmt.Sprintf(
		`SELECT id, tenant_id, name, code, factory_type, export_format, codes_per_roll, rolls_per_file,
		        contact_name, contact_phone, contact_email, address, status, created_at::text
		 FROM factories WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, argN, argN+1,
	)
	args = append(args, limit, offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list factories: %w", err)
	}
	defer rows.Close()

	var factories []Factory
	for rows.Next() {
		var f Factory
		if err := rows.Scan(&f.ID, &f.TenantID, &f.Name, &f.Code, &f.FactoryType,
			&f.ExportFormat, &f.CodesPerRoll, &f.RollsPerFile,
			&f.ContactName, &f.ContactPhone, &f.ContactEmail, &f.Address, &f.Status, &f.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan factory: %w", err)
		}
		factories = append(factories, f)
	}
	return factories, total, nil
}

var validFactoryTypes = map[string]bool{"general": true, "sticker_printer": true, "applicator": true}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Factory, error) {
	ft := input.FactoryType
	if ft == "" {
		ft = "general"
	}
	if !validFactoryTypes[ft] {
		return nil, fmt.Errorf("invalid factory_type: %s", ft)
	}

	exportFmt := 1
	if input.ExportFormat != nil && *input.ExportFormat >= 1 && *input.ExportFormat <= 4 {
		exportFmt = *input.ExportFormat
	}
	cpr := 10000
	if input.CodesPerRoll != nil && *input.CodesPerRoll > 0 {
		cpr = *input.CodesPerRoll
	}
	rpf := 4
	if input.RollsPerFile != nil && *input.RollsPerFile > 0 {
		rpf = *input.RollsPerFile
	}

	var f Factory
	err := s.db.QueryRow(ctx,
		`INSERT INTO factories (tenant_id, name, code, factory_type, export_format, codes_per_roll, rolls_per_file,
		                        contact_name, contact_phone, contact_email, address)
		 VALUES ($1, $2, NULLIF($3,''), $4, $5, $6, $7, NULLIF($8,''), NULLIF($9,''), NULLIF($10,''), NULLIF($11,''))
		 RETURNING id, tenant_id, name, code, factory_type, export_format, codes_per_roll, rolls_per_file,
		           contact_name, contact_phone, contact_email, address, status, created_at::text`,
		input.TenantID, input.Name, input.Code, ft, exportFmt, cpr, rpf,
		input.ContactName, input.ContactPhone, input.ContactEmail, input.Address,
	).Scan(&f.ID, &f.TenantID, &f.Name, &f.Code, &f.FactoryType,
		&f.ExportFormat, &f.CodesPerRoll, &f.RollsPerFile,
		&f.ContactName, &f.ContactPhone, &f.ContactEmail, &f.Address, &f.Status, &f.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create factory: %w", err)
	}
	return &f, nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, input UpdateInput) (*Factory, error) {
	if input.FactoryType != nil && !validFactoryTypes[*input.FactoryType] {
		return nil, fmt.Errorf("invalid factory_type: %s", *input.FactoryType)
	}
	if input.Status != nil {
		valid := map[string]bool{"active": true, "inactive": true}
		if !valid[*input.Status] {
			return nil, fmt.Errorf("invalid status: %s", *input.Status)
		}
	}

	setClauses := []string{}
	args := []any{id, tenantID}
	argN := 3

	addSetStr := func(col string, val *string, nullifEmpty bool) {
		if val == nil {
			return
		}
		if nullifEmpty {
			setClauses = append(setClauses, fmt.Sprintf("%s = NULLIF($%d, '')", col, argN))
		} else {
			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, argN))
		}
		args = append(args, *val)
		argN++
	}
	addSetInt := func(col string, val *int) {
		if val == nil {
			return
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", col, argN))
		args = append(args, *val)
		argN++
	}

	addSetStr("name", input.Name, false)
	addSetStr("code", input.Code, true)
	addSetStr("factory_type", input.FactoryType, false)
	addSetInt("export_format", input.ExportFormat)
	addSetInt("codes_per_roll", input.CodesPerRoll)
	addSetInt("rolls_per_file", input.RollsPerFile)
	addSetStr("contact_name", input.ContactName, true)
	addSetStr("contact_phone", input.ContactPhone, true)
	addSetStr("contact_email", input.ContactEmail, true)
	addSetStr("address", input.Address, true)
	addSetStr("status", input.Status, false)

	if len(setClauses) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	setClauses = append(setClauses, "updated_at = NOW()")

	query := fmt.Sprintf(
		`UPDATE factories SET %s WHERE id = $1 AND tenant_id = $2
		 RETURNING id, tenant_id, name, code, factory_type, export_format, codes_per_roll, rolls_per_file,
		           contact_name, contact_phone, contact_email, address, status, created_at::text`,
		joinStr(setClauses, ", "),
	)

	var f Factory
	err := s.db.QueryRow(ctx, query, args...).Scan(
		&f.ID, &f.TenantID, &f.Name, &f.Code, &f.FactoryType,
		&f.ExportFormat, &f.CodesPerRoll, &f.RollsPerFile,
		&f.ContactName, &f.ContactPhone, &f.ContactEmail, &f.Address, &f.Status, &f.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update factory: %w", err)
	}
	return &f, nil
}

func joinStr(parts []string, sep string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += sep
		}
		result += p
	}
	return result
}

// ---- Factory Products (many-to-many) ----

type FactoryProduct struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	SKU          *string `json:"sku"`
	ImageURL     *string `json:"image_url"`
	PointsPerScan int    `json:"points_per_scan"`
	Status       string  `json:"status"`
	AssignedAt   string  `json:"assigned_at"`
}

func (s *Service) ListProducts(ctx context.Context, tenantID, factoryID string) ([]FactoryProduct, error) {
	rows, err := s.db.Query(ctx,
		`SELECT p.id, p.name, p.sku, p.image_url, p.points_per_scan, p.status, fp.created_at::text
		 FROM factory_products fp
		 JOIN products p ON p.id = fp.product_id
		 WHERE fp.factory_id = $1 AND fp.tenant_id = $2
		 ORDER BY p.name ASC`,
		factoryID, tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("list factory products: %w", err)
	}
	defer rows.Close()

	var products []FactoryProduct
	for rows.Next() {
		var p FactoryProduct
		if err := rows.Scan(&p.ID, &p.Name, &p.SKU, &p.ImageURL, &p.PointsPerScan, &p.Status, &p.AssignedAt); err != nil {
			return nil, fmt.Errorf("scan factory product: %w", err)
		}
		products = append(products, p)
	}
	if products == nil {
		products = []FactoryProduct{}
	}
	return products, nil
}

func (s *Service) AssignProduct(ctx context.Context, tenantID, factoryID, productID string) error {
	_, err := s.db.Exec(ctx,
		`INSERT INTO factory_products (factory_id, product_id, tenant_id)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (factory_id, product_id) DO NOTHING`,
		factoryID, productID, tenantID,
	)
	if err != nil {
		return fmt.Errorf("assign product: %w", err)
	}
	return nil
}

func (s *Service) RemoveProduct(ctx context.Context, tenantID, factoryID, productID string) error {
	result, err := s.db.Exec(ctx,
		`DELETE FROM factory_products WHERE factory_id = $1 AND product_id = $2 AND tenant_id = $3`,
		factoryID, productID, tenantID,
	)
	if err != nil {
		return fmt.Errorf("remove product: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("assignment not found")
	}
	return nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	result, err := s.db.Exec(ctx,
		`DELETE FROM factories WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return fmt.Errorf("delete factory: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("factory not found")
	}
	return nil
}
