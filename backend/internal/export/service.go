package export

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/minio/minio-go/v7"

	"saversure/pkg/codegen"
	qrhmac "saversure/pkg/hmac"
)

type Service struct {
	db     *pgxpool.Pool
	mc     *minio.Client
	bucket string
	pubURL string
	signer *qrhmac.Signer
}

func NewService(db *pgxpool.Pool, mc *minio.Client, bucket, pubURL string, signer *qrhmac.Signer) *Service {
	return &Service{db: db, mc: mc, bucket: bucket, pubURL: pubURL, signer: signer}
}

type ExportLog struct {
	ID              string   `json:"id"`
	TenantID        string   `json:"tenant_id"`
	BatchID         string   `json:"batch_id"`
	RollIDs         []string `json:"roll_ids"`
	RollNumbers     []int    `json:"roll_numbers"`
	SerialStart     int64    `json:"serial_range_start"`
	SerialEnd       int64    `json:"serial_range_end"`
	TotalCodes      int64    `json:"total_codes"`
	Format          string   `json:"format"`
	FileURL         *string  `json:"file_url"`
	FileSize        *int64   `json:"file_size"`
	DownloadToken   string   `json:"download_token"`
	ExpiresAt       string   `json:"expires_at"`
	DownloadCount   int      `json:"download_count"`
	LastDownloaded  *string  `json:"last_downloaded_at"`
	FactoryID       *string  `json:"factory_id"`
	FactoryName     *string  `json:"factory_name,omitempty"`
	ExportedBy      string   `json:"exported_by"`
	ExportedByName  *string  `json:"exported_by_name,omitempty"`
	Note            *string  `json:"note"`
	CreatedAt       string   `json:"created_at"`
}

type CreateExportInput struct {
	BatchID   string   `json:"batch_id" binding:"required"`
	RollIDs   []string `json:"roll_ids" binding:"required"`
	FactoryID string   `json:"factory_id"`
	Format    string   `json:"format"`
	Note      string   `json:"note"`
}

type DuplicateWarning struct {
	RollNumber int    `json:"roll_number"`
	ExportedAt string `json:"exported_at"`
	ExportedBy string `json:"exported_by_name"`
	Factory    string `json:"factory_name"`
}

type CreateExportResult struct {
	Export      *ExportLog         `json:"export"`
	DownloadURL string            `json:"download_url"`
	Warnings    []DuplicateWarning `json:"warnings"`
}

func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

type rollInfo struct {
	ID          string
	BatchID     string
	RollNumber  int
	SerialStart int64
	SerialEnd   int64
}

type batchInfo struct {
	Prefix     string
	CampaignID string
	Ref2Start  *int64
	SerialStart int64
}

func (s *Service) CreateExport(ctx context.Context, tenantID, actorID, apiBase string, input CreateExportInput) (*CreateExportResult, error) {
	var actorName string
	s.db.QueryRow(ctx, `SELECT COALESCE(display_name, email) FROM users WHERE id = $1`, actorID).Scan(&actorName)
	if len(input.RollIDs) == 0 {
		return nil, fmt.Errorf("roll_ids is required")
	}

	format := input.Format
	if format == "" {
		format = "zip"
	}
	if format != "csv" && format != "zip" {
		return nil, fmt.Errorf("format must be csv or zip")
	}

	// Load rolls
	rows, err := s.db.Query(ctx,
		`SELECT id, batch_id, roll_number, serial_start, serial_end
		 FROM rolls WHERE tenant_id = $1 AND id = ANY($2)
		 ORDER BY roll_number`,
		tenantID, input.RollIDs,
	)
	if err != nil {
		return nil, fmt.Errorf("query rolls: %w", err)
	}
	defer rows.Close()

	var rolls []rollInfo
	batchID := ""
	for rows.Next() {
		var r rollInfo
		if err := rows.Scan(&r.ID, &r.BatchID, &r.RollNumber, &r.SerialStart, &r.SerialEnd); err != nil {
			return nil, fmt.Errorf("scan roll: %w", err)
		}
		if batchID == "" {
			batchID = r.BatchID
		} else if r.BatchID != batchID {
			return nil, fmt.Errorf("all rolls must belong to the same batch")
		}
		rolls = append(rolls, r)
	}
	if len(rolls) == 0 {
		return nil, fmt.Errorf("no valid rolls found")
	}
	if input.BatchID != "" && input.BatchID != batchID {
		return nil, fmt.Errorf("batch_id mismatch with roll data")
	}

	// Load batch
	var bi batchInfo
	err = s.db.QueryRow(ctx,
		`SELECT prefix, campaign_id, ref2_start, serial_start FROM batches WHERE id = $1 AND tenant_id = $2`,
		batchID, tenantID,
	).Scan(&bi.Prefix, &bi.CampaignID, &bi.Ref2Start, &bi.SerialStart)
	if err != nil {
		return nil, fmt.Errorf("batch not found: %w", err)
	}

	// Check duplicates
	var warnings []DuplicateWarning
	dupRows, err := s.db.Query(ctx,
		`SELECT el.roll_numbers, el.created_at::text, COALESCE(el.exported_by_name, ''), COALESCE(f.name, '')
		 FROM export_logs el
		 LEFT JOIN factories f ON f.id = el.factory_id
		 WHERE el.tenant_id = $1 AND el.roll_ids && $2
		 ORDER BY el.created_at DESC LIMIT 10`,
		tenantID, input.RollIDs,
	)
	if err == nil {
		defer dupRows.Close()
		for dupRows.Next() {
			var nums []int
			var at, by, fac string
			if err := dupRows.Scan(&nums, &at, &by, &fac); err == nil {
				for _, n := range nums {
					warnings = append(warnings, DuplicateWarning{
						RollNumber: n, ExportedAt: at, ExportedBy: by, Factory: fac,
					})
				}
			}
		}
	}

	// Build settings
	tenantSettings := s.fetchSettings(ctx, "tenants", tenantID)
	campaignSettings := s.fetchCampaignSettings(ctx, bi.CampaignID, tenantID)
	cfg := codegen.ConfigFromTenantSettings(tenantSettings).MergeWith(codegen.ConfigFromCampaignSettings(campaignSettings))

	baseURL := cfg.ScanBaseURL
	if baseURL == "" {
		baseURL = "https://qr.svsu.me"
	}
	hmacLen := cfg.HMACLength
	if hmacLen <= 0 {
		hmacLen = 8
	}
	lotSize := cfg.LotSize
	if lotSize <= 0 {
		lotSize = 10000
	}

	var shortcode *string
	s.db.QueryRow(ctx, `SELECT shortcode FROM tenants WHERE id = $1`, tenantID).Scan(&shortcode)

	// Load factory export config
	var factoryCfg codegen.FactoryExportConfig
	factoryCfg.ExportFormat = 1
	factoryCfg.CodesPerRoll = 10000
	factoryCfg.RollsPerFile = 4
	if input.FactoryID != "" {
		s.db.QueryRow(ctx,
			`SELECT export_format, codes_per_roll, rolls_per_file FROM factories WHERE id = $1`,
			input.FactoryID,
		).Scan(&factoryCfg.ExportFormat, &factoryCfg.CodesPerRoll, &factoryCfg.RollsPerFile)
	}

	// Generate file
	var rollIDs []string
	var rollNumbers []int
	var serialMin, serialMax int64
	var totalCodes int64

	serialMin = rolls[0].SerialStart
	for _, r := range rolls {
		rollIDs = append(rollIDs, r.ID)
		rollNumbers = append(rollNumbers, r.RollNumber)
		if r.SerialStart < serialMin {
			serialMin = r.SerialStart
		}
		if r.SerialEnd > serialMax {
			serialMax = r.SerialEnd
		}
		totalCodes += r.SerialEnd - r.SerialStart + 1
	}

	// Build records grouped by roll
	var allRollRecords []codegen.RollRecords
	for _, r := range rolls {
		var recs []codegen.ExportRecord
		for serial := r.SerialStart; serial <= r.SerialEnd; serial++ {
			rec := s.buildRecord(serial, bi, cfg, baseURL, hmacLen, lotSize)
			if shortcode != nil && *shortcode != "" {
				cleanBase := strings.TrimSuffix(baseURL, "/s")
				rec.URL = fmt.Sprintf("%s/%s/%s", cleanBase, *shortcode, rec.Ref1)
			}
			recs = append(recs, rec)
		}
		allRollRecords = append(allRollRecords, codegen.RollRecords{
			RollNumber: r.RollNumber,
			Records:    recs,
		})
	}

	var buf bytes.Buffer
	if format == "zip" {
		s.writeZipFormatted(&buf, allRollRecords, bi.Prefix, factoryCfg)
	} else {
		s.writeCSVFormatted(&buf, allRollRecords, factoryCfg)
	}

	// Upload to MinIO
	token := generateToken()
	ext := "zip"
	if format == "csv" {
		ext = "csv"
	}
	objectName := fmt.Sprintf("exports/%s/%s/%s.%s",
		time.Now().Format("2006/01"),
		bi.Prefix,
		token[:16],
		ext,
	)

	var fileURL *string
	var fileSize *int64
	if s.mc != nil {
		reader := bytes.NewReader(buf.Bytes())
		contentType := "application/zip"
		if format == "csv" {
			contentType = "text/csv"
		}
		_, err = s.mc.PutObject(ctx, s.bucket, objectName, reader, int64(buf.Len()),
			minio.PutObjectOptions{ContentType: contentType},
		)
		if err != nil {
			return nil, fmt.Errorf("upload to MinIO: %w", err)
		}
		url := fmt.Sprintf("%s/%s/%s", strings.TrimRight(s.pubURL, "/"), s.bucket, objectName)
		fileURL = &url
		sz := int64(buf.Len())
		fileSize = &sz
	}

	// Save export log
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	var factoryID *string
	if input.FactoryID != "" {
		factoryID = &input.FactoryID
	}
	var note *string
	if input.Note != "" {
		note = &input.Note
	}

	var el ExportLog
	err = s.db.QueryRow(ctx,
		`INSERT INTO export_logs
			(tenant_id, batch_id, roll_ids, roll_numbers, serial_range_start, serial_range_end,
			 total_codes, format, file_url, file_size, download_token, expires_at,
			 factory_id, exported_by, exported_by_name, note)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		 RETURNING id, created_at::text`,
		tenantID, batchID, rollIDs, rollNumbers,
		serialMin, serialMax, totalCodes, format,
		fileURL, fileSize, token, expiresAt,
		factoryID, actorID, actorName, note,
	).Scan(&el.ID, &el.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("save export log: %w", err)
	}

	el.TenantID = tenantID
	el.BatchID = batchID
	el.RollIDs = rollIDs
	el.RollNumbers = rollNumbers
	el.SerialStart = serialMin
	el.SerialEnd = serialMax
	el.TotalCodes = totalCodes
	el.Format = format
	el.FileURL = fileURL
	el.FileSize = fileSize
	el.DownloadToken = token
	el.ExpiresAt = expiresAt.Format(time.RFC3339)
	el.DownloadCount = 0
	el.FactoryID = factoryID
	el.ExportedBy = actorID
	el.ExportedByName = &actorName
	el.Note = note

	downloadURL := fmt.Sprintf("%s/api/v1/exports/download/%s", strings.TrimRight(apiBase, "/"), token)

	return &CreateExportResult{
		Export:      &el,
		DownloadURL: downloadURL,
		Warnings:    warnings,
	}, nil
}

func (s *Service) writeCSVFormatted(buf *bytes.Buffer, allRolls []codegen.RollRecords, fcfg codegen.FactoryExportConfig) {
	switch fcfg.ExportFormat {
	case 2:
		codegen.WriteFormat2Multi4(buf, allRolls)
	case 3:
		codegen.WriteFormat3MultiN(buf, allRolls, fcfg.RollsPerFile)
	case 4:
		codegen.WriteFormat4SingleNoHeader(buf, allRolls)
	default:
		codegen.WriteFormat1Flat(buf, allRolls)
	}
}

func (s *Service) writeZipFormatted(buf *bytes.Buffer, allRolls []codegen.RollRecords, prefix string, fcfg codegen.FactoryExportConfig) {
	zw := codegen.NewZipExporter(buf, int64(fcfg.CodesPerRoll)*int64(fcfg.RollsPerFile))

	if fcfg.ExportFormat == 1 || fcfg.ExportFormat == 4 {
		// Format 1 & 4: one CSV per roll
		for _, rg := range allRolls {
			fileName := fmt.Sprintf("%s_roll%d.csv", prefix, rg.RollNumber)
			if err := zw.StartFile(fileName); err != nil {
				continue
			}
			switch fcfg.ExportFormat {
			case 4:
				zw.WriteRaw(func(w io.Writer) { codegen.WriteFormat4SingleNoHeader(w, []codegen.RollRecords{rg}) })
			default:
				zw.WriteRaw(func(w io.Writer) { codegen.WriteFormat1Flat(w, []codegen.RollRecords{rg}) })
			}
		}
	} else {
		// Format 2 & 3: chunk rolls into groups of rollsPerFile, one CSV per group
		rpf := fcfg.RollsPerFile
		if rpf <= 0 {
			rpf = 4
		}
		fileIdx := 1
		for i := 0; i < len(allRolls); i += rpf {
			end := i + rpf
			if end > len(allRolls) {
				end = len(allRolls)
			}
			chunk := allRolls[i:end]
			fileName := fmt.Sprintf("%s_%d.csv", prefix, fileIdx)
			if err := zw.StartFile(fileName); err != nil {
				continue
			}
			switch fcfg.ExportFormat {
			case 2:
				zw.WriteRaw(func(w io.Writer) { codegen.WriteFormat2Multi4(w, chunk) })
			case 3:
				zw.WriteRaw(func(w io.Writer) { codegen.WriteFormat3MultiN(w, chunk, rpf) })
			}
			fileIdx++
		}
	}
	zw.Close()
}

func (s *Service) buildRecord(serial int64, bi batchInfo, cfg codegen.ExportConfig, baseURL string, hmacLen int, lotSize int64) codegen.ExportRecord {
	offset := serial - bi.SerialStart

	var ref2Running int64
	if bi.Ref2Start != nil {
		ref2Running = *bi.Ref2Start + offset
	}

	runningNumber := serial
	if cfg.Ref1MinValue > 0 {
		runningNumber = cfg.Ref1MinValue + offset
	}

	var code, url string
	if cfg.CompactCode {
		code = s.signer.GenerateCompactCode(bi.Prefix, serial, hmacLen)
		if cfg.URLFormat == "path" {
			url = fmt.Sprintf("%s/%s", baseURL, code)
		} else {
			url = fmt.Sprintf("%s?code=%s", baseURL, code)
		}
	} else {
		code = s.signer.GenerateCode(bi.Prefix, serial)
		url = fmt.Sprintf("%s?code=%s", baseURL, code)
	}

	lotNum := offset/lotSize + 1
	return codegen.ExportRecord{
		SerialNumber: serial,
		Code:         code,
		Ref1:         codegen.GenerateRef1(runningNumber, cfg),
		Ref2:         codegen.GenerateRef2(ref2Running),
		URL:          url,
		LotNumber:    fmt.Sprintf("LOT%04d", lotNum),
	}
}

func (s *Service) Download(ctx context.Context, token string) (io.ReadCloser, string, string, error) {
	var el struct {
		ID        string
		FileURL   *string
		Format    string
		ExpiresAt time.Time
		TenantID  string
		BatchID   string
		Prefix    string
	}
	err := s.db.QueryRow(ctx,
		`SELECT el.id, el.file_url, el.format, el.expires_at, el.tenant_id, el.batch_id, b.prefix
		 FROM export_logs el
		 JOIN batches b ON b.id = el.batch_id
		 WHERE el.download_token = $1`, token,
	).Scan(&el.ID, &el.FileURL, &el.Format, &el.ExpiresAt, &el.TenantID, &el.BatchID, &el.Prefix)
	if err != nil {
		return nil, "", "", fmt.Errorf("export not found")
	}

	if time.Now().After(el.ExpiresAt) {
		return nil, "", "", fmt.Errorf("download link expired")
	}

	// Update download count
	s.db.Exec(ctx,
		`UPDATE export_logs SET download_count = download_count + 1, last_downloaded_at = NOW() WHERE id = $1`,
		el.ID,
	)

	if el.FileURL == nil || s.mc == nil {
		return nil, "", "", fmt.Errorf("file not available")
	}

	// Extract object name from URL
	urlStr := *el.FileURL
	prefix := fmt.Sprintf("%s/%s/", strings.TrimRight(s.pubURL, "/"), s.bucket)
	objectName := strings.TrimPrefix(urlStr, prefix)

	obj, err := s.mc.GetObject(ctx, s.bucket, objectName, minio.GetObjectOptions{})
	if err != nil {
		return nil, "", "", fmt.Errorf("get file from storage: %w", err)
	}

	ext := "zip"
	ct := "application/zip"
	if el.Format == "csv" {
		ext = "csv"
		ct = "text/csv"
	}
	fileName := fmt.Sprintf("%s_export.%s", el.Prefix, ext)

	return obj, fileName, ct, nil
}

func (s *Service) List(ctx context.Context, tenantID string, batchID, factoryID string, limit, offset int) ([]ExportLog, int64, error) {
	if limit <= 0 {
		limit = 50
	}

	where := "el.tenant_id = $1"
	args := []any{tenantID}
	argN := 2

	if batchID != "" {
		where += fmt.Sprintf(" AND el.batch_id = $%d", argN)
		args = append(args, batchID)
		argN++
	}
	if factoryID != "" {
		where += fmt.Sprintf(" AND el.factory_id = $%d", argN)
		args = append(args, factoryID)
		argN++
	}

	var total int64
	s.db.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM export_logs el WHERE %s", where), args...).Scan(&total)

	query := fmt.Sprintf(
		`SELECT el.id, el.tenant_id, el.batch_id, el.roll_ids, el.roll_numbers,
			el.serial_range_start, el.serial_range_end, el.total_codes,
			el.format, el.file_url, el.file_size, el.download_token,
			el.expires_at::text, el.download_count, el.last_downloaded_at::text,
			el.factory_id, f.name, el.exported_by, u.display_name, el.note, el.created_at::text
		 FROM export_logs el
		 LEFT JOIN factories f ON f.id = el.factory_id
		 LEFT JOIN users u ON u.id = el.exported_by
		 WHERE %s
		 ORDER BY el.created_at DESC LIMIT $%d OFFSET $%d`,
		where, argN, argN+1,
	)
	args = append(args, limit, offset)

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list export logs: %w", err)
	}
	defer rows.Close()

	var logs []ExportLog
	for rows.Next() {
		var el ExportLog
		if err := rows.Scan(
			&el.ID, &el.TenantID, &el.BatchID, &el.RollIDs, &el.RollNumbers,
			&el.SerialStart, &el.SerialEnd, &el.TotalCodes,
			&el.Format, &el.FileURL, &el.FileSize, &el.DownloadToken,
			&el.ExpiresAt, &el.DownloadCount, &el.LastDownloaded,
			&el.FactoryID, &el.FactoryName, &el.ExportedBy, &el.ExportedByName, &el.Note, &el.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan export log: %w", err)
		}
		if el.RollIDs == nil {
			el.RollIDs = []string{}
		}
		if el.RollNumbers == nil {
			el.RollNumbers = []int{}
		}
		logs = append(logs, el)
	}
	return logs, total, nil
}

// SampleCodes generates a few sample QR code records from a given roll for preview/testing.
func (s *Service) SampleCodes(ctx context.Context, tenantID, rollID string, count int) ([]codegen.ExportRecord, error) {
	if count <= 0 {
		count = 5
	}
	if count > 20 {
		count = 20
	}

	var batchID string
	var serialStart, serialEnd int64
	err := s.db.QueryRow(ctx,
		`SELECT batch_id, serial_start, serial_end FROM rolls WHERE id = $1 AND tenant_id = $2`,
		rollID, tenantID,
	).Scan(&batchID, &serialStart, &serialEnd)
	if err != nil {
		return nil, fmt.Errorf("roll not found")
	}

	var bi batchInfo
	err = s.db.QueryRow(ctx,
		`SELECT prefix, campaign_id, ref2_start, serial_start FROM batches WHERE id = $1 AND tenant_id = $2`,
		batchID, tenantID,
	).Scan(&bi.Prefix, &bi.CampaignID, &bi.Ref2Start, &bi.SerialStart)
	if err != nil {
		return nil, fmt.Errorf("batch not found")
	}

	tenantSettings := s.fetchSettings(ctx, "tenants", tenantID)
	campaignSettings := s.fetchCampaignSettings(ctx, bi.CampaignID, tenantID)
	cfg := codegen.ConfigFromTenantSettings(tenantSettings).MergeWith(codegen.ConfigFromCampaignSettings(campaignSettings))

	// Fetch tenant shortcode for V2 URL format
	var shortcode *string
	s.db.QueryRow(ctx, `SELECT shortcode FROM tenants WHERE id = $1`, tenantID).Scan(&shortcode)

	baseURL := cfg.ScanBaseURL
	if baseURL == "" {
		baseURL = "https://qr.svsu.me"
	}
	hmacLen := cfg.HMACLength
	if hmacLen <= 0 {
		hmacLen = 8
	}
	lotSize := cfg.LotSize
	if lotSize <= 0 {
		lotSize = 10000
	}

	total := int(serialEnd - serialStart + 1)
	if count > total {
		count = total
	}

	step := 1
	if total > count {
		step = total / count
	}

	var records []codegen.ExportRecord
	for i := 0; i < count; i++ {
		serial := serialStart + int64(i*step)
		if serial > serialEnd {
			serial = serialEnd
		}
		rec := s.buildRecord(serial, bi, cfg, baseURL, hmacLen, lotSize)
		if shortcode != nil && *shortcode != "" {
			cleanBase := strings.TrimSuffix(baseURL, "/s")
			rec.URL = fmt.Sprintf("%s/%s/%s", cleanBase, *shortcode, rec.Ref1)
		}
		records = append(records, rec)
	}
	return records, nil
}

func (s *Service) fetchSettings(ctx context.Context, table, id string) map[string]any {
	var raw []byte
	err := s.db.QueryRow(ctx, fmt.Sprintf(`SELECT COALESCE(settings, '{}'::jsonb)::text FROM %s WHERE id = $1`, table), id).Scan(&raw)
	if err != nil {
		return nil
	}
	var m map[string]any
	json.Unmarshal(raw, &m)
	return m
}

func (s *Service) fetchCampaignSettings(ctx context.Context, campaignID, tenantID string) map[string]any {
	var raw []byte
	err := s.db.QueryRow(ctx,
		`SELECT COALESCE(settings, '{}'::jsonb)::text FROM campaigns WHERE id = $1 AND tenant_id = $2`,
		campaignID, tenantID,
	).Scan(&raw)
	if err != nil {
		return nil
	}
	var m map[string]any
	json.Unmarshal(raw, &m)
	return m
}
