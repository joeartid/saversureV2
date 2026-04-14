package crm

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

const (
	defaultReferralRewardReferrer = 20
	defaultReferralRewardReferee  = 20
)

type Survey struct {
	ID            string         `json:"id"`
	TenantID      string         `json:"tenant_id"`
	Title         string         `json:"title"`
	Questions     []any          `json:"questions"`
	TriggerEvent  *string        `json:"trigger_event"`
	Active        bool           `json:"active"`
	ResponseCount int            `json:"response_count"`
	AverageRating *float64       `json:"average_rating"`
	CreatedAt     string         `json:"created_at"`
	UpdatedAt     string         `json:"updated_at"`
}

type SurveyInput struct {
	Title        string `json:"title" binding:"required"`
	Questions    []any  `json:"questions" binding:"required"`
	TriggerEvent string `json:"trigger_event"`
	Active       *bool  `json:"active"`
}

type SurveyResponse struct {
	ID        string  `json:"id"`
	SurveyID  string  `json:"survey_id"`
	UserID    string  `json:"user_id"`
	UserName  *string `json:"user_name"`
	Answers   []any   `json:"answers"`
	Rating    *int    `json:"rating"`
	CreatedAt string  `json:"created_at"`
}

type SurveyResponseInput struct {
	Answers []any `json:"answers" binding:"required"`
	Rating  *int  `json:"rating"`
}

type ReferralCode struct {
	ID               string  `json:"id"`
	TenantID         string  `json:"tenant_id"`
	UserID           string  `json:"user_id"`
	UserName         *string `json:"user_name"`
	Code             string  `json:"code"`
	Uses             int     `json:"uses"`
	MaxUses          *int    `json:"max_uses"`
	RewardReferrer   int     `json:"reward_referrer"`
	RewardReferee    int     `json:"reward_referee"`
	Active           bool    `json:"active"`
	CreatedAt        string  `json:"created_at"`
	UpdatedAt        string  `json:"updated_at"`
}

type ReferralCodeInput struct {
	UserID          string `json:"user_id" binding:"required"`
	Code            string `json:"code"`
	MaxUses         *int   `json:"max_uses"`
	RewardReferrer  int    `json:"reward_referrer"`
	RewardReferee   int    `json:"reward_referee"`
	Active          *bool  `json:"active"`
}

type ReferralApplyInput struct {
	Code string `json:"code" binding:"required"`
}

type ReferralHistoryItem struct {
	ID           string  `json:"id"`
	TenantID     string  `json:"tenant_id"`
	ReferralCode string  `json:"referral_code"`
	ReferrerID   string  `json:"referrer_id"`
	ReferrerName *string `json:"referrer_name"`
	RefereeID    string  `json:"referee_id"`
	RefereeName  *string `json:"referee_name"`
	PointsGiven  int     `json:"points_given"`
	CreatedAt    string  `json:"created_at"`
}

type SurveyInsights struct {
	TotalSurveys   int64            `json:"total_surveys"`
	TotalResponses int64            `json:"total_responses"`
	AverageRating  float64          `json:"average_rating"`
	Promoters      int64            `json:"promoters"`
	Passives       int64            `json:"passives"`
	Detractors     int64            `json:"detractors"`
	NPSScore       float64          `json:"nps_score"`
	RecentResponses []SurveyResponse `json:"recent_responses"`
}

type ReferrerLeaderboardItem struct {
	UserID       string  `json:"user_id"`
	UserName     *string `json:"user_name"`
	ReferralCount int    `json:"referral_count"`
	PointsEarned int     `json:"points_earned"`
}

type ReferralOverview struct {
	TotalCodes        int64                    `json:"total_codes"`
	TotalUses         int64                    `json:"total_uses"`
	TotalReferrals    int64                    `json:"total_referrals"`
	TotalPointsAwarded int64                   `json:"total_points_awarded"`
	TopReferrers      []ReferrerLeaderboardItem `json:"top_referrers"`
	TopCodes          []ReferralCode           `json:"top_codes"`
}

type MyReferralOverview struct {
	Code          *ReferralCode          `json:"code"`
	TotalReferrals int64                 `json:"total_referrals"`
	PointsEarned  int64                  `json:"points_earned"`
	RecentHistory []ReferralHistoryItem  `json:"recent_history"`
}

func normalizeSurveyInput(input SurveyInput) SurveyInput {
	input.Title = strings.TrimSpace(input.Title)
	input.TriggerEvent = strings.TrimSpace(input.TriggerEvent)
	if input.Questions == nil {
		input.Questions = []any{}
	}
	return input
}

func surveyActiveValue(active *bool) bool {
	if active == nil {
		return true
	}
	return *active
}

func (s *Service) ListSurveys(ctx context.Context, tenantID string) ([]Survey, error) {
	rows, err := s.db.Query(ctx, `
		SELECT
			s.id::text,
			s.tenant_id::text,
			s.title,
			s.questions,
			s.trigger_event,
			s.active,
			COALESCE(COUNT(sr.id), 0)::int AS response_count,
			AVG(sr.rating)::float8,
			s.created_at::text,
			s.updated_at::text
		FROM surveys s
		LEFT JOIN survey_responses sr ON sr.survey_id = s.id
		WHERE s.tenant_id = $1
		GROUP BY s.id
		ORDER BY s.created_at DESC
	`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list surveys: %w", err)
	}
	defer rows.Close()

	var items []Survey
	for rows.Next() {
		var item Survey
		var raw []byte
		if err := rows.Scan(&item.ID, &item.TenantID, &item.Title, &raw, &item.TriggerEvent, &item.Active, &item.ResponseCount, &item.AverageRating, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan survey: %w", err)
		}
		_ = json.Unmarshal(raw, &item.Questions)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) CreateSurvey(ctx context.Context, tenantID string, input SurveyInput) (*Survey, error) {
	input = normalizeSurveyInput(input)
	item := &Survey{}
	raw, _ := json.Marshal(input.Questions)
	active := surveyActiveValue(input.Active)
	if err := s.db.QueryRow(ctx, `
		INSERT INTO surveys (tenant_id, title, questions, trigger_event, active, created_at, updated_at)
		VALUES ($1, $2, $3::jsonb, NULLIF($4, ''), $5, NOW(), NOW())
		RETURNING id::text, tenant_id::text, title, questions, trigger_event, active, created_at::text, updated_at::text
	`, tenantID, input.Title, string(raw), input.TriggerEvent, active).Scan(
		&item.ID, &item.TenantID, &item.Title, &raw, &item.TriggerEvent, &item.Active, &item.CreatedAt, &item.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("create survey: %w", err)
	}
	_ = json.Unmarshal(raw, &item.Questions)
	return item, nil
}

func (s *Service) UpdateSurvey(ctx context.Context, tenantID, surveyID string, input SurveyInput) (*Survey, error) {
	input = normalizeSurveyInput(input)
	item := &Survey{}
	raw, _ := json.Marshal(input.Questions)
	active := surveyActiveValue(input.Active)
	if err := s.db.QueryRow(ctx, `
		UPDATE surveys
		SET title = $3,
		    questions = $4::jsonb,
		    trigger_event = NULLIF($5, ''),
		    active = $6,
		    updated_at = NOW()
		WHERE tenant_id = $1 AND id = $2::uuid
		RETURNING id::text, tenant_id::text, title, questions, trigger_event, active, created_at::text, updated_at::text
	`, tenantID, surveyID, input.Title, string(raw), input.TriggerEvent, active).Scan(
		&item.ID, &item.TenantID, &item.Title, &raw, &item.TriggerEvent, &item.Active, &item.CreatedAt, &item.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("update survey: %w", err)
	}
	_ = json.Unmarshal(raw, &item.Questions)
	return item, nil
}

func (s *Service) DeleteSurvey(ctx context.Context, tenantID, surveyID string) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM surveys WHERE tenant_id = $1 AND id = $2::uuid`, tenantID, surveyID); err != nil {
		return fmt.Errorf("delete survey: %w", err)
	}
	return nil
}

func (s *Service) ListSurveyResponses(ctx context.Context, tenantID, surveyID string, limit, offset int) ([]SurveyResponse, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.db.Query(ctx, `
		SELECT
			sr.id::text,
			sr.survey_id::text,
			sr.user_id::text,
			COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), NULLIF(u.display_name, ''), u.phone, u.email),
			sr.answers,
			sr.rating,
			sr.created_at::text
		FROM survey_responses sr
		LEFT JOIN users u ON u.id = sr.user_id
		WHERE sr.tenant_id = $1 AND sr.survey_id = $2::uuid
		ORDER BY sr.created_at DESC
		LIMIT $3 OFFSET $4
	`, tenantID, surveyID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list survey responses: %w", err)
	}
	defer rows.Close()

	var items []SurveyResponse
	for rows.Next() {
		var item SurveyResponse
		var raw []byte
		if err := rows.Scan(&item.ID, &item.SurveyID, &item.UserID, &item.UserName, &raw, &item.Rating, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan survey response: %w", err)
		}
		_ = json.Unmarshal(raw, &item.Answers)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) ListMySurveys(ctx context.Context, tenantID, userID, triggerEvent string) ([]Survey, error) {
	query := `
		SELECT s.id::text, s.tenant_id::text, s.title, s.questions, s.trigger_event, s.active, s.created_at::text, s.updated_at::text
		FROM surveys s
		WHERE s.tenant_id = $1
		  AND s.active = TRUE
		  AND NOT EXISTS (
			SELECT 1 FROM survey_responses sr
			WHERE sr.survey_id = s.id AND sr.user_id = $2::uuid
		  )`
	args := []any{tenantID, userID}
	if strings.TrimSpace(triggerEvent) != "" {
		query += ` AND COALESCE(s.trigger_event, 'manual') = $3`
		args = append(args, triggerEvent)
	}
	query += ` ORDER BY s.created_at DESC`
	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list my surveys: %w", err)
	}
	defer rows.Close()

	var items []Survey
	for rows.Next() {
		var item Survey
		var raw []byte
		if err := rows.Scan(&item.ID, &item.TenantID, &item.Title, &raw, &item.TriggerEvent, &item.Active, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan my survey: %w", err)
		}
		_ = json.Unmarshal(raw, &item.Questions)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) SubmitSurveyResponse(ctx context.Context, tenantID, userID, surveyID string, input SurveyResponseInput) error {
	raw, _ := json.Marshal(input.Answers)
	if _, err := s.db.Exec(ctx, `
		INSERT INTO survey_responses (survey_id, user_id, tenant_id, answers, rating, created_at)
		SELECT $1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5, NOW()
		WHERE EXISTS (
			SELECT 1 FROM surveys
			WHERE id = $1::uuid AND tenant_id = $3::uuid AND active = TRUE
		)
	`, surveyID, userID, tenantID, string(raw), input.Rating); err != nil {
		return fmt.Errorf("submit survey response: %w", err)
	}
	return nil
}

func randomReferralCode() (string, error) {
	buf := make([]byte, 4)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return strings.ToUpper(hex.EncodeToString(buf)), nil
}

func (s *Service) referralCodeExists(ctx context.Context, code string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = $1)`, code).Scan(&exists)
	return exists, err
}

func (s *Service) ensureUniqueReferralCode(ctx context.Context, preferred string) (string, error) {
	code := strings.ToUpper(strings.TrimSpace(preferred))
	if code != "" {
		exists, err := s.referralCodeExists(ctx, code)
		if err != nil {
			return "", err
		}
		if exists {
			return "", fmt.Errorf("referral code already exists")
		}
		return code, nil
	}
	for i := 0; i < 10; i++ {
		generated, err := randomReferralCode()
		if err != nil {
			return "", err
		}
		exists, err := s.referralCodeExists(ctx, generated)
		if err != nil {
			return "", err
		}
		if !exists {
			return generated, nil
		}
	}
	return "", fmt.Errorf("could not generate unique referral code")
}

func referralCodeActiveValue(active *bool) bool {
	if active == nil {
		return true
	}
	return *active
}

func (s *Service) scanReferralCode(scanner interface{ Scan(dest ...any) error }) (*ReferralCode, error) {
	var item ReferralCode
	if err := scanner.Scan(&item.ID, &item.TenantID, &item.UserID, &item.UserName, &item.Code, &item.Uses, &item.MaxUses, &item.RewardReferrer, &item.RewardReferee, &item.Active, &item.CreatedAt, &item.UpdatedAt); err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) ListReferralCodes(ctx context.Context, tenantID string, limit int) ([]ReferralCode, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := s.db.Query(ctx, `
		SELECT
			rc.id::text,
			rc.tenant_id::text,
			rc.user_id::text,
			COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), NULLIF(u.display_name, ''), u.phone, u.email),
			rc.code,
			rc.uses,
			rc.max_uses,
			rc.reward_referrer,
			rc.reward_referee,
			rc.active,
			rc.created_at::text,
			rc.updated_at::text
		FROM referral_codes rc
		LEFT JOIN users u ON u.id = rc.user_id
		WHERE rc.tenant_id = $1
		ORDER BY rc.created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("list referral codes: %w", err)
	}
	defer rows.Close()

	var items []ReferralCode
	for rows.Next() {
		item, err := s.scanReferralCode(rows)
		if err != nil {
			return nil, fmt.Errorf("scan referral code: %w", err)
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (s *Service) CreateReferralCode(ctx context.Context, tenantID string, input ReferralCodeInput) (*ReferralCode, error) {
	code, err := s.ensureUniqueReferralCode(ctx, input.Code)
	if err != nil {
		return nil, err
	}
	active := referralCodeActiveValue(input.Active)
	item := &ReferralCode{}
	if err := s.db.QueryRow(ctx, `
		INSERT INTO referral_codes (
			tenant_id, user_id, code, max_uses, reward_referrer, reward_referee, active, created_at, updated_at
		) VALUES (
			$1::uuid, $2::uuid, $3, $4, $5, $6, $7, NOW(), NOW()
		)
		RETURNING id::text, tenant_id::text, user_id::text,
		          (SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), NULLIF(u.display_name, ''), u.phone, u.email) FROM users u WHERE u.id = $2::uuid),
		          code, uses, max_uses, reward_referrer, reward_referee, active, created_at::text, updated_at::text
	`, tenantID, input.UserID, code, input.MaxUses, input.RewardReferrer, input.RewardReferee, active).Scan(
		&item.ID, &item.TenantID, &item.UserID, &item.UserName, &item.Code, &item.Uses, &item.MaxUses, &item.RewardReferrer, &item.RewardReferee, &item.Active, &item.CreatedAt, &item.UpdatedAt,
	); err != nil {
		return nil, fmt.Errorf("create referral code: %w", err)
	}
	return item, nil
}

func (s *Service) ListReferralHistory(ctx context.Context, tenantID string, limit int) ([]ReferralHistoryItem, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := s.db.Query(ctx, `
		SELECT
			rh.id::text,
			rh.tenant_id::text,
			rh.referral_code,
			rh.referrer_id::text,
			COALESCE(NULLIF(TRIM(CONCAT(COALESCE(rf.first_name, ''), ' ', COALESCE(rf.last_name, ''))), ''), NULLIF(rf.display_name, ''), rf.phone, rf.email),
			rh.referee_id::text,
			COALESCE(NULLIF(TRIM(CONCAT(COALESCE(re.first_name, ''), ' ', COALESCE(re.last_name, ''))), ''), NULLIF(re.display_name, ''), re.phone, re.email),
			rh.points_given,
			rh.created_at::text
		FROM referral_history rh
		LEFT JOIN users rf ON rf.id = rh.referrer_id
		LEFT JOIN users re ON re.id = rh.referee_id
		WHERE rh.tenant_id = $1
		ORDER BY rh.created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("list referral history: %w", err)
	}
	defer rows.Close()

	var items []ReferralHistoryItem
	for rows.Next() {
		var item ReferralHistoryItem
		if err := rows.Scan(&item.ID, &item.TenantID, &item.ReferralCode, &item.ReferrerID, &item.ReferrerName, &item.RefereeID, &item.RefereeName, &item.PointsGiven, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan referral history: %w", err)
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) GetMyReferralCode(ctx context.Context, tenantID, userID string) (*ReferralCode, error) {
	item := &ReferralCode{}
	err := s.db.QueryRow(ctx, `
		SELECT
			rc.id::text,
			rc.tenant_id::text,
			rc.user_id::text,
			COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), NULLIF(u.display_name, ''), u.phone, u.email),
			rc.code, rc.uses, rc.max_uses, rc.reward_referrer, rc.reward_referee, rc.active, rc.created_at::text, rc.updated_at::text
		FROM referral_codes rc
		LEFT JOIN users u ON u.id = rc.user_id
		WHERE rc.tenant_id = $1::uuid AND rc.user_id = $2::uuid
		ORDER BY rc.created_at DESC
		LIMIT 1
	`, tenantID, userID).Scan(
		&item.ID, &item.TenantID, &item.UserID, &item.UserName, &item.Code, &item.Uses, &item.MaxUses, &item.RewardReferrer, &item.RewardReferee, &item.Active, &item.CreatedAt, &item.UpdatedAt,
	)
	if err == nil {
		return item, nil
	}
	if err != pgx.ErrNoRows {
		return nil, fmt.Errorf("get my referral code: %w", err)
	}
	return s.CreateReferralCode(ctx, tenantID, ReferralCodeInput{
		UserID:         userID,
		RewardReferrer: defaultReferralRewardReferrer,
		RewardReferee:  defaultReferralRewardReferee,
	})
}

func creditReferralPointsTx(ctx context.Context, tx pgx.Tx, tenantID, userID string, amount int, refID, description string) error {
	if amount <= 0 {
		return nil
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO point_ledger (
			tenant_id, user_id, entry_type, amount, balance_after, reference_type, reference_id, description, currency
		) VALUES (
			$1::uuid, $2::uuid, 'credit', $3,
			COALESCE((SELECT balance_after FROM point_ledger WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND currency = 'point' ORDER BY created_at DESC, id DESC LIMIT 1), 0) + $3,
			'referral', $4::uuid, $5, 'point'
		)
	`, tenantID, userID, amount, refID, description)
	return err
}

func (s *Service) ApplyReferralCode(ctx context.Context, tenantID, refereeUserID string, input ReferralApplyInput) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin referral tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var refCodeID, referrerID string
	var active bool
	var uses int
	var maxUses *int
	var rewardReferrer, rewardReferee int
	err = tx.QueryRow(ctx, `
		SELECT id::text, user_id::text, active, uses, max_uses, reward_referrer, reward_referee
		FROM referral_codes
		WHERE tenant_id = $1::uuid AND code = $2
		LIMIT 1
	`, tenantID, strings.ToUpper(strings.TrimSpace(input.Code))).Scan(&refCodeID, &referrerID, &active, &uses, &maxUses, &rewardReferrer, &rewardReferee)
	if err != nil {
		return fmt.Errorf("load referral code: %w", err)
	}
	if !active {
		return fmt.Errorf("referral code is inactive")
	}
	if referrerID == refereeUserID {
		return fmt.Errorf("cannot apply your own referral code")
	}
	if maxUses != nil && uses >= *maxUses {
		return fmt.Errorf("referral code has reached max uses")
	}

	var alreadyApplied bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM referral_history WHERE tenant_id = $1::uuid AND referee_id = $2::uuid
		)
	`, tenantID, refereeUserID).Scan(&alreadyApplied); err != nil {
		return fmt.Errorf("check referral history: %w", err)
	}
	if alreadyApplied {
		return fmt.Errorf("user already used a referral code")
	}

	var historyID string
	pointsGiven := rewardReferrer + rewardReferee
	if err := tx.QueryRow(ctx, `
		INSERT INTO referral_history (tenant_id, referral_code, referrer_id, referee_id, points_given, created_at)
		VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5, NOW())
		RETURNING id::text
	`, tenantID, strings.ToUpper(strings.TrimSpace(input.Code)), referrerID, refereeUserID, pointsGiven).Scan(&historyID); err != nil {
		return fmt.Errorf("create referral history: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE referral_codes
		SET uses = uses + 1, updated_at = NOW()
		WHERE id = $1::uuid
	`, refCodeID); err != nil {
		return fmt.Errorf("increment referral uses: %w", err)
	}

	if err := creditReferralPointsTx(ctx, tx, tenantID, referrerID, rewardReferrer, historyID, fmt.Sprintf("Referral reward for code %s", strings.ToUpper(strings.TrimSpace(input.Code)))); err != nil {
		return fmt.Errorf("credit referrer points: %w", err)
	}
	if err := creditReferralPointsTx(ctx, tx, tenantID, refereeUserID, rewardReferee, historyID, fmt.Sprintf("Referral signup bonus from code %s", strings.ToUpper(strings.TrimSpace(input.Code)))); err != nil {
		return fmt.Errorf("credit referee points: %w", err)
	}

	if err := createNotificationTx(ctx, tx, tenantID, referrerID, "points", "ได้รับแต้มจากการแนะนำเพื่อน", fmt.Sprintf("คุณได้รับ %d คะแนนจาก referral", rewardReferrer), "referral", historyID); err != nil {
		return fmt.Errorf("notify referrer: %w", err)
	}
	if err := createNotificationTx(ctx, tx, tenantID, refereeUserID, "points", "ได้รับแต้มจาก referral", fmt.Sprintf("คุณได้รับ %d คะแนนจากการใช้ referral code", rewardReferee), "referral", historyID); err != nil {
		return fmt.Errorf("notify referee: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit referral tx: %w", err)
	}
	return nil
}

func (s *Service) GetSurveyInsights(ctx context.Context, tenantID string, limit int) (*SurveyInsights, error) {
	if limit <= 0 {
		limit = 10
	}
	result := &SurveyInsights{}
	if err := s.db.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*)::bigint FROM surveys WHERE tenant_id = $1),
			COUNT(*)::bigint,
			COALESCE(AVG(rating), 0)::float8,
			COUNT(*) FILTER (WHERE rating >= 9)::bigint,
			COUNT(*) FILTER (WHERE rating BETWEEN 7 AND 8)::bigint,
			COUNT(*) FILTER (WHERE rating <= 6 AND rating IS NOT NULL)::bigint
		FROM survey_responses
		WHERE tenant_id = $1
	`, tenantID).Scan(
		&result.TotalSurveys, &result.TotalResponses, &result.AverageRating, &result.Promoters, &result.Passives, &result.Detractors,
	); err != nil {
		return nil, fmt.Errorf("survey insights: %w", err)
	}
	if result.TotalResponses > 0 {
		result.NPSScore = ((float64(result.Promoters) - float64(result.Detractors)) / float64(result.TotalResponses)) * 100
	}
	recent, err := s.ListRecentSurveyResponses(ctx, tenantID, limit)
	if err != nil {
		return nil, err
	}
	result.RecentResponses = recent
	return result, nil
}

func (s *Service) ListRecentSurveyResponses(ctx context.Context, tenantID string, limit int) ([]SurveyResponse, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := s.db.Query(ctx, `
		SELECT
			sr.id::text,
			sr.survey_id::text,
			sr.user_id::text,
			COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), NULLIF(u.display_name, ''), u.phone, u.email),
			sr.answers,
			sr.rating,
			sr.created_at::text
		FROM survey_responses sr
		LEFT JOIN users u ON u.id = sr.user_id
		WHERE sr.tenant_id = $1
		ORDER BY sr.created_at DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("list recent survey responses: %w", err)
	}
	defer rows.Close()

	var items []SurveyResponse
	for rows.Next() {
		var item SurveyResponse
		var raw []byte
		if err := rows.Scan(&item.ID, &item.SurveyID, &item.UserID, &item.UserName, &raw, &item.Rating, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan recent survey response: %w", err)
		}
		_ = json.Unmarshal(raw, &item.Answers)
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) GetReferralOverview(ctx context.Context, tenantID string, limit int) (*ReferralOverview, error) {
	if limit <= 0 {
		limit = 10
	}
	result := &ReferralOverview{}
	if err := s.db.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*)::bigint FROM referral_codes WHERE tenant_id = $1),
			(SELECT COALESCE(SUM(uses), 0)::bigint FROM referral_codes WHERE tenant_id = $1),
			(SELECT COUNT(*)::bigint FROM referral_history WHERE tenant_id = $1),
			(SELECT COALESCE(SUM(points_given), 0)::bigint FROM referral_history WHERE tenant_id = $1)
	`, tenantID).Scan(&result.TotalCodes, &result.TotalUses, &result.TotalReferrals, &result.TotalPointsAwarded); err != nil {
		return nil, fmt.Errorf("referral overview: %w", err)
	}

	rows, err := s.db.Query(ctx, `
		SELECT
			rh.referrer_id::text,
			COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), ''), NULLIF(u.display_name, ''), u.phone, u.email),
			COUNT(*)::int,
			COALESCE(SUM(rh.points_given), 0)::int
		FROM referral_history rh
		LEFT JOIN users u ON u.id = rh.referrer_id
		WHERE rh.tenant_id = $1
		GROUP BY rh.referrer_id, u.first_name, u.last_name, u.display_name, u.phone, u.email
		ORDER BY COUNT(*) DESC, COALESCE(SUM(rh.points_given), 0) DESC
		LIMIT $2
	`, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("top referrers: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var item ReferrerLeaderboardItem
		if err := rows.Scan(&item.UserID, &item.UserName, &item.ReferralCount, &item.PointsEarned); err != nil {
			return nil, fmt.Errorf("scan top referrer: %w", err)
		}
		result.TopReferrers = append(result.TopReferrers, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	topCodes, err := s.ListReferralCodes(ctx, tenantID, limit)
	if err != nil {
		return nil, err
	}
	result.TopCodes = topCodes
	return result, nil
}

func (s *Service) GetMyReferralOverview(ctx context.Context, tenantID, userID string, limit int) (*MyReferralOverview, error) {
	if limit <= 0 {
		limit = 10
	}
	code, err := s.GetMyReferralCode(ctx, tenantID, userID)
	if err != nil {
		return nil, err
	}
	result := &MyReferralOverview{Code: code}
	if err := s.db.QueryRow(ctx, `
		SELECT
			COUNT(*)::bigint,
			COALESCE(SUM(points_given), 0)::bigint
		FROM referral_history
		WHERE tenant_id = $1::uuid AND referrer_id = $2::uuid
	`, tenantID, userID).Scan(&result.TotalReferrals, &result.PointsEarned); err != nil {
		return nil, fmt.Errorf("my referral overview: %w", err)
	}

	rows, err := s.db.Query(ctx, `
		SELECT
			rh.id::text,
			rh.tenant_id::text,
			rh.referral_code,
			rh.referrer_id::text,
			COALESCE(NULLIF(TRIM(CONCAT(COALESCE(rf.first_name, ''), ' ', COALESCE(rf.last_name, ''))), ''), NULLIF(rf.display_name, ''), rf.phone, rf.email),
			rh.referee_id::text,
			COALESCE(NULLIF(TRIM(CONCAT(COALESCE(re.first_name, ''), ' ', COALESCE(re.last_name, ''))), ''), NULLIF(re.display_name, ''), re.phone, re.email),
			rh.points_given,
			rh.created_at::text
		FROM referral_history rh
		LEFT JOIN users rf ON rf.id = rh.referrer_id
		LEFT JOIN users re ON re.id = rh.referee_id
		WHERE rh.tenant_id = $1::uuid AND rh.referrer_id = $2::uuid
		ORDER BY rh.created_at DESC
		LIMIT $3
	`, tenantID, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("my referral history: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var item ReferralHistoryItem
		if err := rows.Scan(&item.ID, &item.TenantID, &item.ReferralCode, &item.ReferrerID, &item.ReferrerName, &item.RefereeID, &item.RefereeName, &item.PointsGiven, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan my referral history: %w", err)
		}
		result.RecentHistory = append(result.RecentHistory, item)
	}
	return result, rows.Err()
}
