package luckydraw

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"

	"saversure/internal/apperror"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

type Campaign struct {
	ID                string  `json:"id"`
	TenantID          string  `json:"tenant_id"`
	Title             string  `json:"title"`
	Description       *string `json:"description"`
	ImageURL          *string `json:"image_url"`
	CostPoints        int     `json:"cost_points"`
	MaxTicketsPerUser int     `json:"max_tickets_per_user"`
	TotalTickets      int     `json:"total_tickets"`
	Status            string  `json:"status"`
	RegistrationStart *string `json:"registration_start"`
	RegistrationEnd   *string `json:"registration_end"`
	DrawDate          *string `json:"draw_date"`
	CreatedAt         string  `json:"created_at"`
	PrizeCount        int     `json:"prize_count,omitempty"`
	TicketCount       int     `json:"ticket_count,omitempty"`
}

type Prize struct {
	ID          string  `json:"id"`
	CampaignID  string  `json:"campaign_id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	ImageURL    *string `json:"image_url"`
	Quantity    int     `json:"quantity"`
	PrizeOrder  int     `json:"prize_order"`
	CreatedAt   string  `json:"created_at"`
}

type Ticket struct {
	ID           string `json:"id"`
	CampaignID   string `json:"campaign_id"`
	UserID       string `json:"user_id"`
	TicketNumber string `json:"ticket_number"`
	PointsSpent  int    `json:"points_spent"`
	CreatedAt    string `json:"created_at"`
}

type Winner struct {
	ID           string `json:"id"`
	CampaignID   string `json:"campaign_id"`
	PrizeID      string `json:"prize_id"`
	TicketID     string `json:"ticket_id"`
	UserID       string `json:"user_id"`
	PrizeName    string `json:"prize_name"`
	TicketNumber string `json:"ticket_number"`
	AnnouncedAt  string `json:"announced_at"`
}

type CreateCampaignInput struct {
	TenantID          string `json:"-"`
	Title             string `json:"title" binding:"required"`
	Description       string `json:"description"`
	ImageURL          string `json:"image_url"`
	CostPoints        int    `json:"cost_points"`
	MaxTicketsPerUser int    `json:"max_tickets_per_user"`
	RegistrationStart string `json:"registration_start"`
	RegistrationEnd   string `json:"registration_end"`
	DrawDate          string `json:"draw_date"`
}

type UpdateCampaignInput struct {
	Title             *string `json:"title"`
	Description       *string `json:"description"`
	ImageURL          *string `json:"image_url"`
	CostPoints        *int    `json:"cost_points"`
	MaxTicketsPerUser *int    `json:"max_tickets_per_user"`
	Status            *string `json:"status"`
	RegistrationStart *string `json:"registration_start"`
	RegistrationEnd   *string `json:"registration_end"`
	DrawDate          *string `json:"draw_date"`
}

type CreatePrizeInput struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	ImageURL    string `json:"image_url"`
	Quantity    int    `json:"quantity"`
	PrizeOrder  int    `json:"prize_order"`
}

func (s *Service) ListCampaigns(ctx context.Context, tenantID string, limit, offset int) ([]Campaign, int64, error) {
	if limit <= 0 {
		limit = 50
	}

	var total int64
	_ = s.db.QueryRow(ctx, "SELECT COUNT(*) FROM lucky_draw_campaigns WHERE tenant_id = $1", tenantID).Scan(&total)

	rows, err := s.db.Query(ctx,
		`SELECT ldc.id, ldc.tenant_id, ldc.title, ldc.description, ldc.image_url,
		        ldc.cost_points, ldc.max_tickets_per_user, ldc.total_tickets, ldc.status,
		        ldc.registration_start::text, ldc.registration_end::text, ldc.draw_date::text, ldc.created_at::text,
		        (SELECT COUNT(*) FROM lucky_draw_prizes WHERE campaign_id = ldc.id),
		        (SELECT COUNT(*) FROM lucky_draw_tickets WHERE campaign_id = ldc.id)
		 FROM lucky_draw_campaigns ldc
		 WHERE ldc.tenant_id = $1
		 ORDER BY ldc.created_at DESC LIMIT $2 OFFSET $3`,
		tenantID, limit, offset,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("list campaigns: %w", err)
	}
	defer rows.Close()

	var campaigns []Campaign
	for rows.Next() {
		var c Campaign
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Title, &c.Description, &c.ImageURL,
			&c.CostPoints, &c.MaxTicketsPerUser, &c.TotalTickets, &c.Status,
			&c.RegistrationStart, &c.RegistrationEnd, &c.DrawDate, &c.CreatedAt,
			&c.PrizeCount, &c.TicketCount); err != nil {
			return nil, 0, fmt.Errorf("scan campaign: %w", err)
		}
		campaigns = append(campaigns, c)
	}
	return campaigns, total, nil
}

func (s *Service) ListActiveCampaigns(ctx context.Context, tenantID string) ([]Campaign, error) {
	rows, err := s.db.Query(ctx,
		`SELECT ldc.id, ldc.tenant_id, ldc.title, ldc.description, ldc.image_url,
		        ldc.cost_points, ldc.max_tickets_per_user, ldc.total_tickets, ldc.status,
		        ldc.registration_start::text, ldc.registration_end::text, ldc.draw_date::text, ldc.created_at::text,
		        (SELECT COUNT(*) FROM lucky_draw_prizes WHERE campaign_id = ldc.id),
		        (SELECT COUNT(*) FROM lucky_draw_tickets WHERE campaign_id = ldc.id)
		 FROM lucky_draw_campaigns ldc
		 WHERE ldc.tenant_id = $1 AND ldc.status IN ('active', 'announced')
		 ORDER BY ldc.created_at DESC`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("list active campaigns: %w", err)
	}
	defer rows.Close()

	var campaigns []Campaign
	for rows.Next() {
		var c Campaign
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Title, &c.Description, &c.ImageURL,
			&c.CostPoints, &c.MaxTicketsPerUser, &c.TotalTickets, &c.Status,
			&c.RegistrationStart, &c.RegistrationEnd, &c.DrawDate, &c.CreatedAt,
			&c.PrizeCount, &c.TicketCount); err != nil {
			return nil, fmt.Errorf("scan campaign: %w", err)
		}
		campaigns = append(campaigns, c)
	}
	return campaigns, nil
}

func (s *Service) GetCampaign(ctx context.Context, tenantID, id string) (*Campaign, []Prize, error) {
	var c Campaign
	err := s.db.QueryRow(ctx,
		`SELECT id, tenant_id, title, description, image_url, cost_points, max_tickets_per_user, total_tickets, status,
		        registration_start::text, registration_end::text, draw_date::text, created_at::text
		 FROM lucky_draw_campaigns WHERE id = $1 AND tenant_id = $2`,
		id, tenantID,
	).Scan(&c.ID, &c.TenantID, &c.Title, &c.Description, &c.ImageURL,
		&c.CostPoints, &c.MaxTicketsPerUser, &c.TotalTickets, &c.Status,
		&c.RegistrationStart, &c.RegistrationEnd, &c.DrawDate, &c.CreatedAt)
	if err != nil {
		return nil, nil, fmt.Errorf("campaign not found: %w", err)
	}

	rows, err := s.db.Query(ctx,
		`SELECT id, campaign_id, name, description, image_url, quantity, prize_order, created_at::text
		 FROM lucky_draw_prizes WHERE campaign_id = $1 ORDER BY prize_order ASC`,
		id,
	)
	if err != nil {
		return &c, nil, fmt.Errorf("list prizes: %w", err)
	}
	defer rows.Close()

	var prizes []Prize
	for rows.Next() {
		var p Prize
		if err := rows.Scan(&p.ID, &p.CampaignID, &p.Name, &p.Description, &p.ImageURL,
			&p.Quantity, &p.PrizeOrder, &p.CreatedAt); err != nil {
			return &c, nil, fmt.Errorf("scan prize: %w", err)
		}
		prizes = append(prizes, p)
	}
	return &c, prizes, nil
}

func (s *Service) CreateCampaign(ctx context.Context, input CreateCampaignInput) (*Campaign, error) {
	if input.MaxTicketsPerUser <= 0 {
		input.MaxTicketsPerUser = 1
	}

	var c Campaign
	err := s.db.QueryRow(ctx,
		`INSERT INTO lucky_draw_campaigns (tenant_id, title, description, image_url, cost_points, max_tickets_per_user,
		        registration_start, registration_end, draw_date)
		 VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), $5, $6,
		        CASE WHEN $7 = '' THEN NULL ELSE $7::timestamptz END,
		        CASE WHEN $8 = '' THEN NULL ELSE $8::timestamptz END,
		        CASE WHEN $9 = '' THEN NULL ELSE $9::timestamptz END)
		 RETURNING id, tenant_id, title, description, image_url, cost_points, max_tickets_per_user, total_tickets, status,
		        registration_start::text, registration_end::text, draw_date::text, created_at::text`,
		input.TenantID, input.Title, input.Description, input.ImageURL, input.CostPoints, input.MaxTicketsPerUser,
		input.RegistrationStart, input.RegistrationEnd, input.DrawDate,
	).Scan(&c.ID, &c.TenantID, &c.Title, &c.Description, &c.ImageURL,
		&c.CostPoints, &c.MaxTicketsPerUser, &c.TotalTickets, &c.Status,
		&c.RegistrationStart, &c.RegistrationEnd, &c.DrawDate, &c.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create campaign: %w", err)
	}
	return &c, nil
}

func (s *Service) UpdateCampaign(ctx context.Context, tenantID, id string, input UpdateCampaignInput) (*Campaign, error) {
	if input.Title != nil {
		s.db.Exec(ctx, `UPDATE lucky_draw_campaigns SET title = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.Title)
	}
	if input.Description != nil {
		s.db.Exec(ctx, `UPDATE lucky_draw_campaigns SET description = NULLIF($3,''), updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.Description)
	}
	if input.ImageURL != nil {
		s.db.Exec(ctx, `UPDATE lucky_draw_campaigns SET image_url = NULLIF($3,''), updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.ImageURL)
	}
	if input.CostPoints != nil {
		s.db.Exec(ctx, `UPDATE lucky_draw_campaigns SET cost_points = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.CostPoints)
	}
	if input.MaxTicketsPerUser != nil {
		s.db.Exec(ctx, `UPDATE lucky_draw_campaigns SET max_tickets_per_user = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.MaxTicketsPerUser)
	}
	if input.Status != nil {
		valid := map[string]bool{"draft": true, "active": true, "drawing": true, "announced": true, "ended": true}
		if !valid[*input.Status] {
			return nil, fmt.Errorf("invalid status: %s", *input.Status)
		}
		s.db.Exec(ctx, `UPDATE lucky_draw_campaigns SET status = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, id, tenantID, *input.Status)
	}

	c, _, err := s.GetCampaign(ctx, tenantID, id)
	return c, err
}

func (s *Service) AddPrize(ctx context.Context, tenantID, campaignID string, input CreatePrizeInput) (*Prize, error) {
	var exists bool
	_ = s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM lucky_draw_campaigns WHERE id = $1 AND tenant_id = $2)`, campaignID, tenantID).Scan(&exists)
	if !exists {
		return nil, fmt.Errorf("campaign not found")
	}

	if input.Quantity <= 0 {
		input.Quantity = 1
	}

	var p Prize
	err := s.db.QueryRow(ctx,
		`INSERT INTO lucky_draw_prizes (campaign_id, name, description, image_url, quantity, prize_order)
		 VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), $5, $6)
		 RETURNING id, campaign_id, name, description, image_url, quantity, prize_order, created_at::text`,
		campaignID, input.Name, input.Description, input.ImageURL, input.Quantity, input.PrizeOrder,
	).Scan(&p.ID, &p.CampaignID, &p.Name, &p.Description, &p.ImageURL, &p.Quantity, &p.PrizeOrder, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("add prize: %w", err)
	}
	return &p, nil
}

func (s *Service) DeletePrize(ctx context.Context, tenantID, prizeID string) error {
	result, err := s.db.Exec(ctx,
		`DELETE FROM lucky_draw_prizes WHERE id = $1 AND campaign_id IN (SELECT id FROM lucky_draw_campaigns WHERE tenant_id = $2)`,
		prizeID, tenantID,
	)
	if err != nil {
		return fmt.Errorf("delete prize: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("prize not found")
	}
	return nil
}

func generateTicketNumber() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(9999999999))
	return fmt.Sprintf("T%010d", n.Int64())
}

func (s *Service) Register(ctx context.Context, tenantID, campaignID, userID string) (*Ticket, error) {
	var c Campaign
	err := s.db.QueryRow(ctx,
		`SELECT id, cost_points, max_tickets_per_user, status
		 FROM lucky_draw_campaigns WHERE id = $1 AND tenant_id = $2`,
		campaignID, tenantID,
	).Scan(&c.ID, &c.CostPoints, &c.MaxTicketsPerUser, &c.Status)
	if err != nil {
		return nil, fmt.Errorf("campaign not found")
	}
	if c.Status != "active" {
		return nil, apperror.BadRequest("not_active", "กิจกรรมนี้ยังไม่เปิดให้แลกสิทธิ์หรือหมดเวลาแล้ว")
	}

	var ticketCount int
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM lucky_draw_tickets WHERE campaign_id = $1 AND user_id = $2`,
		campaignID, userID,
	).Scan(&ticketCount)
	if ticketCount >= c.MaxTicketsPerUser {
		return nil, apperror.BadRequest("max_tickets", fmt.Sprintf("คุณมีสิทธิ์ลุ้นโชคเต็มโควต้าแล้ว (%d/%d)", ticketCount, c.MaxTicketsPerUser))
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if c.CostPoints > 0 {
		var balance int
		_ = tx.QueryRow(ctx,
			`SELECT COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0) FROM point_ledger WHERE user_id = $1`,
			userID,
		).Scan(&balance)
		if balance < c.CostPoints {
			return nil, apperror.BadRequest("insufficient_points", fmt.Sprintf("แต้มไม่เพียงพอ (ต้องการ %d, มี %d)", c.CostPoints, balance))
		}

		balanceAfter := balance - c.CostPoints
		_, err := tx.Exec(ctx,
			`INSERT INTO point_ledger (user_id, tenant_id, entry_type, amount, balance_after, reference_type, reference_id, description)
			 VALUES ($1, $2, 'debit', $3, $4, 'lucky_draw', $5, 'แลกสิทธิ์ลุ้นโชค')`,
			userID, tenantID, c.CostPoints, balanceAfter, campaignID,
		)
		if err != nil {
			return nil, fmt.Errorf("deduct points: %w", err)
		}
	}

	ticketNum := generateTicketNumber()
	var t Ticket
	err = tx.QueryRow(ctx,
		`INSERT INTO lucky_draw_tickets (campaign_id, user_id, ticket_number, points_spent)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, campaign_id, user_id, ticket_number, points_spent, created_at::text`,
		campaignID, userID, ticketNum, c.CostPoints,
	).Scan(&t.ID, &t.CampaignID, &t.UserID, &t.TicketNumber, &t.PointsSpent, &t.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("register ticket: %w", err)
	}

	_, err = tx.Exec(ctx, `UPDATE lucky_draw_campaigns SET total_tickets = total_tickets + 1 WHERE id = $1`, campaignID)
	if err != nil {
		return nil, fmt.Errorf("update campaign total tickets: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return &t, nil
}

func (s *Service) GetUserTickets(ctx context.Context, campaignID, userID string) ([]Ticket, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, campaign_id, user_id, ticket_number, points_spent, created_at::text
		 FROM lucky_draw_tickets WHERE campaign_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
		campaignID, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("list tickets: %w", err)
	}
	defer rows.Close()

	var tickets []Ticket
	for rows.Next() {
		var t Ticket
		if err := rows.Scan(&t.ID, &t.CampaignID, &t.UserID, &t.TicketNumber, &t.PointsSpent, &t.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan ticket: %w", err)
		}
		tickets = append(tickets, t)
	}
	return tickets, nil
}

func (s *Service) DrawWinners(ctx context.Context, tenantID, campaignID string) ([]Winner, error) {
	var status string
	_ = s.db.QueryRow(ctx, `SELECT status FROM lucky_draw_campaigns WHERE id = $1 AND tenant_id = $2`, campaignID, tenantID).Scan(&status)
	if status != "active" && status != "drawing" {
		return nil, fmt.Errorf("campaign must be active or drawing to draw winners")
	}

	s.db.Exec(ctx, `UPDATE lucky_draw_campaigns SET status = 'drawing', updated_at = NOW() WHERE id = $1`, campaignID)

	prizes, err := s.listPrizes(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, ticket_number FROM lucky_draw_tickets WHERE campaign_id = $1 ORDER BY random()`,
		campaignID,
	)
	if err != nil {
		return nil, fmt.Errorf("get tickets: %w", err)
	}
	defer rows.Close()

	type ticketRow struct {
		ID           string
		UserID       string
		TicketNumber string
	}
	var allTickets []ticketRow
	for rows.Next() {
		var t ticketRow
		if err := rows.Scan(&t.ID, &t.UserID, &t.TicketNumber); err != nil {
			return nil, fmt.Errorf("scan ticket: %w", err)
		}
		allTickets = append(allTickets, t)
	}

	var winners []Winner
	ticketIdx := 0
	usedUsers := make(map[string]bool)

	for _, prize := range prizes {
		for q := 0; q < prize.Quantity && ticketIdx < len(allTickets); {
			t := allTickets[ticketIdx]
			ticketIdx++
			if usedUsers[t.UserID] {
				continue
			}
			usedUsers[t.UserID] = true

			var w Winner
			err := s.db.QueryRow(ctx,
				`INSERT INTO lucky_draw_winners (campaign_id, prize_id, ticket_id, user_id)
				 VALUES ($1, $2, $3, $4)
				 RETURNING id, campaign_id, prize_id, ticket_id, user_id, announced_at::text`,
				campaignID, prize.ID, t.ID, t.UserID,
			).Scan(&w.ID, &w.CampaignID, &w.PrizeID, &w.TicketID, &w.UserID, &w.AnnouncedAt)
			if err != nil {
				return nil, fmt.Errorf("insert winner: %w", err)
			}
			w.PrizeName = prize.Name
			w.TicketNumber = t.TicketNumber
			winners = append(winners, w)
			q++
		}
	}

	s.db.Exec(ctx, `UPDATE lucky_draw_campaigns SET status = 'announced', updated_at = NOW() WHERE id = $1`, campaignID)
	return winners, nil
}

func (s *Service) GetWinners(ctx context.Context, campaignID string) ([]Winner, error) {
	rows, err := s.db.Query(ctx,
		`SELECT w.id, w.campaign_id, w.prize_id, w.ticket_id, w.user_id, w.announced_at::text,
		        p.name, t.ticket_number
		 FROM lucky_draw_winners w
		 JOIN lucky_draw_prizes p ON p.id = w.prize_id
		 JOIN lucky_draw_tickets t ON t.id = w.ticket_id
		 WHERE w.campaign_id = $1
		 ORDER BY p.prize_order ASC`,
		campaignID,
	)
	if err != nil {
		return nil, fmt.Errorf("list winners: %w", err)
	}
	defer rows.Close()

	var winners []Winner
	for rows.Next() {
		var w Winner
		if err := rows.Scan(&w.ID, &w.CampaignID, &w.PrizeID, &w.TicketID, &w.UserID,
			&w.AnnouncedAt, &w.PrizeName, &w.TicketNumber); err != nil {
			return nil, fmt.Errorf("scan winner: %w", err)
		}
		winners = append(winners, w)
	}
	return winners, nil
}

func (s *Service) listPrizes(ctx context.Context, campaignID string) ([]Prize, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, campaign_id, name, description, image_url, quantity, prize_order, created_at::text
		 FROM lucky_draw_prizes WHERE campaign_id = $1 ORDER BY prize_order ASC`,
		campaignID,
	)
	if err != nil {
		return nil, fmt.Errorf("list prizes: %w", err)
	}
	defer rows.Close()

	var prizes []Prize
	for rows.Next() {
		var p Prize
		if err := rows.Scan(&p.ID, &p.CampaignID, &p.Name, &p.Description, &p.ImageURL,
			&p.Quantity, &p.PrizeOrder, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan prize: %w", err)
		}
		prizes = append(prizes, p)
	}
	return prizes, nil
}
