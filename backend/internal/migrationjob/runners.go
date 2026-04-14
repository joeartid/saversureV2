package migrationjob

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

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

	var usersInserted, usersSkipped, placeholderEmails int64
	var migratedUserCount int64
	_ = s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND v1_user_id IS NOT NULL`,
		mc.TenantID,
	).Scan(&migratedUserCount)
	if migratedUserCount >= userCount && userCount > 0 {
		usersSkipped = userCount
		outcome.Processed = userCount
		outcome.Success = userCount
		if err := s.updateModuleProgress(ctx, mc.JobID, mc.ModuleName, "migrating_users", *outcome); err != nil {
			return nil, fmt.Errorf("progress users skip-fast-path: %w", err)
		}
	} else {
		rows, err := mc.Source.pool.Query(ctx,
			`SELECT id, textsend(name), textsend(surname), textsend(email), textsend(telephone), textsend(line_user_id), birth_date, textsend(gender), textsend(profile_image),
			        textsend(province), textsend(occupation), flag, status, created_at, updated_at
			 FROM users
			 WHERE deleted_at IS NULL
			 ORDER BY id`,
		)
		if err != nil {
			return nil, fmt.Errorf("query v1 users: %w", err)
		}
		defer rows.Close()

		var lastUserID int64
		batchCounter := 0
		for rows.Next() {
			if err := s.ensureNotCancelled(ctx, mc.JobID); err != nil {
				return nil, err
			}
			var (
				v1ID                                       int64
				nameRaw, surnameRaw, emailRaw              []byte
				phoneRaw, lineUserIDRaw                    []byte
				genderRaw, profileImageRaw                 []byte
				provinceRaw, occupationRaw                 []byte
				flag, status                               *int32
				birthDate, createdAt, updatedAt            *time.Time
			)
			if err := rows.Scan(&v1ID, &nameRaw, &surnameRaw, &emailRaw, &phoneRaw, &lineUserIDRaw, &birthDate, &genderRaw, &profileImageRaw, &provinceRaw, &occupationRaw, &flag, &status, &createdAt, &updatedAt); err != nil {
				s.appendError(ctx, mc.JobID, mc.ModuleName, "user", strconv.FormatInt(v1ID, 10), err.Error(), nil)
				outcome.Failed++
				outcome.Processed++
				continue
			}
			lastUserID = v1ID
			name := legacyBytesToString(nameRaw)
			surname := legacyBytesToString(surnameRaw)
			email := legacyBytesToString(emailRaw)
			phone := legacyBytesToString(phoneRaw)
			lineUserID := legacyBytesToString(lineUserIDRaw)
			gender := legacyBytesToString(genderRaw)
			profileImage := legacyBytesToString(profileImageRaw)
			province := legacyBytesToString(provinceRaw)
			occupation := legacyBytesToString(occupationRaw)

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
		if err := rows.Err(); err != nil {
			return nil, fmt.Errorf("iterate v1 users after source id %d: %w", lastUserID, err)
		}
	}

	userMap, err := s.loadUserMap(ctx, mc.TenantID)
	if err != nil {
		return nil, fmt.Errorf("load user map after users: %w", err)
	}

	addrRows, err := mc.Source.pool.Query(ctx,
		`SELECT id, user_id, textsend(recipient_name), textsend(recipient_address), textsend(sub_district), textsend(district),
		        textsend(province), postcode, textsend(telephone), is_default, created_at, updated_at
		 FROM user_address
		 WHERE deleted_at IS NULL
		 ORDER BY id`,
	)
	if err != nil {
		return nil, fmt.Errorf("query v1 addresses: %w", err)
	}
	defer addrRows.Close()

	var addressesInserted, addressesSkipped int64
	var lastAddressID int64
	for addrRows.Next() {
		if err := s.ensureNotCancelled(ctx, mc.JobID); err != nil {
			return nil, err
		}
		var (
			v1AddressID, v1UserID                                  int64
			recipientNameRaw, recipientAddressRaw                  []byte
			subDistrictRaw, districtRaw                            []byte
			provinceRaw, phoneRaw                                  []byte
			postalCode                                             *int64
			isDefault                                              *bool
			createdAt, updatedAt                                   *time.Time
		)
		if err := addrRows.Scan(&v1AddressID, &v1UserID, &recipientNameRaw, &recipientAddressRaw, &subDistrictRaw, &districtRaw, &provinceRaw, &postalCode, &phoneRaw, &isDefault, &createdAt, &updatedAt); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeAddress, strconv.FormatInt(v1AddressID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		lastAddressID = v1AddressID
		recipientName := legacyBytesToString(recipientNameRaw)
		recipientAddress := legacyBytesToString(recipientAddressRaw)
		subDistrict := legacyBytesToString(subDistrictRaw)
		district := legacyBytesToString(districtRaw)
		province := legacyBytesToString(provinceRaw)
		phone := legacyBytesToString(phoneRaw)
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
		if existingAddressID, found, err := s.findMatchingAddress(ctx, mc.TenantID, targetUserID, recipientName, recipientAddress, district, subDistrict, province, postalCode, phone); err == nil && found {
			tx, err := s.db.Begin(ctx)
			if err != nil {
				return nil, fmt.Errorf("begin tx for matched address %d: %w", v1AddressID, err)
			}
			err = s.upsertEntityMap(ctx, tx, mc.TenantID, EntityTypeAddress, strconv.FormatInt(v1AddressID, 10), existingAddressID, mc.JobID, map[string]any{
				"v1_user_id": v1UserID,
				"matched":    "existing_address",
			})
			if err != nil {
				tx.Rollback(ctx)
				return nil, fmt.Errorf("upsert entity map for matched address %d: %w", v1AddressID, err)
			}
			if err := tx.Commit(ctx); err != nil {
				return nil, fmt.Errorf("commit matched address %d: %w", v1AddressID, err)
			}
			addressesSkipped++
			outcome.Success++
			outcome.Processed++
			continue
		} else if err != nil {
			return nil, fmt.Errorf("find matching address %d: %w", v1AddressID, err)
		}

		addressID := newUUID()
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return nil, fmt.Errorf("begin tx for address %d: %w", v1AddressID, err)
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
			return nil, fmt.Errorf("commit address %d: %w", v1AddressID, err)
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
	if err := addrRows.Err(); err != nil {
		return nil, fmt.Errorf("iterate v1 addresses after source id %d: %w", lastAddressID, err)
	}

	existingPointRefs := map[string]bool{}
	pointRows, err := s.db.Query(ctx,
		`SELECT reference_id
		 FROM point_ledger
		 WHERE tenant_id = $1 AND reference_type = 'v1_migration'`,
		mc.TenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("query existing point refs: %w", err)
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
	var lastPointUserID int64
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
		lastPointUserID = v1UserID
		targetUserID, ok := userMap[v1UserID]
		refID := strconv.FormatInt(v1UserID, 10)
		if !ok || existingPointRefs[refID] {
			pointsSkipped++
			outcome.Processed++
			continue
		}

		tx, err := s.db.Begin(ctx)
		if err != nil {
			return nil, fmt.Errorf("begin tx for point balance %d: %w", v1UserID, err)
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
			return nil, fmt.Errorf("commit point balance %d: %w", v1UserID, err)
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
	if err := srcPointRows.Err(); err != nil {
		return nil, fmt.Errorf("iterate v1 point balances after source user id %d: %w", lastPointUserID, err)
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
		`SELECT id, name_th, name_en, name_sku, sku, points, extra_points, diamond_point, price, detail, images::text, created_at, updated_at
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
			v1ID                                     int64
			nameTH, nameEN, nameSKU, sku, detail     *string
			imagesRaw                                *string
			points, extraPoints, diamondPoint, price *int32
			createdAt, updatedAt                     *time.Time
		)
		if err := rows.Scan(&v1ID, &nameTH, &nameEN, &nameSKU, &sku, &points, &extraPoints, &diamondPoint, &price, &detail, &imagesRaw, &createdAt, &updatedAt); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeProduct, strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
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
		imageURL := firstNonEmpty(parseLegacyTextArray(imagesRaw))

		if exists {
			_, err = tx.Exec(ctx,
				`UPDATE products
				 SET name = $3, sku = $4, description = $5, points_per_scan = $6, point_currency = 'point',
				     image_url = COALESCE(NULLIF($7, ''), image_url),
				     status = 'active', updated_at = COALESCE($8, NOW())
				 WHERE id = $1 AND tenant_id = $2`,
				productID, mc.TenantID, name, skuClean, nullableStringValue(description), pointsPerScan, stringOrEmpty(imageURL), updatedAt,
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
					$1, $2, $3, $4, $5, $6, $7, 'point', 'active', COALESCE($8, NOW()), $9
				)`,
				productID, mc.TenantID, name, skuClean, nullableStringValue(description), imageURL, pointsPerScan, createdAt, updatedAt,
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
		        images::text, type, goods::text, coupon::text, partner_coupon::text, created_at, updated_at
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
			v1ID                                                 int64
			name, description, statusText, goodsJSON, couponJSON *string
			partnerCouponJSON                                    *string
			pointCost, diamondCost, quota, quotaBalance          *int32
			expiresAt, createdAt, updatedAt                      *time.Time
			imagesRaw                                            *string
			rewardType                                           *int32
		)
		if err := rows.Scan(&v1ID, &name, &description, &pointCost, &diamondCost, &quota, &quotaBalance, &statusText, &expiresAt, &imagesRaw, &rewardType, &goodsJSON, &couponJSON, &partnerCouponJSON, &createdAt, &updatedAt); err != nil {
			s.appendError(ctx, mc.JobID, mc.ModuleName, EntityTypeReward, strconv.FormatInt(v1ID, 10), err.Error(), nil)
			outcome.Failed++
			outcome.Processed++
			continue
		}
		images := parseLegacyTextArray(imagesRaw)

		currencyCode, pointValue, rewardKind, deliveryType, rewardWarnings := mapRewardShape(pointCost, diamondCost, rewardType, goodsJSON, couponJSON, partnerCouponJSON)
		outcome.Warnings = append(outcome.Warnings, rewardWarnings...)
		rewardID, exists, err := s.getEntityMap(ctx, mc.TenantID, EntityTypeReward, strconv.FormatInt(v1ID, 10))
		if err != nil {
			return nil, err
		}
		if !exists {
			rewardID, exists, err = s.findExistingRewardByName(ctx, mc.TenantID, name)
			if err != nil {
				return nil, err
			}
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
				err = s.ensureRewardInventory(ctx, tx, rewardID, totalQty, soldQty)
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
				err = s.ensureRewardInventory(ctx, tx, rewardID, totalQty, soldQty)
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
	existingScanSignatures, err := s.loadExistingHistoricalScanSignatures(ctx, mc.TenantID)
	if err != nil {
		return nil, fmt.Errorf("load existing scan signatures: %w", err)
	}

	rows, err := mc.Source.pool.Query(ctx,
		`SELECT
			h.id,
			h.qr_code_id,
			COALESCE(NULLIF(h.qr_code_serial_number, ''), NULLIF(v.qr_code_serial_number, ''), NULLIF(hj.qr_code_serial_number, ''), NULLIF(qn.qrcode, '')),
			h.product_id::bigint,
			COALESCE(NULLIF(v.name_th, ''), NULLIF(p.name_th_marketing, ''), NULLIF(p.name_th, ''), NULLIF(p.name_sku, '')),
			COALESCE(NULLIF(v.sku, ''), NULLIF(p.sku, ''), NULLIF(p.name_sku, '')),
			p.images::text,
			h.user_id,
			h.points,
			h.extra_points,
			h.location::text,
			h.province,
			h.district,
			h.sub_district,
			h.post_code,
			h.created_at,
			h.status,
			h.verify_method,
			ROW_NUMBER() OVER (PARTITION BY h.qr_code_id ORDER BY h.created_at, h.id),
			FIRST_VALUE(h.user_id) OVER (PARTITION BY h.qr_code_id ORDER BY h.created_at, h.id)
		 FROM qrcode_scan_history h
		 LEFT JOIN qrcode_scan_history_view v ON v.id = h.id
		 LEFT JOIN (
			SELECT DISTINCT ON (qr_code_id) qr_code_id, qr_code_serial_number
			FROM qrcode_history_jdent
			WHERE qr_code_id IS NOT NULL
			ORDER BY qr_code_id, id DESC
		 ) hj ON hj.qr_code_id = h.qr_code_id
		 LEFT JOIN qrcodes_new_qrcodes qn ON qn.id = h.qr_code_id
		 LEFT JOIN products p ON p.id = h.product_id
		 ORDER BY h.id`,
	)
	if err != nil {
		return nil, fmt.Errorf("query v1 scan history: %w", err)
	}
	defer rows.Close()

	const batchSize = 500
	type scanRow struct {
		targetID     string
		existing     bool
		userID       string
		points       int32
		latitude     *float64
		longitude    *float64
		province     *string
		district     *string
		subDistrict  *string
		postalCode   *string
		locationJSON *string
		createdAt    *time.Time
		scanType     string
		signature    string
		qrCodeID     *int64
		qrSerial     *string
		productV1ID  *int64
		productName  *string
		productSKU   *string
		productImage *string
		rawStatus    *int32
		verifyMethod *int32
		v1ID         int64
		v1UserID     int64
	}

	var inserted, updated, skipped int64
	batch := make([]scanRow, 0, batchSize)

	flushBatch := func() error {
		if len(batch) == 0 {
			return nil
		}
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return err
		}
		for _, r := range batch {
			if r.existing {
				_, err = tx.Exec(ctx,
					`UPDATE scan_history
					 SET user_id = $3,
					     points_earned = $4,
					     latitude = $5,
					     longitude = $6,
					     province = $7,
					     district = $8,
					     sub_district = $9,
					     postal_code = $10,
					     location_json = $11::jsonb,
					     scanned_at = COALESCE($12, scanned_at),
					     scan_type = $13,
					     legacy_qr_code_id = $14,
					     legacy_qr_code_serial = $15,
					     legacy_product_v1_id = $16,
					     legacy_product_name = $17,
					     legacy_product_sku = $18,
					     legacy_product_image_url = $19,
					     legacy_status = $20,
					     legacy_verify_method = $21
					 WHERE id = $1 AND tenant_id = $2`,
					r.targetID, mc.TenantID, r.userID, r.points,
					r.latitude, r.longitude, r.province, r.district, r.subDistrict, r.postalCode, r.locationJSON,
					r.createdAt, r.scanType, r.qrCodeID, r.qrSerial, r.productV1ID, r.productName, r.productSKU, r.productImage, r.rawStatus, r.verifyMethod,
				)
			} else {
				_, err = tx.Exec(ctx,
					`INSERT INTO scan_history (
						id, tenant_id, user_id, code_id, campaign_id, batch_id, points_earned,
						latitude, longitude, province, district, sub_district, postal_code, location_json,
						scanned_at, scan_type,
						legacy_qr_code_id, legacy_qr_code_serial, legacy_product_v1_id, legacy_product_name,
						legacy_product_sku, legacy_product_image_url, legacy_status, legacy_verify_method
					) VALUES (
						$1, $2, $3, NULL, NULL, NULL, $4,
						$5, $6, $7, $8, $9, $10, $11::jsonb,
						COALESCE($12, NOW()), $13,
						$14, $15, $16, $17,
						$18, $19, $20, $21
					) ON CONFLICT DO NOTHING`,
					r.targetID, mc.TenantID, r.userID, r.points,
					r.latitude, r.longitude, r.province, r.district, r.subDistrict, r.postalCode, r.locationJSON,
					r.createdAt, r.scanType, r.qrCodeID, r.qrSerial, r.productV1ID, r.productName, r.productSKU, r.productImage, r.rawStatus, r.verifyMethod,
				)
			}
			if err != nil {
				tx.Rollback(ctx)
				return fmt.Errorf("insert scan %d: %w", r.v1ID, err)
			}
		}
		for _, r := range batch {
			if r.existing {
				continue
			}
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
		outcome.Success += int64(len(batch))
		for _, r := range batch {
			if r.existing {
				updated++
			} else {
				inserted++
			}
		}
		batch = batch[:0]
		return nil
	}

	for rows.Next() {
		var (
			v1ID         int64
			qrCodeID     *int64
			qrSerial     *string
			productV1ID  *int64
			productName  *string
			productSKU   *string
			imagesRaw    *string
			v1UserID     *int64
			points       *int32
			extra        *int32
			locationRaw  *string
			province     *string
			district     *string
			subDistrict  *string
			postCode     *string
			createdAt    *time.Time
			status       *int32
			verifyMethod *int32
			scanOrdinal  int64
			firstUserID  *int64
		)
		if err := rows.Scan(&v1ID, &qrCodeID, &qrSerial, &productV1ID, &productName, &productSKU, &imagesRaw, &v1UserID, &points, &extra, &locationRaw, &province, &district, &subDistrict, &postCode, &createdAt, &status, &verifyMethod, &scanOrdinal, &firstUserID); err != nil {
			outcome.Failed++
			outcome.Processed++
			continue
		}
		outcome.Processed++

		if v1UserID == nil {
			skipped++
			continue
		}
		targetUserID, ok := userMap[*v1UserID]
		if !ok {
			skipped++
			continue
		}
		latitude, longitude := parseLegacyLocation(locationRaw)
		scanType := deriveHistoricalScanType(status, qrCodeID, v1UserID, firstUserID, scanOrdinal)
		signature := buildHistoricalScanSignature(targetUserID, createdAt, int32(intOrDefault(points, 0)+intOrDefault(extra, 0)), scanType, latitude, longitude, province, district, subDistrict, postCode)
		existingTargetID, alreadyMigrated := existingScans[v1ID]
		if !alreadyMigrated && existingScanSignatures[signature] {
			skipped++
			continue
		}
		productImage := firstNonEmpty(parseLegacyTextArray(imagesRaw))
		targetScanID := newUUID()
		if alreadyMigrated {
			targetScanID = existingTargetID
		}

		batch = append(batch, scanRow{
			targetID:     targetScanID,
			existing:     alreadyMigrated,
			userID:       targetUserID,
			points:       int32(intOrDefault(points, 0) + intOrDefault(extra, 0)),
			latitude:     latitude,
			longitude:    longitude,
			province:     nullableString(province),
			district:     nullableString(district),
			subDistrict:  nullableString(subDistrict),
			postalCode:   nullableString(postCode),
			locationJSON: nullableJSONText(locationRaw),
			createdAt:    createdAt,
			scanType:     scanType,
			signature:    signature,
			qrCodeID:     qrCodeID,
			qrSerial:     nullableString(qrSerial),
			productV1ID:  productV1ID,
			productName:  nullableString(productName),
			productSKU:   nullableString(productSKU),
			productImage: productImage,
			rawStatus:    status,
			verifyMethod: verifyMethod,
			v1ID:         v1ID,
			v1UserID:     *v1UserID,
		})
		if !alreadyMigrated {
			existingScanSignatures[signature] = true
		}

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
	outcome.Summary["scan_history_updated"] = updated
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
			v1ID                             int64
			name, description, imagesRaw     *string
			bannerImage, statusText          *string
			pointCost, ticketCount, totalTix *int32
			startDate, endDate               *time.Time
			createdAt, updatedAt             *time.Time
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
		targetID    string
		campaignID  string
		userID      string
		ticketNum   string
		pointsSpent int32
		createdAt   *time.Time
		v1ID        int64
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

// loadExistingScanMap loads all existing scan entity maps into memory for fast duplicate check/backfill.
func (s *Service) loadExistingScanMap(ctx context.Context, tenantID string) (map[int64]string, error) {
	rows, err := s.db.Query(ctx,
		`SELECT source_id, target_id FROM migration_entity_maps
		 WHERE tenant_id = $1 AND entity_type = $2 AND source_system = 'v1'`,
		tenantID, EntityTypeScan,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[int64]string{}
	for rows.Next() {
		var sourceID, targetID string
		if err := rows.Scan(&sourceID, &targetID); err != nil {
			return nil, err
		}
		if id, err := strconv.ParseInt(sourceID, 10, 64); err == nil {
			result[id] = targetID
		}
	}
	return result, nil
}

func (s *Service) loadExistingHistoricalScanSignatures(ctx context.Context, tenantID string) (map[string]bool, error) {
	var total int64
	if err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM scan_history WHERE tenant_id = $1`, tenantID).Scan(&total); err != nil {
		return nil, err
	}
	result := map[string]bool{}
	if total == 0 || total > 100000 {
		return result, nil
	}
	rows, err := s.db.Query(ctx,
		`SELECT user_id, points_earned, latitude, longitude, province, district, sub_district, postal_code,
		        scanned_at, COALESCE(scan_type, 'success')
		 FROM scan_history
		 WHERE tenant_id = $1`,
		tenantID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var (
			userID      string
			points      int32
			latitude    *float64
			longitude   *float64
			province    *string
			district    *string
			subDistrict *string
			postalCode  *string
			scannedAt   time.Time
			scanType    string
		)
		if err := rows.Scan(&userID, &points, &latitude, &longitude, &province, &district, &subDistrict, &postalCode, &scannedAt, &scanType); err != nil {
			return nil, err
		}
		scannedAtCopy := scannedAt
		result[buildHistoricalScanSignature(userID, &scannedAtCopy, points, scanType, latitude, longitude, province, district, subDistrict, postalCode)] = true
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
			v1ID, v1RewardID, v1UserID           int64
			v1AddressID                          *int64
			statusText, couponCode, trackingCode *string
			createdAt, updatedAt                 *time.Time
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

	insertUserWithRole := func(emailAddr string) error {
		tx, err := s.db.Begin(ctx)
		if err != nil {
			return err
		}
		defer tx.Rollback(ctx)

		userID := newUUID()
		_, err = tx.Exec(ctx,
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
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO user_roles (id, user_id, tenant_id, role, created_at)
			 VALUES ($1, $2, $3, 'api_client', NOW())
			 ON CONFLICT (user_id, tenant_id) DO NOTHING`,
			newUUID(), userID, mc.TenantID,
		)
		if err != nil {
			return err
		}
		return tx.Commit(ctx)
	}

	if err := insertUserWithRole(finalEmail); err != nil {
		if !usePlaceholder {
			placeholderEmail := fmt.Sprintf("v1_%d@migrated.saversure.local", v1ID)
			*placeholderEmails = *placeholderEmails + 1
			if retryErr := insertUserWithRole(placeholderEmail); retryErr != nil {
				return false, fmt.Errorf("insert user failed: %w; placeholder retry failed: %v", err, retryErr)
			}
		} else {
			return false, err
		}
	} else if usePlaceholder {
		*placeholderEmails = *placeholderEmails + 1
	}
	return true, nil
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

func (s *Service) findMatchingAddress(
	ctx context.Context,
	tenantID, userID string,
	recipientName, recipientAddress, district, subDistrict, province *string,
	postalCode *int64,
	phone *string,
) (string, bool, error) {
	var id string
	err := s.db.QueryRow(ctx,
		`SELECT id
		 FROM user_addresses
		 WHERE tenant_id = $1
		   AND user_id = $2
		   AND COALESCE(recipient_name, '') = $3
		   AND COALESCE(phone, '') = $4
		   AND COALESCE(address_line1, '') = $5
		   AND COALESCE(district, '') = $6
		   AND COALESCE(sub_district, '') = $7
		   AND COALESCE(province, '') = $8
		   AND COALESCE(postal_code, '') = $9
		 LIMIT 1`,
		tenantID, userID,
		truncOrDefault(recipientName, 200, "ไม่ระบุ"),
		truncOrDefault(phone, 20, ""),
		stringOrEmpty(recipientAddress),
		stringOrEmpty(district),
		stringOrEmpty(subDistrict),
		stringOrEmpty(province),
		stringOrEmpty(nullablePostal(postalCode)),
	).Scan(&id)
	if err == pgx.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

func (s *Service) findExistingRewardByName(ctx context.Context, tenantID string, name *string) (string, bool, error) {
	normalized := normalizeKey(name)
	if normalized == "" {
		return "", false, nil
	}
	var id string
	err := s.db.QueryRow(ctx,
		`SELECT id
		 FROM rewards
		 WHERE tenant_id = $1
		   AND lower(trim(name)) = $2
		 LIMIT 1`,
		tenantID, normalized,
	).Scan(&id)
	if err == pgx.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return id, true, nil
}

func (s *Service) ensureRewardInventory(ctx context.Context, tx pgx.Tx, rewardID string, totalQty, soldQty int) error {
	_, err := tx.Exec(ctx,
		`INSERT INTO reward_inventory (reward_id, total_qty, reserved_qty, sold_qty, version)
		 VALUES ($1, $2, 0, $3, 1)
		 ON CONFLICT (reward_id) DO UPDATE
		 SET total_qty = EXCLUDED.total_qty,
		     sold_qty = EXCLUDED.sold_qty,
		     reserved_qty = 0,
		     version = reward_inventory.version + 1`,
		rewardID, totalQty, soldQty,
	)
	return err
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

func deriveHistoricalScanType(status *int32, qrCodeID *int64, userID *int64, firstUserID *int64, scanOrdinal int64) string {
	if qrCodeID != nil && userID != nil && firstUserID != nil {
		if scanOrdinal <= 1 {
			return "success"
		}
		if *userID == *firstUserID {
			return "duplicate_self"
		}
		return "duplicate_other"
	}
	return mapScanStatus(status)
}

func mapScanStatus(status *int32) string {
	switch intOrDefault(status, 1) {
	case 4:
		return "duplicate_self"
	case -100, 5, 6:
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
		trimmed := strings.TrimSpace(sanitizeText(item))
		if trimmed != "" {
			return &trimmed
		}
	}
	return nil
}

func nullableJSONText(raw *string) *string {
	value := strings.TrimSpace(stringOrEmpty(raw))
	if value == "" || value == "null" || value == "{}" {
		return nil
	}
	if !json.Valid([]byte(value)) {
		return nil
	}
	return &value
}

func parseLegacyTextArray(raw *string) []string {
	value := strings.TrimSpace(stringOrEmpty(raw))
	if value == "" || value == "{}" {
		return nil
	}
	value = strings.Trim(value, "{}")
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.Trim(strings.TrimSpace(part), "\"")
		if trimmed != "" {
			items = append(items, trimmed)
		}
	}
	return items
}

func looksLikeJSONPayload(raw *string) bool {
	value := strings.TrimSpace(stringOrEmpty(raw))
	return value != "" && value != "{}" && value != "null"
}

func stringOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return sanitizeText(*value)
}

func stringOrDefault(value *string, def string) string {
	if value == nil {
		return def
	}
	sanitized := sanitizeText(*value)
	if sanitized == "" {
		return def
	}
	return sanitized
}

func truncOrDefault(value *string, max int, fallback string) string {
	item := truncString(strings.TrimSpace(stringOrEmpty(value)), max)
	if item == "" {
		return fallback
	}
	return item
}

func truncString(value string, max int) string {
	value = sanitizeText(value)
	if max <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) > max {
		return string(runes[:max])
	}
	return value
}

func nullableString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(sanitizeText(*value))
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func nullableStringValue(value string) *string {
	value = strings.TrimSpace(sanitizeText(value))
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

func parseLegacyLocation(raw *string) (*float64, *float64) {
	type locationPayload struct {
		Latitude  string `json:"latitude"`
		Longitude string `json:"longitude"`
	}
	value := strings.TrimSpace(stringOrEmpty(raw))
	if value == "" || value == "null" || value == "{}" {
		return nil, nil
	}
	var payload locationPayload
	if err := json.Unmarshal([]byte(value), &payload); err != nil {
		return nil, nil
	}
	return parseOptionalFloat(payload.Latitude), parseOptionalFloat(payload.Longitude)
}

func parseOptionalFloat(value string) *float64 {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return nil
	}
	return &parsed
}

func buildHistoricalScanSignature(userID string, createdAt *time.Time, points int32, scanType string, latitude, longitude *float64, province, district, subDistrict, postalCode *string) string {
	created := ""
	if createdAt != nil {
		created = createdAt.UTC().Format(time.RFC3339Nano)
	}
	return strings.Join([]string{
		userID,
		created,
		strconv.FormatInt(int64(points), 10),
		scanType,
		floatSignature(latitude),
		floatSignature(longitude),
		normalizeKey(province),
		normalizeKey(district),
		normalizeKey(subDistrict),
		normalizeKey(postalCode),
	}, "|")
}

func floatSignature(value *float64) string {
	if value == nil {
		return ""
	}
	return strconv.FormatFloat(*value, 'f', 6, 64)
}

func normalizeKey(value *string) string {
	return strings.ToLower(strings.TrimSpace(stringOrEmpty(value)))
}

func sanitizeText(value string) string {
	value = strings.ReplaceAll(value, "\x00", "")
	return strings.ToValidUTF8(value, "")
}

func legacyBytesToString(value []byte) *string {
	if value == nil {
		return nil
	}
	if !utf8.Valid(value) {
		sanitized := strings.ToValidUTF8(string(value), "")
		sanitized = sanitizeText(sanitized)
		if sanitized == "" {
			return nil
		}
		return &sanitized
	}
	text := sanitizeText(string(value))
	if text == "" {
		return nil
	}
	return &text
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
