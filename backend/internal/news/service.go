package news

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

type News struct {
	ID          string  `json:"id"`
	TenantID    string  `json:"tenant_id"`
	Title       string  `json:"title"`
	Content     *string `json:"content"`
	ImageURL    *string `json:"image_url"`
	LinkURL     *string `json:"link_url"`
	Position    int     `json:"position"`
	Type        string  `json:"type"`
	Status      string  `json:"status"`
	PublishedAt *string `json:"published_at"`
	CreatedAt   string  `json:"created_at"`
}

type ListFilter struct {
	Status string
	Type   string
	Limit  int
	Offset int
}

type CreateInput struct {
	TenantID string `json:"-"`
	Title    string `json:"title" binding:"required"`
	Content  string `json:"content"`
	ImageURL string `json:"image_url"`
	LinkURL  string `json:"link_url"`
	Position int    `json:"position"`
	Type     string `json:"type"`
}

type UpdateInput struct {
	Title    *string `json:"title"`
	Content  *string `json:"content"`
	ImageURL *string `json:"image_url"`
	LinkURL  *string `json:"link_url"`
	Position *int    `json:"position"`
	Type     *string `json:"type"`
	Status   *string `json:"status"`
}

func (s *Service) List(ctx context.Context, tenantID string, f ListFilter) ([]News, int64, error) {
	if f.Limit <= 0 {
		f.Limit = 50
	}

	where := "tenant_id = $1"
	args := []any{tenantID}
	argN := 2

	if f.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argN)
		args = append(args, f.Status)
		argN++
	}
	if f.Type != "" {
		where += fmt.Sprintf(" AND type = $%d", argN)
		args = append(args, f.Type)
		argN++
	}

	var total int64
	_ = s.db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM news WHERE %s", where), args...).Scan(&total)

	query := fmt.Sprintf(
		`SELECT id, tenant_id, title, content, image_url, link_url, position, type, status, published_at::text, created_at::text
		 FROM news WHERE %s ORDER BY position ASC, created_at DESC LIMIT $%d OFFSET $%d`,
		where, argN, argN+1,
	)
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list news: %w", err)
	}
	defer rows.Close()

	var items []News
	for rows.Next() {
		var n News
		if err := rows.Scan(&n.ID, &n.TenantID, &n.Title, &n.Content, &n.ImageURL,
			&n.LinkURL, &n.Position, &n.Type, &n.Status, &n.PublishedAt, &n.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan news: %w", err)
		}
		items = append(items, n)
	}
	return items, total, nil
}

func (s *Service) ListPublished(ctx context.Context, tenantID string, newsType string, limit int) ([]News, error) {
	if limit <= 0 {
		limit = 20
	}

	where := "tenant_id = $1 AND status = 'published'"
	args := []any{tenantID}
	argN := 2

	if newsType != "" {
		where += fmt.Sprintf(" AND type = $%d", argN)
		args = append(args, newsType)
		argN++
	}

	query := fmt.Sprintf(
		`SELECT id, tenant_id, title, content, image_url, link_url, position, type, status, published_at::text, created_at::text
		 FROM news WHERE %s ORDER BY position ASC, created_at DESC LIMIT $%d`,
		where, argN,
	)
	args = append(args, limit)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list published news: %w", err)
	}
	defer rows.Close()

	var items []News
	for rows.Next() {
		var n News
		if err := rows.Scan(&n.ID, &n.TenantID, &n.Title, &n.Content, &n.ImageURL,
			&n.LinkURL, &n.Position, &n.Type, &n.Status, &n.PublishedAt, &n.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan news: %w", err)
		}
		items = append(items, n)
	}
	return items, nil
}

func (s *Service) GetByID(ctx context.Context, tenantID, id string) (*News, error) {
	var n News
	err := s.db.QueryRow(ctx,
		`SELECT id, tenant_id, title, content, image_url, link_url, position, type, status, published_at::text, created_at::text
		 FROM news WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	).Scan(&n.ID, &n.TenantID, &n.Title, &n.Content, &n.ImageURL,
		&n.LinkURL, &n.Position, &n.Type, &n.Status, &n.PublishedAt, &n.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("news not found: %w", err)
	}
	return &n, nil
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*News, error) {
	if input.Type == "" {
		input.Type = "news"
	}
	valid := map[string]bool{"news": true, "banner": true}
	if !valid[input.Type] {
		return nil, fmt.Errorf("invalid type: %s", input.Type)
	}

	var n News
	err := s.db.QueryRow(ctx,
		`INSERT INTO news (tenant_id, title, content, image_url, link_url, position, type)
		 VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), $6, $7)
		 RETURNING id, tenant_id, title, content, image_url, link_url, position, type, status, published_at::text, created_at::text`,
		input.TenantID, input.Title, input.Content, input.ImageURL, input.LinkURL, input.Position, input.Type,
	).Scan(&n.ID, &n.TenantID, &n.Title, &n.Content, &n.ImageURL,
		&n.LinkURL, &n.Position, &n.Type, &n.Status, &n.PublishedAt, &n.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create news: %w", err)
	}
	return &n, nil
}

func (s *Service) Update(ctx context.Context, tenantID, id string, input UpdateInput) (*News, error) {
	query := "UPDATE news SET updated_at = NOW()"
	args := []any{id, tenantID}
	argID := 3

	if input.Title != nil {
		query += fmt.Sprintf(", title = $%d", argID)
		args = append(args, *input.Title)
		argID++
	}
	if input.Content != nil {
		query += fmt.Sprintf(", content = NULLIF($%d, '')", argID)
		args = append(args, *input.Content)
		argID++
	}
	if input.ImageURL != nil {
		query += fmt.Sprintf(", image_url = NULLIF($%d, '')", argID)
		args = append(args, *input.ImageURL)
		argID++
	}
	if input.LinkURL != nil {
		query += fmt.Sprintf(", link_url = NULLIF($%d, '')", argID)
		args = append(args, *input.LinkURL)
		argID++
	}
	if input.Position != nil {
		query += fmt.Sprintf(", position = $%d", argID)
		args = append(args, *input.Position)
		argID++
	}
	if input.Type != nil {
		valid := map[string]bool{"news": true, "banner": true}
		if !valid[*input.Type] {
			return nil, fmt.Errorf("invalid type: %s", *input.Type)
		}
		query += fmt.Sprintf(", type = $%d", argID)
		args = append(args, *input.Type)
		argID++
	}
	if input.Status != nil {
		valid := map[string]bool{"draft": true, "published": true, "archived": true}
		if !valid[*input.Status] {
			return nil, fmt.Errorf("invalid status: %s", *input.Status)
		}
		if *input.Status == "published" {
			query += fmt.Sprintf(", status = $%d, published_at = NOW()", argID)
		} else {
			query += fmt.Sprintf(", status = $%d", argID)
		}
		args = append(args, *input.Status)
		argID++
	}

	query += " WHERE id = $1 AND tenant_id = $2"

	if len(args) > 2 {
		result, err := s.db.Exec(ctx, query, args...)
		if err != nil {
			return nil, fmt.Errorf("update news db.Exec error: %w", err)
		}
		if result.RowsAffected() == 0 {
			return nil, fmt.Errorf("news not found or no rows affected")
		}
	}

	return s.GetByID(ctx, tenantID, id)
}

func (s *Service) Delete(ctx context.Context, tenantID, id string) error {
	result, err := s.db.Exec(ctx, `DELETE FROM news WHERE id = $1 AND tenant_id = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("delete news: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("news not found")
	}
	return nil
}
