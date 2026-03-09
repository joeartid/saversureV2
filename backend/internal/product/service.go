package product

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

type Product struct {
	ID           string  `json:"id"`
	TenantID     string  `json:"tenant_id"`
	Name         string  `json:"name"`
	SKU          *string `json:"sku"`
	Description  *string `json:"description"`
	ImageURL     *string `json:"image_url"`
	PointsPerScan int    `json:"points_per_scan"`
	Status       string  `json:"status"`
	CreatedAt    string  `json:"created_at"`
}

type ListFilter struct {
	Status    string
	FactoryID string // ถ้าระบุ จะ filter เฉพาะสินค้าที่ assign ให้ factory นั้น
	Limit     int
	Offset    int
}

type CreateInput struct {
	TenantID      string `json:"-"`
	Name          string `json:"name" binding:"required"`
	SKU           string `json:"sku"`
	Description   string `json:"description"`
	ImageURL      string `json:"image_url"`
	PointsPerScan int    `json:"points_per_scan"`
}

type UpdateInput struct {
	Name          *string `json:"name"`
	SKU           *string `json:"sku"`
	Description   *string `json:"description"`
	ImageURL      *string `json:"image_url"`
	PointsPerScan *int    `json:"points_per_scan"`
	Status        *string `json:"status"`
}

func (s *Service) List(ctx context.Context, tenantID string, f ListFilter) ([]Product, int64, error) {
	if f.Limit <= 0 {
		f.Limit = 50
	}

	// ถ้ามี factory_id filter ให้ join factory_products
	if f.FactoryID != "" {
		return s.listByFactory(ctx, tenantID, f)
	}

	where := "tenant_id = $1"
	args := []any{tenantID}
	argN := 2

	if f.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argN)
		args = append(args, f.Status)
		argN++
	}

	var total int64
	_ = s.db.QueryRow(ctx,
		fmt.Sprintf("SELECT COUNT(*) FROM products WHERE %s", where),
		args...,
	).Scan(&total)

	query := fmt.Sprintf(
		`SELECT id, tenant_id, name, sku, description, image_url, points_per_scan, status, created_at::text
		 FROM products WHERE %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, argN, argN+1,
	)
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list products: %w", err)
	}
	defer rows.Close()

	var products []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.TenantID, &p.Name, &p.SKU, &p.Description,
			&p.ImageURL, &p.PointsPerScan, &p.Status, &p.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan product: %w", err)
		}
		products = append(products, p)
	}
	return products, total, nil
}

func (s *Service) listByFactory(ctx context.Context, tenantID string, f ListFilter) ([]Product, int64, error) {
	args := []any{f.FactoryID, tenantID}
	argN := 3
	extraWhere := ""
	if f.Status != "" {
		extraWhere = fmt.Sprintf(" AND p.status = $%d", argN)
		args = append(args, f.Status)
		argN++
	}

	var total int64
	_ = s.db.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM factory_products fp
		 JOIN products p ON p.id = fp.product_id
		 WHERE fp.factory_id = $1 AND fp.tenant_id = $2%s`, extraWhere),
		args...,
	).Scan(&total)

	query := fmt.Sprintf(
		`SELECT p.id, p.tenant_id, p.name, p.sku, p.description, p.image_url, p.points_per_scan, p.status, p.created_at::text
		 FROM factory_products fp
		 JOIN products p ON p.id = fp.product_id
		 WHERE fp.factory_id = $1 AND fp.tenant_id = $2%s
		 ORDER BY p.name ASC LIMIT $%d OFFSET $%d`,
		extraWhere, argN, argN+1,
	)
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list products by factory: %w", err)
	}
	defer rows.Close()

	var products []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.TenantID, &p.Name, &p.SKU, &p.Description,
			&p.ImageURL, &p.PointsPerScan, &p.Status, &p.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan product: %w", err)
		}
		products = append(products, p)
	}
	if products == nil {
		products = []Product{}
	}
	return products, total, nil
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*Product, error) {
	pps := input.PointsPerScan
	if pps <= 0 {
		pps = 1
	}

	var p Product
	err := s.db.QueryRow(ctx,
		`INSERT INTO products (tenant_id, name, sku, description, image_url, points_per_scan)
		 VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), $6)
		 RETURNING id, tenant_id, name, sku, description, image_url, points_per_scan, status, created_at::text`,
		input.TenantID, input.Name, input.SKU, input.Description, input.ImageURL, pps,
	).Scan(&p.ID, &p.TenantID, &p.Name, &p.SKU, &p.Description,
		&p.ImageURL, &p.PointsPerScan, &p.Status, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create product: %w", err)
	}
	return &p, nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, input UpdateInput) (*Product, error) {
	if input.Name != nil {
		s.db.Exec(ctx, `UPDATE products SET name = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.Name)
	}
	if input.SKU != nil {
		s.db.Exec(ctx, `UPDATE products SET sku = NULLIF($3,''), updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.SKU)
	}
	if input.Description != nil {
		s.db.Exec(ctx, `UPDATE products SET description = NULLIF($3,''), updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.Description)
	}
	if input.ImageURL != nil {
		s.db.Exec(ctx, `UPDATE products SET image_url = NULLIF($3,''), updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.ImageURL)
	}
	if input.PointsPerScan != nil {
		s.db.Exec(ctx, `UPDATE products SET points_per_scan = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.PointsPerScan)
	}
	if input.Status != nil {
		valid := map[string]bool{"active": true, "inactive": true}
		if !valid[*input.Status] {
			return nil, fmt.Errorf("invalid status: %s", *input.Status)
		}
		s.db.Exec(ctx, `UPDATE products SET status = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.Status)
	}

	var p Product
	err := s.db.QueryRow(ctx,
		`SELECT id, tenant_id, name, sku, description, image_url, points_per_scan, status, created_at::text
		 FROM products WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	).Scan(&p.ID, &p.TenantID, &p.Name, &p.SKU, &p.Description,
		&p.ImageURL, &p.PointsPerScan, &p.Status, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("product not found: %w", err)
	}
	return &p, nil
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	result, err := s.db.Exec(ctx,
		`DELETE FROM products WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	)
	if err != nil {
		return fmt.Errorf("delete product: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("product not found")
	}
	return nil
}

type ImportResult struct {
	Total    int      `json:"total"`
	Imported int      `json:"imported"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors,omitempty"`
}

func (s *Service) ImportCSV(ctx context.Context, tenantID string, reader io.Reader) (*ImportResult, error) {
	csvReader := csv.NewReader(reader)
	result := &ImportResult{}

	header, err := csvReader.Read()
	if err != nil {
		return nil, fmt.Errorf("read CSV header: %w", err)
	}

	// Find column indices (case-insensitive)
	nameIdx, skuIdx, descIdx, ppsIdx := -1, -1, -1, -1
	for i, col := range header {
		col = strings.TrimSpace(strings.ToLower(col))
		switch col {
		case "name":
			nameIdx = i
		case "sku":
			skuIdx = i
		case "description":
			descIdx = i
		case "points_per_scan":
			ppsIdx = i
		}
	}
	if nameIdx < 0 || skuIdx < 0 {
		return nil, fmt.Errorf("CSV must have 'name' and 'sku' columns")
	}

	rowNum := 0
	for {
		record, err := csvReader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read CSV row: %w", err)
		}
		rowNum++

		result.Total++

		// Parse fields (with bounds check)
		if nameIdx >= len(record) || skuIdx >= len(record) {
			result.Errors = append(result.Errors, fmt.Sprintf("row %d: insufficient columns", rowNum))
			continue
		}
		name := strings.TrimSpace(record[nameIdx])
		sku := strings.TrimSpace(record[skuIdx])
		if name == "" || sku == "" {
			result.Errors = append(result.Errors, fmt.Sprintf("row %d: name and sku are required", rowNum))
			continue
		}

		description := ""
		if descIdx >= 0 && descIdx < len(record) {
			description = strings.TrimSpace(record[descIdx])
		}

		pointsPerScan := 1
		if ppsIdx >= 0 && ppsIdx < len(record) {
			if v, err := strconv.Atoi(strings.TrimSpace(record[ppsIdx])); err == nil && v > 0 {
				pointsPerScan = v
			}
		}

		// Check if SKU exists
		var exists bool
		err = s.db.QueryRow(ctx,
			"SELECT EXISTS(SELECT 1 FROM products WHERE tenant_id = $1 AND sku = $2)",
			tenantID, sku,
		).Scan(&exists)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("row %d: %v", rowNum, err))
			continue
		}
		if exists {
			result.Skipped++
			continue
		}

		// Insert
		_, err = s.db.Exec(ctx,
			`INSERT INTO products (tenant_id, name, sku, description, image_url, points_per_scan)
			 VALUES ($1, $2, $3, NULLIF($4,''), NULL, $5)`,
			tenantID, name, sku, description, pointsPerScan,
		)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("row %d: %v", rowNum, err))
			continue
		}
		result.Imported++
	}
	return result, nil
}
