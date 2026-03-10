package qc

import (
	"context"
	"encoding/json"
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
	Ref1        string  `json:"ref1,omitempty"`
	Ref2        string  `json:"ref2"`
	Status      string  `json:"status"`
	ProductName string  `json:"product_name,omitempty"`
	RollID      *string `json:"roll_id,omitempty"`
	RollNumber  *int    `json:"roll_number,omitempty"`
	RollStatus  *string `json:"roll_status,omitempty"`
	RollProduct         *string  `json:"roll_product_name,omitempty"`
	RollProductImageURL *string  `json:"roll_product_image_url,omitempty"`
	MappingEvidenceURLs []string `json:"mapping_evidence_urls,omitempty"`
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
	offset := serial - serialStart

	computed := codegen.GenerateRef2(runningNumber)
	if computed != ref2 {
		return nil, ErrRef2NotFound
	}

	// Load tenant/campaign settings to compute ref1
	var rawTenantSettings, rawCampaignSettings string
	_ = h.db.QueryRow(ctx,
		`SELECT COALESCE(t.settings, '{}'::jsonb)::text, COALESCE(c.settings, '{}'::jsonb)::text
		 FROM tenants t
		 JOIN campaigns c ON c.tenant_id = t.id AND c.id = $2
		 WHERE t.id = $1`,
		tenantID, campaignID,
	).Scan(&rawTenantSettings, &rawCampaignSettings)

	var tenantSettingsMap, campaignSettingsMap map[string]any
	_ = json.Unmarshal([]byte(rawTenantSettings), &tenantSettingsMap)
	_ = json.Unmarshal([]byte(rawCampaignSettings), &campaignSettingsMap)
	exportCfg := codegen.ConfigFromTenantSettings(tenantSettingsMap)
	campaignCfg := codegen.ConfigFromCampaignSettings(campaignSettingsMap)
	exportCfg = exportCfg.MergeWith(campaignCfg)

	runningForRef1 := serial
	if exportCfg.Ref1MinValue > 0 {
		runningForRef1 = exportCfg.Ref1MinValue + offset
	}
	ref1 := codegen.GenerateRef1(runningForRef1, exportCfg)

	result := &VerifyResult{
		Valid:       true,
		ChecksumOK: true,
		BatchID:     batchID,
		BatchPrefix: prefix,
		CampaignID:  campaignID,
		Serial:      serial,
		Ref1:        ref1,
		Ref2:        ref2,
		Status:      batchStatus,
		ProductName: campaignName,
	}

	var rollID string
	var rollNumber int
	var rollStatus string
	var rollProduct *string
	var rollProductImage *string
	var evidenceURLs []string
	err = h.db.QueryRow(ctx,
		`SELECT r.id, r.roll_number, r.status, p.name, p.image_url, r.mapping_evidence_urls
		 FROM rolls r
		 LEFT JOIN products p ON p.id = r.product_id
		 WHERE r.batch_id = $1 AND r.tenant_id = $2
		    AND $3 BETWEEN r.serial_start AND r.serial_end
		 LIMIT 1`,
		batchID, tenantID, serial,
	).Scan(&rollID, &rollNumber, &rollStatus, &rollProduct, &rollProductImage, &evidenceURLs)
	if err == nil {
		result.RollID = &rollID
		result.RollNumber = &rollNumber
		result.RollStatus = &rollStatus
		result.RollProduct = rollProduct
		result.RollProductImageURL = rollProductImage
		if len(evidenceURLs) > 0 {
			result.MappingEvidenceURLs = evidenceURLs
		}
	}

	return result, nil
}
