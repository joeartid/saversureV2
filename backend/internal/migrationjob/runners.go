package migrationjob

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const placeholderHash = "$2a$10$V1MiGrAtEdNoP4ssw0rd000000000000000000000000000000000"

func (s *Service) runModule(ctx context.Context, mc moduleContext) (*moduleOutcome, error) {
	switch mc.ModuleName {
	case ModuleCustomer:
		return s.runCustomer(ctx, mc)
	case ModuleProduct:
		return s.runProducts(ctx, mc)
	case ModuleRewards:
		return s.runRewards(ctx, mc)
	case ModuleScanHistory:
		return s.runScanHistory(ctx, mc)
	case ModuleRedeemHistory:
		return s.runRedeemHistory(ctx, mc)
	case ModuleLuckyDraw:
		return s.runLuckyDraw(ctx, mc)
	default:
		return nil, fmt.Errorf("unknown migration module: %s", mc.ModuleName)
	}
}

func (s *Service) runCustomer(ctx context.Context, mc moduleContext) (*moduleOutcome, error) {
	outcome := &moduleOutcome{Warnings: []string{}, Summary: map[string]any{}}

	var userCount, addressCount, pointsCount int64
	_ = mc.Source.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL`).Scan(&userCount)
	_ = mc.Source.pool.QueryRow(ctx, `SELECT COUNT(*) FROM user_address WHERE deleted_at IS NULL`).Scan(&addressCount)
	_ = mc.Source.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND point > 0`).Scan(&pointsCount)
	outcome.Estimated = userCount + addressCount + pointsCount
	if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "planning", *outcome); err != nil {
		return nil, err
	}
	if mc.Mode == JobModeDryRun {
		outcome.Processed = outcome.Estimated
		outcome.Summary["users_to_process"] = userCount
		outcome.Summary["addresses_to_process"] = addressCount
		outcome.Summary["point_balances_to_process"] = pointsCount
		if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "validated", *outcome); err != nil {
			return nil, err
		}
		return outcome, nil
	}

	// Fast skip: if V2 already has ≥95% of V1 users migrated, skip entire module
	var v2UserCount int64
	_ = s.db.QueryRow(ctx, `SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND v1_user_id IS NOT NULL`, mc.TenantID).Scan(&v2UserCount)
	if v2UserCount > 0 && float64(v2UserCount)/float64(userCount) >= 0.95 {
		outcome.Processed = outcome.Estimated
		outcome.Summary["fast_skip"] = true
		outcome.Summary["v2_users_exist"] = v2UserCount
		outcome.Summary["v1_users_total"] = userCount
		outcome.Summary["message"] = "Customer data already migrated (≥95%), skipping"
		return outcome, nil
	}

	rows, err := mc.Source.pool.Query(ctx,
		`SELECT id, name, surname, email, telephone, line_user_id, birth_date, gender, profile_image,
		        province, occupation, flag, status, created_at, updated_at
		 FROM users
		 WHERE deleted_at IS NULL
		 ORDER BY id`,
	)
	if err != nil {
		return nil, fmt.Errorf("query v1 users: %w", err)
	}
	defer rows.Close()

	var usersInserted, usersSkipped, placeholderEmails int64
	batchCounter := 0
	for rows.Next() {
		if err := s.ensureNotCancelled(ctx, mc.JobID); err != nil {
			return nil, err
		}
		var (
			v1ID                                       int64
			name, surname, email, phone, lineUserID    *string
			gender, profileImage, province, occupation *string
			flag, status                               *int32
			birthDate, createdAt, updatedAt            *time.Time
		)
		if err := rows.Scan(&v1ID, &name, &surname, &email, &phone, &lineUserID, &birthDate, &gender, &profileImage, &province, &occupation, &flag, &status, &createdAt, &updatedAt); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, "user", strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}

		created, err := s.upsertCustomerRow(ctx, mc, v1ID, name, surname, email, phone, lineUserID, birthDate, gender, profileImage, province, occupation, flag, status, createdAt, updatedAt, &placeholderEmails)
		if err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, "user", strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
		} else {
			if created {
				usersInserted++
			} else {
				usersSkipped++
			}
			outcome.Success++
		}
		outcome.Processed++
		batchCounter++
		if batchCounter%200 == 0 {
			if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "migrating_users", *outcome); err != nil {
				return nil, err
			}
		}
	}

	userMap, err := s.loadUserMap(ctx, mc.TenantID)
	if err != nil {
		return nil, err
	}

	addrRows, err := mc.Source.pool.Query(ctx,
		`SELECT id, user_id, recipient_name, recipient_address, sub_district, district,
		        province, postcode, telephone, is_default, created_at, updated_at
		 FROM user_address
		 WHERE deleted_at IS NULL
		 ORDER BY id`,
	)
	if err != nil {
		return nil, fmt.Errorf("query v1 addresses: %w", err)
	}
	defer addrRows.Close()

	var addressesInserted, addressesSkipped int64
	for addrRows.Next() {
		if err := s.ensureNotCancelled(ctx, mc.JobID); err != nil {
			return nil, err
		}
		var (
			v1AddressID, v1UserID                                 int64
			recipientName, recipientAddress, subDistrict, district *string
			province, phone                                        *string
			postalCode                                             *int64
			isDefault                                              *bool
			createdAt, updatedAt                                   *time.Time
		)
		if err := addrRows.Scan(&v1AddressID, &v1UserID, &recipientName, &recipientAddress, &subDistrict, &district, &province, &postalCode, &phone, &isDefault, &createdAt, &updatedAt); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeAddress, strconv.FormatInt(v1AddressID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		targetUserID, ok := userMap[v1UserID]
		if !ok {
			addressesSkipped++
			outcome.Processed++
			outcome.Warnings = appendLimited(outcome.Warnings, fmt.Sprintf("address %d skipped because user %d was not found", v1AddressID, v1UserID))
			continue
		}
		if _, found, err := s.getEntityMap(ctx, mc.TenantID, EntityTypeAddress, strconv.FormatInt(v1AddressID, 10)); err == nil && found {
			addressesSkipped++
			outcome.Success++
			outcome.Processed++
			continue
		}

		addressID := newUUID()
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return nil, err
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO user_addresses (
				id, user_id, tenant_id, label, recipient_name, phone, address_line1, address_line2,
				district, sub_district, province, postal_code, is_default, created_at, updated_at
			) VALUES (
				$1, $2, $3, 'home', $4, $5, $6, NULL, $7, $8, $9, $10, $11, COALESCE($12, NOW()), $13
			)`,
			addressID, targetUserID, mc.TenantID,
			truncOrDefault(recipientName, 200, "ไม่ระบุ"), truncOrDefault(phone, 20, ""),
			stringOrEmpty(recipientAddress), nullableString(district), nullableString(subDistrict),
			nullableString(province), nullablePostal(postalCode), boolOrDefault(isDefault, false), createdAt, updatedAt,
		)
		if err == nil {
			err = s.upsertEntityMap(ctx, tx, mc.TenantID, EntityTypeAddress, strconv.FormatInt(v1AddressID, 10), addressID, mc.JobID, map[string]any{
				"v1_user_id": v1UserID,
			})
		}
		if err != nil {
			tx.Rollback(ctx)
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeAddress, strconv.FormatInt(v1AddressID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		addressesInserted++
		outcome.Success++
		outcome.Processed++
		if outcome.Processed%200 == 0 {
			if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "migrating_addresses", *outcome); err != nil {
				return nil, err
			}
		}
	}

	existingPointRefs := map[string]bool{}
	pointRows, err := s.db.Query(ctx,
		`SELECT reference_id
		 FROM point_ledger
		 WHERE tenant_id = $1 AND reference_type = 'v1_migration'`,
		mc.TenantID,
	)
	if err != nil {
		return nil, err
	}
	for pointRows.Next() {
		var ref *string
		if err := pointRows.Scan(&ref); err == nil && ref != nil {
			existingPointRefs[*ref] = true
		}
	}
	pointRows.Close()

	srcPointRows, err := mc.Source.pool.Query(ctx,
		`SELECT id, point, created_at
		 FROM users
		 WHERE deleted_at IS NULL AND point > 0
		 ORDER BY id`,
	)
	if err != nil {
		return nil, fmt.Errorf("query v1 point balances: %w", err)
	}
	defer srcPointRows.Close()

	var pointsCreated, pointsSkipped int64
	for srcPointRows.Next() {
		if err := s.ensureNotCancelled(ctx, mc.JobID); err != nil {
			return nil, err
		}
		var v1UserID int64
		var points int32
		var createdAt *time.Time
		if err := srcPointRows.Scan(&v1UserID, &points, &createdAt); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, "point_balance", "", err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		targetUserID, ok := userMap[v1UserID]
		refID := strconv.FormatInt(v1UserID, 10)
		if !ok || existingPointRefs[refID] {
			pointsSkipped++
			outcome.Processed++
			continue
		}

		tx, err := s.db.Begin(ctx)
		if err != nil {
			return nil, err
		}
		// ON CONFLICT DO NOTHING — defends against:
		//   1. Concurrent migration jobs (in-memory existingPointRefs map is
		//      not thread-safe across jobs running in parallel)
		//   2. Manual re-runs of the migrator after partial completion
		// The matching unique index is created in migration 043
		// (idx_point_ledger_v1_migration_unique).
		_, err = tx.Exec(ctx,
			`INSERT INTO point_ledger (
				id, tenant_id, user_id, entry_type, amount, balance_after, reference_type, reference_id, description, currency, created_at
			) VALUES (
				$1, $2, $3, 'credit', $4, $4, 'v1_migration', $5, $6, 'point', COALESCE($7, NOW())
			)
			ON CONFLICT (tenant_id, user_id, reference_id)
			WHERE reference_type = 'v1_migration'
			DO NOTHING`,
			newUUID(), mc.TenantID, targetUserID, int(points), refID,
			fmt.Sprintf("V1 migrated balance (%d pts)", points), createdAt,
		)
		if err != nil {
			tx.Rollback(ctx)
			s.appendError(ctx, mc.JobID, mc.ModuleName, "point_balance", refID, err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		existingPointRefs[refID] = true
		pointsCreated++
		outcome.Success++
		outcome.Processed++
		if outcome.Processed%200 == 0 {
			if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "migrating_balances", *outcome); err != nil {
				return nil, err
			}
		}
	}

	outcome.Summary["users_total"] = userCount
	outcome.Summary["users_inserted_or_synced"] = usersInserted
	outcome.Summary["users_skipped"] = usersSkipped
	outcome.Summary["placeholder_emails"] = placeholderEmails
	outcome.Summary["addresses_total"] = addressCount
	outcome.Summary["addresses_inserted"] = addressesInserted
	outcome.Summary["addresses_skipped"] = addressesSkipped
	outcome.Summary["balances_total"] = pointsCount
	outcome.Summary["balances_created"] = pointsCreated
	outcome.Summary["balances_skipped"] = pointsSkipped
	return outcome, nil
}

func (s *Service) runProducts(ctx context.Context, mc moduleContext) (*moduleOutcome, error) {
	outcome := &moduleOutcome{Warnings: []string{}, Summary: map[string]any{}}
	var total int64
	_ = mc.Source.pool.QueryRow(ctx, `SELECT COUNT(*) FROM products WHERE deleted_at IS NULL`).Scan(&total)
	outcome.Estimated = total
	if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "planning", *outcome); err != nil {
		return nil, err
	}
	if mc.Mode == JobModeDryRun {
		outcome.Processed = total
		outcome.Summary["products_to_process"] = total
		return outcome, nil
	}

	rows, err := mc.Source.pool.Query(ctx,
		`SELECT id, name_th, name_en, name_sku, sku, points, extra_points, diamond_point, price, detail, created_at, updated_at
		 FROM products
		 WHERE deleted_at IS NULL
		 ORDER BY id`,
	)
	if err != nil {
		return nil, fmt.Errorf("query v1 products: %w", err)
	}
	defer rows.Close()

	var inserted, updated, skipped int64
	for rows.Next() {
		if err := s.ensureNotCancelled(ctx, mc.JobID); err != nil {
			return nil, err
		}
		var (
			v1ID                                    int64
			nameTH, nameEN, nameSKU, sku, detail   *string
			points, extraPoints, diamondPoint, price *int32
			createdAt, updatedAt                   *time.Time
		)
		if err := rows.Scan(&v1ID, &nameTH, &nameEN, &nameSKU, &sku, &points, &extraPoints, &diamondPoint, &price, &detail, &createdAt, &updatedAt); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeProduct, strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		if excludeLegacyProduct(v1ID, sku, nameTH) {
			skipped++
			outcome.Processed++
			outcome.Warnings = appendLimited(outcome.Warnings, fmt.Sprintf("product %d skipped due to migration rules", v1ID))
			continue
		}

		productID, exists, err := s.getEntityMap(ctx, mc.TenantID, EntityTypeProduct, strconv.FormatInt(v1ID, 10))
		if err != nil {
			return nil, err
		}
		if !exists && sku != nil && strings.TrimSpace(*sku) != "" {
			_ = s.db.QueryRow(ctx,
				`SELECT id FROM products WHERE tenant_id = $1 AND sku = $2`,
				mc.TenantID, truncString(strings.TrimSpace(*sku), 100),
			).Scan(&productID)
			exists = productID != ""
		}

		tx, err := s.db.Begin(ctx)
		if err != nil {
			return nil, err
		}
		name := resolveProductName(nameTH, nameEN, nameSKU, v1ID)
		description := buildProductDescription(nameEN, nameSKU, detail, price, extraPoints, diamondPoint)
		pointsPerScan := maxInt(1, intOrDefault(points, 1))
		skuClean := cleanSKU(sku)

		if exists {
			_, err = tx.Exec(ctx,
				`UPDATE products
				 SET name = $3, sku = $4, description = $5, points_per_scan = $6, point_currency = 'point',
				     status = 'active', updated_at = COALESCE($7, NOW())
				 WHERE id = $1 AND tenant_id = $2`,
				productID, mc.TenantID, name, skuClean, nullableStringValue(description), pointsPerScan, updatedAt,
			)
			if err == nil {
				err = s.upsertEntityMap(ctx, tx, mc.TenantID, EntityTypeProduct, strconv.FormatInt(v1ID, 10), productID, mc.JobID, map[string]any{
					"sku": skuClean,
				})
			}
		} else {
			productID = newUUID()
			_, err = tx.Exec(ctx,
				`INSERT INTO products (
					id, tenant_id, name, sku, description, image_url, points_per_scan, point_currency, status, created_at, updated_at
				) VALUES (
					$1, $2, $3, $4, $5, NULL, $6, 'point', 'active', COALESCE($7, NOW()), $8
				)`,
				productID, mc.TenantID, name, skuClean, nullableStringValue(description), pointsPerScan, createdAt, updatedAt,
			)
			if err == nil {
				err = s.upsertEntityMap(ctx, tx, mc.TenantID, EntityTypeProduct, strconv.FormatInt(v1ID, 10), productID, mc.JobID, map[string]any{
					"sku": skuClean,
				})
			}
		}
		if err != nil {
			tx.Rollback(ctx)
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeProduct, strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		if exists {
			updated++
		} else {
			inserted++
		}
		outcome.Success++
		outcome.Processed++
		if outcome.Processed%100 == 0 {
			if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "migrating_products", *outcome); err != nil {
				return nil, err
			}
		}
	}

	outcome.Summary["products_total"] = total
	outcome.Summary["products_inserted"] = inserted
	outcome.Summary["products_updated"] = updated
	outcome.Summary["products_skipped"] = skipped
	return outcome, nil
}

func (s *Service) runRewards(ctx context.Context, mc moduleContext) (*moduleOutcome, error) {
	outcome := &moduleOutcome{Warnings: []string{}, Summary: map[string]any{}}
	var total int64
	_ = mc.Source.pool.QueryRow(ctx, `SELECT COUNT(*) FROM rewards WHERE deleted_at IS NULL`).Scan(&total)
	outcome.Estimated = total
	if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "planning", *outcome); err != nil {
		return nil, err
	}
	if mc.Mode == JobModeDryRun {
		outcome.Processed = total
		outcome.Summary["rewards_to_process"] = total
		return outcome, nil
	}

	if err := s.ensureCurrency(ctx, mc.TenantID, "point", "Point", "⭐"); err != nil {
		return nil, fmt.Errorf("ensureCurrency(point): %w", err)
	}
	if err := s.ensureCurrency(ctx, mc.TenantID, "diamond", "Diamond Point", "💎"); err != nil {
		return nil, fmt.Errorf("ensureCurrency(diamond): %w", err)
	}
	campaignID, err := s.ensureMigrationCampaign(ctx, mc.TenantID, mc.RequestedBy)
	if err != nil {
		return nil, fmt.Errorf("ensureMigrationCampaign: %w", err)
	}

	rows, err := mc.Source.pool.Query(ctx,
		`SELECT id, name, description, point, diamond_point, quota, quota_balance, status, expired_at,
		        images, type, goods::text, coupon::text, partner_coupon::text, created_at, updated_at
		 FROM rewards
		 WHERE deleted_at IS NULL
		 ORDER BY id`,
	)
	if err != nil {
		return nil, fmt.Errorf("query v1 rewards: %w", err)
	}
	defer rows.Close()

	var inserted, updated, couponCodesImported int64
	for rows.Next() {
		if err := s.ensureNotCancelled(ctx, mc.JobID); err != nil {
			return nil, err
		}
		var (
			v1ID                                                  int64
			name, description, statusText, goodsJSON, couponJSON  *string
			partnerCouponJSON                                     *string
			pointCost, diamondCost, quota, quotaBalance           *int32
			expiresAt, createdAt, updatedAt                       *time.Time
			imagesRaw                                             *string
			rewardType                                            *int32
		)
		if err := rows.Scan(&v1ID, &name, &description, &pointCost, &diamondCost, &quota, &quotaBalance, &statusText, &expiresAt, &imagesRaw, &rewardType, &goodsJSON, &couponJSON, &partnerCouponJSON, &createdAt, &updatedAt); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeReward, strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		// V1 stores images as text (PostgreSQL array literal), parse manually
		var images []string
		if imagesRaw != nil && *imagesRaw != "" {
			raw := strings.Trim(*imagesRaw, "{}")
			for _, part := range strings.Split(raw, ",") {
				trimmed := strings.Trim(strings.TrimSpace(part), "\"")
				if trimmed != "" {
					images = append(images, trimmed)
				}
			}
		}

		currencyCode, pointValue, rewardKind, deliveryType, rewardWarnings := mapRewardShape(pointCost, diamondCost, rewardType, goodsJSON, couponJSON, partnerCouponJSON)
		outcome.Warnings = append(outcome.Warnings, rewardWarnings...)
		rewardID, exists, err := s.getEntityMap(ctx, mc.TenantID, EntityTypeReward, strconv.FormatInt(v1ID, 10))
		if err != nil {
			return nil, err
		}
		totalQty, soldQty := calcRewardInventory(quota, quotaBalance)
		imageURL := firstNonEmpty(images)
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return nil, err
		}
		if exists {
			_, err = tx.Exec(ctx,
				`UPDATE rewards
				 SET campaign_id = $3, name = $4, description = $5, type = $6, point_cost = $7,
				     cost_currency = $8, image_url = $9, delivery_type = $10, status = $11,
				     expires_at = $12, updated_at = COALESCE($13, NOW())
				 WHERE id = $1 AND tenant_id = $2`,
				rewardID, mc.TenantID, campaignID, truncOrDefault(name, 255, fmt.Sprintf("Reward %d", v1ID)),
				stringOrEmpty(description), rewardKind, pointValue, currencyCode, imageURL,
				deliveryType, mapRewardStatus(statusText), expiresAt, updatedAt,
			)
			if err == nil {
				_, err = tx.Exec(ctx,
					`UPDATE reward_inventory
					 SET total_qty = $2, sold_qty = $3, reserved_qty = 0, version = version + 1
					 WHERE reward_id = $1`,
					rewardID, totalQty, soldQty,
				)
			}
		} else {
			rewardID = newUUID()
			_, err = tx.Exec(ctx,
				`INSERT INTO rewards (
					id, tenant_id, campaign_id, name, description, type, point_cost, cost_currency,
					image_url, delivery_type, status, expires_at, created_at, updated_at
				) VALUES (
					$1, $2, $3, $4, $5, $6, $7, $8,
					$9, $10, $11, $12, COALESCE($13, NOW()), $14
				)`,
				rewardID, mc.TenantID, campaignID, truncOrDefault(name, 255, fmt.Sprintf("Reward %d", v1ID)),
				stringOrEmpty(description), rewardKind, pointValue, currencyCode,
				imageURL, deliveryType, mapRewardStatus(statusText), expiresAt, createdAt, updatedAt,
			)
			if err == nil {
				_, err = tx.Exec(ctx,
					`INSERT INTO reward_inventory (reward_id, total_qty, reserved_qty, sold_qty, version)
					 VALUES ($1, $2, 0, $3, 1)`,
					rewardID, totalQty, soldQty,
				)
			}
		}
		if err == nil {
			err = s.upsertEntityMap(ctx, tx, mc.TenantID, EntityTypeReward, strconv.FormatInt(v1ID, 10), rewardID, mc.JobID, map[string]any{
				"currency": currencyCode,
				"type":     rewardKind,
			})
		}
		if err == nil {
			count, importErr := s.importCouponPoolForReward(ctx, tx, mc, v1ID, rewardID)
			if importErr != nil {
				err = importErr
			} else {
				couponCodesImported += count
			}
		}
		if err != nil {
			tx.Rollback(ctx)
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeReward, strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		if exists {
			updated++
		} else {
			inserted++
		}
		outcome.Success++
		outcome.Processed++
		if outcome.Processed%50 == 0 {
			if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "migrating_rewards", *outcome); err != nil {
				return nil, err
			}
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating v1 rewards: %w", err)
	}

	outcome.Summary["rewards_total"] = total
	outcome.Summary["rewards_inserted"] = inserted
	outcome.Summary["rewards_updated"] = updated
	outcome.Summary["coupon_codes_imported"] = couponCodesImported
	return outcome, nil
}

func (s *Service) runScanHistory(ctx context.Context, mc moduleContext) (*moduleOutcome, error) {
	outcome := &moduleOutcome{Warnings: []string{}, Summary: map[string]any{}}
	var total int64
	_ = mc.Source.pool.QueryRow(ctx, `SELECT COUNT(*) FROM qrcode_scan_history`).Scan(&total)
	outcome.Estimated = total
	if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "planning", *outcome); err != nil {
		return nil, err
	}
	if mc.Mode == JobModeDryRun {
		outcome.Processed = total
		outcome.Summary["scan_history_to_process"] = total
		outcome.Summary["mode"] = "historical_snapshot"
		return outcome, nil
	}

	userMap, err := s.loadUserMap(ctx, mc.TenantID)
	if err != nil {
		return nil, err
	}

	// Load existing entity maps into memory for fast duplicate check (skip DB query per row)
	existingScans, err := s.loadExistingScanMap(ctx, mc.TenantID)
	if err != nil {
		return nil, fmt.Errorf("load existing scan map: %w", err)
	}

	rows, err := mc.Source.pool.Query(ctx,
		`SELECT id, user_id, points, extra_points, province, created_at, status
		 FROM qrcode_scan_history
		 ORDER BY id`,
	)
	if err != nil {
		return nil, fmt.Errorf("query v1 scan history: %w", err)
	}
	defer rows.Close()

	const batchSize = 500
	type scanRow struct {
		targetID   string
		userID     string
		points     int32
		province   *string
		createdAt  *time.Time
		scanType   string
		v1ID       int64
		v1UserID   int64
	}

	var inserted, skipped int64
	batch := make([]scanRow, 0, batchSize)

	flushBatch := func() error {
		if len(batch) == 0 {
			return nil
		}
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return err
		}
		// Batch insert scan_history
		for _, r := range batch {
			_, err = tx.Exec(ctx,
				`INSERT INTO scan_history (
					id, tenant_id, user_id, code_id, campaign_id, batch_id, points_earned, province, scanned_at, scan_type
				) VALUES (
					$1, $2, $3, NULL, NULL, NULL, $4, $5, COALESCE($6, NOW()), $7
				) ON CONFLICT DO NOTHING`,
				r.targetID, mc.TenantID, r.userID, r.points, r.province, r.createdAt, r.scanType,
			)
			if err != nil {
				tx.Rollback(ctx)
				return fmt.Errorf("insert scan %d: %w", r.v1ID, err)
			}
		}
		// Batch insert entity maps
		for _, r := range batch {
			var jobIDParam any = mc.JobID
			raw := fmt.Sprintf(`{"v1_user_id":%d}`, r.v1UserID)
			_, err = tx.Exec(ctx,
				`INSERT INTO migration_entity_maps (
					tenant_id, entity_type, source_system, source_id, target_id, latest_job_id, metadata, created_at, updated_at
				) VALUES ($1, $2, 'v1', $3, $4, $5, $6::jsonb, NOW(), NOW())
				ON CONFLICT (tenant_id, entity_type, source_system, source_id) DO NOTHING`,
				mc.TenantID, EntityTypeScan, strconv.FormatInt(r.v1ID, 10), r.targetID, jobIDParam, raw,
			)
			if err != nil {
				tx.Rollback(ctx)
				return fmt.Errorf("insert entity map scan %d: %w", r.v1ID, err)
			}
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		inserted += int64(len(batch))
		outcome.Success += int64(len(batch))
		batch = batch[:0]
		return nil
	}

	for rows.Next() {
		var (
			v1ID      int64
			v1UserID  *int64
			points    *int32
			extra     *int32
			province  *string
			createdAt *time.Time
			status    *int32
		)
		if err := rows.Scan(&v1ID, &v1UserID, &points, &extra, &province, &createdAt, &status); err != nil {
			outcome.Failed++
			outcome.Processed++
			continue
		}
		outcome.Processed++

		// Fast in-memory duplicate check
		if existingScans[v1ID] {
			skipped++
			continue
		}
		if v1UserID == nil {
			skipped++
			continue
		}
		targetUserID, ok := userMap[*v1UserID]
		if !ok {
			skipped++
			continue
		}

		batch = append(batch, scanRow{
			targetID:  newUUID(),
			userID:    targetUserID,
			points:    int32(intOrDefault(points, 0) + intOrDefault(extra, 0)),
			province:  nullableString(province),
			createdAt: createdAt,
			scanType:  mapScanStatus(status),
			v1ID:      v1ID,
			v1UserID:  *v1UserID,
		})

		if len(batch) >= batchSize {
			if err := flushBatch(); err != nil {
				s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeScan, "batch", err.Error(), nil)
				outcome.Failed += int64(len(batch))
				batch = batch[:0]
			}
		}

		if outcome.Processed%5000 == 0 {
			if err := s.ensureNotCancelled(ctx, mc.JobID); err != nil {
				return nil, err
			}
			if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "migrating_scan_history", *outcome); err != nil {
				return nil, err
			}
		}
	}

	// Flush remaining
	if len(batch) > 0 {
		if err := flushBatch(); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeScan, "batch_final", err.Error(), nil)
			outcome.Failed += int64(len(batch))
		}
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating v1 scan history: %w", err)
	}

	outcome.Summary["scan_history_total"] = total
	outcome.Summary["scan_history_inserted"] = inserted
	outcome.Summary["scan_history_skipped"] = skipped
	outcome.Summary["mode"] = "historical_snapshot_batched"
	return outcome, nil
}

func (s *Service) runLuckyDraw(ctx context.Context, mc moduleContext) (*moduleOutcome, error) {
	outcome := &moduleOutcome{Warnings: []string{}, Summary: map[string]any{}}

	var campaignCount, historyCount int64
	_ = mc.Source.pool.QueryRow(ctx, `SELECT COUNT(*) FROM lucky_draw_campaigns WHERE deleted_at IS NULL`).Scan(&campaignCount)
	_ = mc.Source.pool.QueryRow(ctx, `SELECT COUNT(*) FROM lucky_draw_histories WHERE deleted_at IS NULL`).Scan(&historyCount)
	outcome.Estimated = campaignCount + historyCount
	if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "planning", *outcome); err != nil {
		return nil, err
	}
	if mc.Mode == JobModeDryRun {
		outcome.Processed = outcome.Estimated
		outcome.Summary["campaigns_to_process"] = campaignCount
		outcome.Summary["tickets_to_process"] = historyCount
		return outcome, nil
	}

	// --- Stage 1: Campaigns ---
	rows, err := mc.Source.pool.Query(ctx,
		`SELECT id, name, description, images, banner_image, point, ticket, quota_balance,
		        start_date, end_date, status, created_at, updated_at
		 FROM lucky_draw_campaigns
		 WHERE deleted_at IS NULL
		 ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("query v1 lucky_draw_campaigns: %w", err)
	}
	defer rows.Close()

	var campaignsInserted, campaignsSkipped int64
	for rows.Next() {
		var (
			v1ID                              int64
			name, description, imagesRaw      *string
			bannerImage, statusText           *string
			pointCost, ticketCount, totalTix   *int32
			startDate, endDate                *time.Time
			createdAt, updatedAt              *time.Time
		)
		if err := rows.Scan(&v1ID, &name, &description, &imagesRaw, &bannerImage,
			&pointCost, &ticketCount, &totalTix,
			&startDate, &endDate, &statusText, &createdAt, &updatedAt); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeLDCampaign, strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}

		if _, found, err := s.getEntityMap(ctx, mc.TenantID, EntityTypeLDCampaign, strconv.FormatInt(v1ID, 10)); err == nil && found {
			campaignsSkipped++
			outcome.Processed++
			continue
		}

		// Parse image URL from images array or banner_image
		var imageURL *string
		if imagesRaw != nil && *imagesRaw != "" {
			raw := strings.Trim(*imagesRaw, "{}")
			parts := strings.SplitN(raw, ",", 2)
			if len(parts) > 0 {
				trimmed := strings.Trim(strings.TrimSpace(parts[0]), "\"")
				if trimmed != "" {
					imageURL = &trimmed
				}
			}
		}
		if imageURL == nil && bannerImage != nil && *bannerImage != "" {
			imageURL = bannerImage
		}

		// Map status — all V1 campaigns are historical
		v2Status := "ended"
		if statusText != nil && *statusText == "publish" {
			v2Status = "ended" // V1 campaigns are all old
		}

		title := stringOrDefault(name, "Untitled Campaign")
		if len(title) > 300 {
			title = title[:300]
		}

		campaignID := newUUID()
		maxTickets := intOrDefault(ticketCount, 1)
		if maxTickets <= 0 {
			maxTickets = 1
		}

		tx, err := s.db.Begin(ctx)
		if err != nil {
			return nil, err
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO lucky_draw_campaigns (
				id, tenant_id, title, description, image_url, cost_points,
				max_tickets_per_user, total_tickets, status,
				registration_start, registration_end, draw_date,
				created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13
			)`,
			campaignID, mc.TenantID, title, nullableString(description), imageURL,
			intOrDefault(pointCost, 0), maxTickets, intOrDefault(totalTix, 0), v2Status,
			startDate, endDate, createdAt, updatedAt,
		)
		if err == nil {
			err = s.upsertEntityMap(ctx, tx, mc.TenantID, EntityTypeLDCampaign,
				strconv.FormatInt(v1ID, 10), campaignID, mc.JobID, map[string]any{"v1_name": title})
		}
		if err != nil {
			tx.Rollback(ctx)
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeLDCampaign, strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		campaignsInserted++
		outcome.Success++
		outcome.Processed++
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating v1 lucky_draw_campaigns: %w", err)
	}
	if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "campaigns_done", *outcome); err != nil {
		return nil, err
	}

	// --- Stage 2: Tickets (from lucky_draw_histories) — batch insert ---
	userMap, err := s.loadUserMap(ctx, mc.TenantID)
	if err != nil {
		return nil, fmt.Errorf("load user map: %w", err)
	}

	// Load campaign map: V1 ID → V2 UUID
	campaignMap := map[int64]string{}
	cmRows, err := s.db.Query(ctx,
		`SELECT source_id, target_id FROM migration_entity_maps
		 WHERE tenant_id = $1 AND entity_type = $2 AND source_system = 'v1'`,
		mc.TenantID, EntityTypeLDCampaign)
	if err != nil {
		return nil, fmt.Errorf("load campaign map: %w", err)
	}
	defer cmRows.Close()
	for cmRows.Next() {
		var srcID, tgtID string
		if err := cmRows.Scan(&srcID, &tgtID); err == nil {
			if id, e := strconv.ParseInt(srcID, 10, 64); e == nil {
				campaignMap[id] = tgtID
			}
		}
	}

	// Load existing tickets for duplicate check
	existingTickets := map[int64]bool{}
	etRows, err := s.db.Query(ctx,
		`SELECT source_id FROM migration_entity_maps
		 WHERE tenant_id = $1 AND entity_type = $2 AND source_system = 'v1'`,
		mc.TenantID, EntityTypeLDTicket)
	if err == nil {
		defer etRows.Close()
		for etRows.Next() {
			var srcID string
			if err := etRows.Scan(&srcID); err == nil {
				if id, e := strconv.ParseInt(srcID, 10, 64); e == nil {
					existingTickets[id] = true
				}
			}
		}
	}

	histRows, err := mc.Source.pool.Query(ctx,
		`SELECT id, lucky_draw_id, user_id, ticket, point, created_at
		 FROM lucky_draw_histories
		 WHERE deleted_at IS NULL
		 ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("query v1 lucky_draw_histories: %w", err)
	}
	defer histRows.Close()

	const batchSize = 500
	type ticketRow struct {
		targetID   string
		campaignID string
		userID     string
		ticketNum  string
		pointsSpent int32
		createdAt  *time.Time
		v1ID       int64
	}
	batch := make([]ticketRow, 0, batchSize)
	var ticketsInserted, ticketsSkipped int64

	flushTickets := func() error {
		if len(batch) == 0 {
			return nil
		}
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return err
		}
		for _, r := range batch {
			_, err = tx.Exec(ctx,
				`INSERT INTO lucky_draw_tickets (id, campaign_id, user_id, ticket_number, points_spent, created_at)
				 VALUES ($1, $2, $3, $4, $5, COALESCE($6, NOW()))
				 ON CONFLICT DO NOTHING`,
				r.targetID, r.campaignID, r.userID, r.ticketNum, r.pointsSpent, r.createdAt,
			)
			if err != nil {
				tx.Rollback(ctx)
				return fmt.Errorf("insert ticket v1=%d: %w", r.v1ID, err)
			}
		}
		for _, r := range batch {
			var jobIDParam any = mc.JobID
			_, err = tx.Exec(ctx,
				`INSERT INTO migration_entity_maps (tenant_id, entity_type, source_system, source_id, target_id, latest_job_id, metadata, created_at, updated_at)
				 VALUES ($1, $2, 'v1', $3, $4, $5, '{}'::jsonb, NOW(), NOW())
				 ON CONFLICT (tenant_id, entity_type, source_system, source_id) DO NOTHING`,
				mc.TenantID, EntityTypeLDTicket, strconv.FormatInt(r.v1ID, 10), r.targetID, jobIDParam,
			)
			if err != nil {
				tx.Rollback(ctx)
				return fmt.Errorf("insert ticket map v1=%d: %w", r.v1ID, err)
			}
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		ticketsInserted += int64(len(batch))
		outcome.Success += int64(len(batch))
		batch = batch[:0]
		return nil
	}

	for histRows.Next() {
		var (
			v1ID, v1CampaignID int64
			v1UserID           *int64
			ticket, pointsUsed *int32
			createdAt          *time.Time
		)
		if err := histRows.Scan(&v1ID, &v1CampaignID, &v1UserID, &ticket, &pointsUsed, &createdAt); err != nil {
			outcome.Failed++
			outcome.Processed++
			continue
		}
		outcome.Processed++

		if existingTickets[v1ID] {
			ticketsSkipped++
			continue
		}
		if v1UserID == nil {
			ticketsSkipped++
			continue
		}
		targetUserID, ok := userMap[*v1UserID]
		if !ok {
			ticketsSkipped++
			continue
		}
		targetCampaignID, ok := campaignMap[v1CampaignID]
		if !ok {
			ticketsSkipped++
			continue
		}

		// Generate ticket number
		ticketNum := fmt.Sprintf("T-%010d", v1ID%10000000000)

		batch = append(batch, ticketRow{
			targetID:    newUUID(),
			campaignID:  targetCampaignID,
			userID:      targetUserID,
			ticketNum:   ticketNum,
			pointsSpent: int32(intOrDefault(pointsUsed, 0)),
			createdAt:   createdAt,
			v1ID:        v1ID,
		})

		if len(batch) >= batchSize {
			if err := flushTickets(); err != nil {
				s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeLDTicket, "batch", err.Error(), nil)
				outcome.Failed += int64(len(batch))
				batch = batch[:0]
			}
		}
		if outcome.Processed%5000 == 0 {
			if err := s.ensureNotCancelled(ctx, mc.JobID); err != nil {
				return nil, err
			}
			if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "migrating_tickets", *outcome); err != nil {
				return nil, err
			}
		}
	}
	if len(batch) > 0 {
		if err := flushTickets(); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeLDTicket, "batch_final", err.Error(), nil)
			outcome.Failed += int64(len(batch))
		}
	}
	if err := histRows.Err(); err != nil {
		return nil, fmt.Errorf("iterating v1 lucky_draw_histories: %w", err)
	}

	outcome.Summary["campaigns_total"] = campaignCount
	outcome.Summary["campaigns_inserted"] = campaignsInserted
	outcome.Summary["campaigns_skipped"] = campaignsSkipped
	outcome.Summary["tickets_total"] = historyCount
	outcome.Summary["tickets_inserted"] = ticketsInserted
	outcome.Summary["tickets_skipped"] = ticketsSkipped
	return outcome, nil
}

// loadExistingScanMap loads all existing scan entity maps into memory for fast duplicate check
func (s *Service) loadExistingScanMap(ctx context.Context, tenantID string) (map[int64]bool, error) {
	rows, err := s.db.Query(ctx,
		`SELECT source_id FROM migration_entity_maps
		 WHERE tenant_id = $1 AND entity_type = $2 AND source_system = 'v1'`,
		tenantID, EntityTypeScan,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[int64]bool{}
	for rows.Next() {
		var sourceID string
		if err := rows.Scan(&sourceID); err != nil {
			return nil, err
		}
		if id, err := strconv.ParseInt(sourceID, 10, 64); err == nil {
			result[id] = true
		}
	}
	return result, nil
}

func (s *Service) runRedeemHistory(ctx context.Context, mc moduleContext) (*moduleOutcome, error) {
	outcome := &moduleOutcome{Warnings: []string{}, Summary: map[string]any{}}
	var total int64
	_ = mc.Source.pool.QueryRow(ctx, `SELECT COUNT(*) FROM reward_redeem_histories WHERE deleted_at IS NULL`).Scan(&total)
	outcome.Estimated = total
	if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "planning", *outcome); err != nil {
		return nil, err
	}
	if mc.Mode == JobModeDryRun {
		outcome.Processed = total
		outcome.Summary["redeem_history_to_process"] = total
		outcome.Summary["mode"] = "historical_snapshot"
		return outcome, nil
	}

	userMap, err := s.loadUserMap(ctx, mc.TenantID)
	if err != nil {
		return nil, err
	}
	addressMap, err := s.loadEntityMap(ctx, mc.TenantID, EntityTypeAddress)
	if err != nil {
		return nil, err
	}
	rewardMap, err := s.loadEntityMap(ctx, mc.TenantID, EntityTypeReward)
	if err != nil {
		return nil, err
	}

	rows, err := mc.Source.pool.Query(ctx,
		`SELECT id, reward_id, user_id, recipient_address_id, status, coupon_code, goods_tracking_code, created_at, updated_at
		 FROM reward_redeem_histories
		 WHERE deleted_at IS NULL
		 ORDER BY id`,
	)
	if err != nil {
		return nil, fmt.Errorf("query v1 redeem history: %w", err)
	}
	defer rows.Close()

	var inserted, skipped int64
	for rows.Next() {
		if err := s.ensureNotCancelled(ctx, mc.JobID); err != nil {
			return nil, err
		}
		var (
			v1ID, v1RewardID, v1UserID int64
			v1AddressID                *int64
			statusText, couponCode, trackingCode *string
			createdAt, updatedAt       *time.Time
		)
		if err := rows.Scan(&v1ID, &v1RewardID, &v1UserID, &v1AddressID, &statusText, &couponCode, &trackingCode, &createdAt, &updatedAt); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeRedeem, strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		if _, found, err := s.getEntityMap(ctx, mc.TenantID, EntityTypeRedeem, strconv.FormatInt(v1ID, 10)); err == nil && found {
			skipped++
			outcome.Processed++
			continue
		}

		userID, okUser := userMap[v1UserID]
		rewardID, okReward := rewardMap[strconv.FormatInt(v1RewardID, 10)]
		if !okUser || !okReward {
			skipped++
			outcome.Processed++
			outcome.Warnings = appendLimited(outcome.Warnings, fmt.Sprintf("redeem %d skipped because user or reward mapping is missing", v1ID))
			continue
		}

		var addressID *string
		if v1AddressID != nil {
			if mapped, ok := addressMap[strconv.FormatInt(*v1AddressID, 10)]; ok {
				addressID = &mapped
			}
		}
		redeemID := newUUID()
		status := mapRedeemStatus(statusText)
		deliveryType, fulfillmentStatus, confirmedAt, shippedAt, deliveredAt := deriveRedeemLifecycle(status, stringOrEmpty(trackingCode), createdAt)
		expiresAt := time.Now().Add(10 * time.Minute)
		if createdAt != nil {
			expiresAt = createdAt.Add(10 * time.Minute)
		}

		tx, err := s.db.Begin(ctx)
		if err != nil {
			return nil, err
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO reward_reservations (
				id, user_id, reward_id, tenant_id, status, idempotency_key, expires_at, confirmed_at,
				address_id, tracking_number, shipping_note, coupon_code, created_at, updated_at,
				delivery_type, recipient_name, recipient_phone, shipping_address_line1, shipping_address_line2,
				shipping_district, shipping_sub_district, shipping_province, shipping_postal_code,
				fulfillment_status, shipped_at, delivered_at
			) VALUES (
				$1, $2, $3, $4, $5, NULL, $6, $7,
				$8, $9, NULL, $10, COALESCE($11, NOW()), $12,
				$13, NULL, NULL, NULL, NULL,
				NULL, NULL, NULL, NULL,
				$14, $15, $16
			)`,
			redeemID, userID, rewardID, mc.TenantID, status, expiresAt, confirmedAt,
			addressID, nullableString(trackingCode), nullableString(couponCode), createdAt, updatedAt,
			deliveryType, fulfillmentStatus, shippedAt, deliveredAt,
		)
		if err == nil {
			err = s.upsertEntityMap(ctx, tx, mc.TenantID, EntityTypeRedeem, strconv.FormatInt(v1ID, 10), redeemID, mc.JobID, map[string]any{
				"v1_reward_id": v1RewardID,
				"v1_user_id":   v1UserID,
			})
		}
		if err != nil {
			tx.Rollback(ctx)
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeRedeem, strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		inserted++
		outcome.Success++
		outcome.Processed++
		if outcome.Processed%100 == 0 {
			if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "migrating_redeem_history", *outcome); err != nil {
				return nil, err
			}
		}
	}

	outcome.Summary["redeem_history_total"] = total
	outcome.Summary["redeem_history_inserted"] = inserted
	outcome.Summary["redeem_history_skipped"] = skipped
	outcome.Summary["mode"] = "historical_snapshot"
	return outcome, nil
}

func (s *Service) upsertCustomerRow(
	ctx context.Context,
	mc moduleContext,
	v1ID int64,
	name, surname, email, phone, lineUserID *string,
	birthDate *time.Time,
	gender, profileImage, province, occupation *string,
	flag, status *int32,
	createdAt, updatedAt *time.Time,
	placeholderEmails *int64,
) (bool, error) {
	if exists, err := s.customerExists(ctx, mc.TenantID, v1ID); err == nil && exists {
		return false, nil
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)

	firstName := truncString(strings.TrimSpace(stringOrEmpty(name)), 100)
	lastName := truncString(strings.TrimSpace(stringOrEmpty(surname)), 100)
	displayName := truncString(strings.TrimSpace(strings.TrimSpace(firstName+" "+lastName)), 255)
	if displayName == "" {
		displayName = fmt.Sprintf("User %d", v1ID)
	}
	finalEmail := normalizeEmail(email)
	usePlaceholder := finalEmail == ""
	if usePlaceholder {
		finalEmail = fmt.Sprintf("v1_%d@migrated.saversure.local", v1ID)
	}

	userID := newUUID()
	insertUser := func(emailAddr string) error {
		_, err := tx.Exec(ctx,
			`INSERT INTO users (
				id, tenant_id, email, phone, password_hash, display_name, status,
				created_at, updated_at, first_name, last_name, birth_date, gender,
				avatar_url, line_user_id, province, occupation, customer_flag, v1_user_id, profile_completed
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7,
				COALESCE($8, NOW()), $9, NULLIF($10, ''), NULLIF($11, ''), $12::date, $13,
				$14, $15, $16, $17, $18, $19, $20
			)
			ON CONFLICT (v1_user_id) WHERE v1_user_id IS NOT NULL DO NOTHING`,
			userID, mc.TenantID, emailAddr, nullableString(phone), placeholderHash, displayName, mapCustomerStatus(status),
			createdAt, updatedAt, firstName, lastName, birthDate, mapGender(gender),
			nullableString(profileImage), nullableString(lineUserID), nullableString(province), nullableString(occupation),
			mapCustomerFlag(flag), v1ID, firstName != "" && stringOrEmpty(phone) != "",
		)
		return err
	}

	if err := insertUser(finalEmail); err != nil {
		if !usePlaceholder {
			finalEmail = fmt.Sprintf("v1_%d@migrated.saversure.local", v1ID)
			*placeholderEmails = *placeholderEmails + 1
			if retryErr := insertUser(finalEmail); retryErr != nil {
				return false, retryErr
			}
		} else {
			return false, err
		}
	} else if usePlaceholder {
		*placeholderEmails = *placeholderEmails + 1
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO user_roles (id, user_id, tenant_id, role, created_at)
		 VALUES ($1, $2, $3, 'api_client', NOW())
		 ON CONFLICT (user_id, tenant_id) DO NOTHING`,
		newUUID(), userID, mc.TenantID,
	)
	if err != nil {
		return false, err
	}
	return true, tx.Commit(ctx)
}

func (s *Service) customerExists(ctx context.Context, tenantID string, v1ID int64) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id = $1 AND v1_user_id = $2)`,
		tenantID, v1ID,
	).Scan(&exists)
	return exists, err
}

func (s *Service) loadUserMap(ctx context.Context, tenantID string) (map[int64]string, error) {
	rows, err := s.db.Query(ctx,
		`SELECT v1_user_id, id
		 FROM users
		 WHERE tenant_id = $1 AND v1_user_id IS NOT NULL`,
		tenantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[int64]string{}
	for rows.Next() {
		var sourceID int64
		var targetID string
		if err := rows.Scan(&sourceID, &targetID); err != nil {
			return nil, err
		}
		result[sourceID] = targetID
	}
	return result, nil
}

func (s *Service) loadEntityMap(ctx context.Context, tenantID, entityType string) (map[string]string, error) {
	rows, err := s.db.Query(ctx,
		`SELECT source_id, target_id
		 FROM migration_entity_maps
		 WHERE tenant_id = $1 AND entity_type = $2 AND source_system = 'v1'`,
		tenantID, entityType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := map[string]string{}
	for rows.Next() {
		var sourceID, targetID string
		if err := rows.Scan(&sourceID, &targetID); err != nil {
			return nil, err
		}
		items[sourceID] = targetID
	}
	return items, nil
}

func (s *Service) importCouponPoolForReward(ctx context.Context, tx pgx.Tx, mc moduleContext, v1RewardID int64, rewardID string) (int64, error) {
	rows, err := mc.Source.pool.Query(ctx,
		`SELECT code, COALESCE(is_used, false), COALESCE(is_collected, false)
		 FROM coupons
		 WHERE deleted_at IS NULL AND privilege_id = $1 AND code IS NOT NULL AND code != ''`,
		v1RewardID,
	)
	if err != nil {
		return 0, nil
	}
	defer rows.Close()

	var imported int64
	for rows.Next() {
		var code string
		var isUsed, isCollected bool
		if err := rows.Scan(&code, &isUsed, &isCollected); err != nil {
			return imported, err
		}
		if isUsed || isCollected || strings.TrimSpace(code) == "" {
			continue
		}
		_, err := tx.Exec(ctx,
			`INSERT INTO coupon_codes (id, reward_id, tenant_id, code, created_at)
			 VALUES ($1, $2, $3, $4, NOW())
			 ON CONFLICT (reward_id, code) DO NOTHING`,
			newUUID(), rewardID, mc.TenantID, strings.TrimSpace(code),
		)
		if err != nil {
			return imported, err
		}
		imported++
	}
	return imported, nil
}

func excludeLegacyProduct(v1ID int64, sku, nameTH *string) bool {
	if v1ID == 66 || v1ID == 67 || v1ID == 68 || v1ID == 69 || v1ID == 70 || v1ID == 150 {
		return true
	}
	combined := strings.ToLower(stringOrEmpty(sku) + " " + stringOrEmpty(nameTH))
	ticketKeywords := []string{
		"บัตร", "ticket", "premiere", "vending machine", "booth", "one day trip", "final episode", "ดาเอ็นโดรฟิน",
	}
	for _, keyword := range ticketKeywords {
		if strings.Contains(combined, strings.ToLower(keyword)) {
			return true
		}
	}
	return false
}

func resolveProductName(nameTH, nameEN, nameSKU *string, v1ID int64) string {
	for _, item := range []*string{nameTH, nameEN, nameSKU} {
		value := strings.TrimSpace(stringOrEmpty(item))
		if value != "" {
			return truncString(value, 200)
		}
	}
	return fmt.Sprintf("Product %d", v1ID)
}

func buildProductDescription(nameEN, nameSKU, detail *string, price, extraPoints, diamondPoint *int32) string {
	var parts []string
	if value := strings.TrimSpace(stringOrEmpty(nameEN)); value != "" {
		parts = append(parts, "EN: "+value)
	}
	if value := strings.TrimSpace(stringOrEmpty(nameSKU)); value != "" {
		parts = append(parts, "SKU Name: "+value)
	}
	if value := strings.TrimSpace(stringOrEmpty(detail)); value != "" {
		parts = append(parts, value)
	}
	if price != nil && *price > 0 {
		parts = append(parts, fmt.Sprintf("ราคา: %d บาท", *price))
	}
	if extraPoints != nil && *extraPoints > 0 {
		parts = append(parts, fmt.Sprintf("Extra points: %d", *extraPoints))
	}
	if diamondPoint != nil && *diamondPoint > 0 {
		parts = append(parts, fmt.Sprintf("Diamond points: %d", *diamondPoint))
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}

func mapRewardShape(pointCost, diamondCost, rewardType *int32, goodsJSON, couponJSON, partnerCouponJSON *string) (string, int, string, string, []string) {
	warnings := []string{}
	currency := "point"
	cost := maxInt(intOrDefault(pointCost, 0), 1)
	if intOrDefault(pointCost, 0) <= 0 && intOrDefault(diamondCost, 0) > 0 {
		currency = "diamond"
		cost = maxInt(intOrDefault(diamondCost, 0), 1)
	}
	if intOrDefault(pointCost, 0) > 0 && intOrDefault(diamondCost, 0) > 0 {
		warnings = append(warnings, "พบ reward ที่มีทั้ง point และ diamond_point ระบบจะใช้ point_cost เป็นหลัก")
	}

	deliveryType := "none"
	rewardKind := "general"
	if looksLikeJSONPayload(goodsJSON) {
		deliveryType = "shipping"
		rewardKind = "goods"
	}
	if looksLikeJSONPayload(couponJSON) || looksLikeJSONPayload(partnerCouponJSON) {
		deliveryType = "coupon"
		rewardKind = "coupon"
	}
	if rewardType != nil {
		switch *rewardType {
		case 2:
			rewardKind = "coupon"
			deliveryType = "coupon"
		case 3:
			rewardKind = "digital"
			deliveryType = "digital"
		}
	}
	return currency, cost, rewardKind, deliveryType, warnings
}

func calcRewardInventory(quota, quotaBalance *int32) (int, int) {
	total := intOrDefault(quota, 0)
	available := intOrDefault(quotaBalance, total)
	if total <= 0 {
		total = maxInt(available, 1)
	}
	if available < 0 {
		available = 0
	}
	if available > total {
		available = total
	}
	return total, maxInt(total-available, 0)
}

func mapRewardStatus(statusText *string) string {
	value := strings.ToLower(strings.TrimSpace(stringOrEmpty(statusText)))
	switch value {
	case "draft", "inactive", "archived":
		return "draft"
	case "disabled", "hide":
		return "inactive"
	default:
		return "active"
	}
}

func mapScanStatus(status *int32) string {
	switch intOrDefault(status, 1) {
	case 0:
		return "duplicate_other"
	default:
		return "success"
	}
}

func mapRedeemStatus(statusText *string) string {
	value := strings.ToLower(strings.TrimSpace(stringOrEmpty(statusText)))
	switch value {
	case "pending", "wait", "waiting":
		return "PENDING"
	case "shipping":
		return "SHIPPING"
	case "shipped", "sent":
		return "SHIPPED"
	case "completed", "success", "done", "used":
		return "COMPLETED"
	case "expired":
		return "EXPIRED"
	case "cancelled", "canceled", "rejected":
		return "CANCELLED"
	default:
		return "CONFIRMED"
	}
}

func deriveRedeemLifecycle(status, trackingCode string, createdAt *time.Time) (string, string, *time.Time, *time.Time, *time.Time) {
	deliveryType := "none"
	if strings.TrimSpace(trackingCode) != "" {
		deliveryType = "shipping"
	}
	confirmedAt := createdAt
	var shippedAt, deliveredAt *time.Time
	fulfillmentStatus := "pending"
	switch status {
	case "SHIPPING":
		fulfillmentStatus = "shipping"
	case "SHIPPED":
		fulfillmentStatus = "shipped"
		shippedAt = createdAt
	case "COMPLETED":
		fulfillmentStatus = "delivered"
		shippedAt = createdAt
		deliveredAt = createdAt
	case "CANCELLED", "EXPIRED":
		fulfillmentStatus = "cancelled"
	default:
		fulfillmentStatus = "pending"
	}
	return deliveryType, fulfillmentStatus, confirmedAt, shippedAt, deliveredAt
}

func mapCustomerStatus(status *int32) string {
	switch intOrDefault(status, 0) {
	case 3:
		return "deleted"
	default:
		return "active"
	}
}

func mapCustomerFlag(flag *int32) string {
	switch intOrDefault(flag, 1) {
	case 0:
		return "white"
	case 91:
		return "yellow"
	case 92:
		return "orange"
	case 93:
		return "black"
	case 201:
		return "gray"
	default:
		return "green"
	}
}

func mapGender(gender *string) *string {
	switch strings.TrimSpace(stringOrEmpty(gender)) {
	case "หญิง":
		value := "female"
		return &value
	case "ชาย":
		value := "male"
		return &value
	case "LGBTQ":
		value := "other"
		return &value
	default:
		return nil
	}
}

func normalizeEmail(email *string) string {
	value := strings.ToLower(strings.TrimSpace(stringOrEmpty(email)))
	if value == "" || len(value) > 250 {
		return ""
	}
	return value
}

func cleanSKU(sku *string) *string {
	value := strings.TrimSpace(stringOrEmpty(sku))
	if value == "" || value == "-" {
		return nil
	}
	if len(value) > 100 {
		value = value[:100]
	}
	return &value
}

func firstNonEmpty(items []string) *string {
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			return &trimmed
		}
	}
	return nil
}

func looksLikeJSONPayload(raw *string) bool {
	value := strings.TrimSpace(stringOrEmpty(raw))
	return value != "" && value != "{}" && value != "null"
}

func stringOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func stringOrDefault(value *string, def string) string {
	if value == nil || *value == "" {
		return def
	}
	return *value
}

func truncOrDefault(value *string, max int, fallback string) string {
	item := truncString(strings.TrimSpace(stringOrEmpty(value)), max)
	if item == "" {
		return fallback
	}
	return item
}

func truncString(value string, max int) string {
	if len(value) > max {
		return value[:max]
	}
	return value
}

func nullableString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func nullableStringValue(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func nullablePostal(value *int64) *string {
	if value == nil {
		return nil
	}
	postal := strconv.FormatInt(*value, 10)
	if len(postal) > 10 {
		postal = postal[:10]
	}
	return &postal
}

func boolOrDefault(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}

func intOrDefault(value *int32, fallback int) int {
	if value == nil {
		return fallback
	}
	return int(*value)
}

func maxInt(a, b int) int {
	return int(math.Max(float64(a), float64(b)))
}

func appendLimited(items []string, value string) []string {
	if len(items) >= 50 {
		return items
	}
	return append(items, value)
}
