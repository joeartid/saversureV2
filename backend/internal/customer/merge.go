package customer

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type MergeService struct {
	db *pgxpool.Pool
}

func NewMergeService(db *pgxpool.Pool) *MergeService {
	return &MergeService{db: db}
}

type TransferLINEInput struct {
	FromUserID string `json:"from_user_id" binding:"required"`
}

type MergeInput struct {
	KeepUserID   string `json:"keep_user_id" binding:"required"`
	RemoveUserID string `json:"remove_user_id" binding:"required"`
}

type TransferLINEResult struct {
	TargetUserID    string `json:"target_user_id"`
	LINEDisplayName string `json:"line_display_name"`
	Message         string `json:"message"`
}

type MergeResult struct {
	KeptUserID    string `json:"kept_user_id"`
	RemovedUserID string `json:"removed_user_id"`
	CodesMoved    int64  `json:"codes_moved"`
	ScansMoved    int64  `json:"scans_moved"`
	LedgerMoved   int64  `json:"ledger_moved"`
	RedeemsMoved  int64  `json:"redeems_moved"`
	Message       string `json:"message"`
}

// SearchUsers searches for users to merge/transfer (admin use).
func (s *MergeService) SearchUsers(ctx context.Context, tenantID, query string) ([]UserSearchResult, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, COALESCE(display_name,''), COALESCE(first_name,''), COALESCE(last_name,''),
		        COALESCE(phone,''), COALESCE(email,''), COALESCE(line_user_id,''), COALESCE(line_display_name,'')
		 FROM users
		 WHERE tenant_id = $1 AND status = 'active'
		   AND (display_name ILIKE $2 OR first_name ILIKE $2 OR last_name ILIKE $2
		        OR phone ILIKE $2 OR email ILIKE $2 OR line_display_name ILIKE $2 OR id::text = $3)
		 LIMIT 20`,
		tenantID, "%"+query+"%", query,
	)
	if err != nil {
		return nil, fmt.Errorf("search users: %w", err)
	}
	defer rows.Close()

	var results []UserSearchResult
	for rows.Next() {
		var u UserSearchResult
		if err := rows.Scan(&u.ID, &u.DisplayName, &u.FirstName, &u.LastName,
			&u.Phone, &u.Email, &u.LineUserID, &u.LineDisplayName); err != nil {
			continue
		}
		results = append(results, u)
	}
	return results, nil
}

type UserSearchResult struct {
	ID              string `json:"id"`
	DisplayName     string `json:"display_name"`
	FirstName       string `json:"first_name"`
	LastName        string `json:"last_name"`
	Phone           string `json:"phone"`
	Email           string `json:"email"`
	LineUserID      string `json:"line_user_id"`
	LineDisplayName string `json:"line_display_name"`
}

// TransferLINE moves LINE identity from one user to another.
func (s *MergeService) TransferLINE(ctx context.Context, tenantID, targetUserID string, input TransferLINEInput) (*TransferLINEResult, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var lineUserID, lineDisplayName, linePictureURL string
	err = tx.QueryRow(ctx,
		`SELECT COALESCE(line_user_id,''), COALESCE(line_display_name,''), COALESCE(line_picture_url,'')
		 FROM users WHERE id = $1 AND tenant_id = $2`,
		input.FromUserID, tenantID,
	).Scan(&lineUserID, &lineDisplayName, &linePictureURL)
	if err != nil {
		return nil, fmt.Errorf("source user not found: %w", err)
	}
	if lineUserID == "" {
		return nil, fmt.Errorf("source user has no LINE account linked")
	}

	_, err = tx.Exec(ctx,
		`UPDATE users SET line_user_id = $1, line_display_name = $2, line_picture_url = $3, updated_at = NOW()
		 WHERE id = $4 AND tenant_id = $5`,
		lineUserID, lineDisplayName, linePictureURL, targetUserID, tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("transfer LINE to target: %w", err)
	}

	_, err = tx.Exec(ctx,
		`UPDATE users SET line_user_id = NULL, line_display_name = NULL, line_picture_url = NULL,
		        profile_completed = false, updated_at = NOW()
		 WHERE id = $1 AND tenant_id = $2`,
		input.FromUserID, tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("clear LINE from source: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &TransferLINEResult{
		TargetUserID:    targetUserID,
		LINEDisplayName: lineDisplayName,
		Message:         "LINE account transferred successfully",
	}, nil
}

// Merge merges two user accounts: keeps one, removes the other.
func (s *MergeService) Merge(ctx context.Context, tenantID string, input MergeInput) (*MergeResult, error) {
	if input.KeepUserID == input.RemoveUserID {
		return nil, fmt.Errorf("cannot merge a user with itself")
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var keepExists, removeExists int
	_ = tx.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE id=$1 AND tenant_id=$2`, input.KeepUserID, tenantID).Scan(&keepExists)
	_ = tx.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE id=$1 AND tenant_id=$2`, input.RemoveUserID, tenantID).Scan(&removeExists)
	if keepExists == 0 || removeExists == 0 {
		return nil, fmt.Errorf("one or both users not found")
	}

	// Transfer LINE if keep user doesn't have one
	var keepLineID string
	_ = tx.QueryRow(ctx, `SELECT COALESCE(line_user_id,'') FROM users WHERE id=$1`, input.KeepUserID).Scan(&keepLineID)
	if keepLineID == "" {
		_, _ = tx.Exec(ctx,
			`UPDATE users SET
			  line_user_id = (SELECT line_user_id FROM users WHERE id=$2),
			  line_display_name = (SELECT line_display_name FROM users WHERE id=$2),
			  line_picture_url = (SELECT line_picture_url FROM users WHERE id=$2)
			 WHERE id = $1`,
			input.KeepUserID, input.RemoveUserID,
		)
	}

	// Move codes
	tag1, _ := tx.Exec(ctx,
		`UPDATE codes SET scanned_by = $1 WHERE scanned_by = $2 AND tenant_id = $3`,
		input.KeepUserID, input.RemoveUserID, tenantID,
	)

	// Move scan_history
	tag2, _ := tx.Exec(ctx,
		`UPDATE scan_history SET user_id = $1 WHERE user_id = $2 AND tenant_id = $3`,
		input.KeepUserID, input.RemoveUserID, tenantID,
	)

	// Move point_ledger
	tag3, _ := tx.Exec(ctx,
		`UPDATE point_ledger SET user_id = $1 WHERE user_id = $2 AND tenant_id = $3`,
		input.KeepUserID, input.RemoveUserID, tenantID,
	)

	// Move reward_reservations
	tag4, _ := tx.Exec(ctx,
		`UPDATE reward_reservations SET user_id = $1 WHERE user_id = $2 AND tenant_id = $3`,
		input.KeepUserID, input.RemoveUserID, tenantID,
	)

	// Recalculate balance for kept user
	var newBalance int
	_ = tx.QueryRow(ctx,
		`SELECT COALESCE((SELECT balance_after FROM point_ledger WHERE tenant_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1), 0)`,
		tenantID, input.KeepUserID,
	).Scan(&newBalance)

	// Remove the merged user's roles and mark as deleted
	_, _ = tx.Exec(ctx, `DELETE FROM user_roles WHERE user_id = $1 AND tenant_id = $2`, input.RemoveUserID, tenantID)
	_, _ = tx.Exec(ctx, `UPDATE users SET status = 'merged', line_user_id = NULL, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
		input.RemoveUserID, tenantID)

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return &MergeResult{
		KeptUserID:    input.KeepUserID,
		RemovedUserID: input.RemoveUserID,
		CodesMoved:    tag1.RowsAffected(),
		ScansMoved:    tag2.RowsAffected(),
		LedgerMoved:   tag3.RowsAffected(),
		RedeemsMoved:  tag4.RowsAffected(),
		Message:       "Accounts merged successfully",
	}, nil
}
