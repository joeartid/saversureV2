package qc

import (
	"context"
	"errors"

	"saversure/pkg/codegen"
)

var ErrRef2NotFound = errors.New("ref2 not found")

type VerifyResult struct {
	Valid       bool    `json:"valid"`
	ChecksumOK bool    `json:"checksum_ok"`
	BatchID     string  `json:"batch_id"`
	BatchPrefix string  `json:"batch_prefix"`
	CampaignID  string  `json:"campaign_id"`
	Serial      int64   `json:"serial"`
	Ref2        string  `json:"ref2"`
	Status      string  `json:"status"`
	ProductName string  `json:"product_name,omitempty"`
	RollID      *string `json:"roll_id,omitempty"`
	RollNumber  *int    `json:"roll_number,omitempty"`
	RollStatus  *string `json:"roll_status,omitempty"`
	RollProduct *string `json:"roll_product_name,omitempty"`
}

func (h *Handler) resolveRef2(ctx context.Context, tenantID, ref2 string) (*VerifyResult, error) {
	runningNumber, ok := codegen.ParseRef2(ref2)
	if !ok {
		return nil, ErrRef2NotFound
	}

	var batchID, campaignID, prefix, batchStatus, campaignName string
	var serialStart, ref2Start int64
	err := h.db.QueryRow(ctx,
		`SELECT b.id, b.campaign_id, b.prefix, b.serial_start, b.ref2_start, b.status, c.name
		 FROM batches b
		 JOIN campaigns c ON c.id = b.campaign_id
		 WHERE b.tenant_id = $1 AND b.status != 'recalled'
		   AND b.ref2_start IS NOT NULL
		   AND $2 BETWEEN b.ref2_start AND b.ref2_end
		 LIMIT 1`,
		tenantID, runningNumber,
	).Scan(&batchID, &campaignID, &prefix, &serialStart, &ref2Start, &batchStatus, &campaignName)
	if err != nil {
		return nil, ErrRef2NotFound
	}

	serial := serialStart + (runningNumber - ref2Start)

	// Verify ref2 matches (checksum integrity)
	computed := codegen.GenerateRef2(runningNumber)
	if computed != ref2 {
		return nil, ErrRef2NotFound
	}

	result := &VerifyResult{
		Valid:       true,
		ChecksumOK: true,
		BatchID:     batchID,
		BatchPrefix: prefix,
		CampaignID:  campaignID,
		Serial:      serial,
		Ref2:        ref2,
		Status:      batchStatus,
		ProductName: campaignName,
	}

	var rollID string
	var rollNumber int
	var rollStatus string
	var rollProduct *string
	err = h.db.QueryRow(ctx,
		`SELECT r.id, r.roll_number, r.status, p.name
		 FROM rolls r
		 LEFT JOIN products p ON p.id = r.product_id
		 WHERE r.batch_id = $1 AND r.tenant_id = $2
		    AND $3 BETWEEN r.serial_start AND r.serial_end
		 LIMIT 1`,
		batchID, tenantID, serial,
	).Scan(&rollID, &rollNumber, &rollStatus, &rollProduct)
	if err == nil {
		result.RollID = &rollID
		result.RollNumber = &rollNumber
		result.RollStatus = &rollStatus
		result.RollProduct = rollProduct
	}

	return result, nil
}
