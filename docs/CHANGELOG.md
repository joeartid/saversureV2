# Changelog

บันทึกการเปลี่ยนแปลงสำคัญของ saversureV2 — เรียงจากใหม่ → เก่า

รูปแบบอ้างอิง [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## หมายเหตุสำหรับทีม dev

ไฟล์นี้บันทึก**เฉพาะ change ที่ส่งผลต่อ architecture, conventions, หรือ data shape**
— Features ปกติ (Phase 1-9) ดูที่ git log + commit messages แทน

---

## [Unreleased]

### Fixed — point_ledger duplicates from V1 migration race condition

**เหตุผล:** จาก audit `point_ledger` พบ **482,359 duplicate rows** ใน entries ที่
`reference_type='v1_migration'` — เกิดจาก race condition ใน migrator code

**Root cause** (verified จาก `migration_jobs` table + `runners.go` source):

1. มี 2 migration jobs รัน customer module **ทับซ้อนกัน** ในวันเดียว:
   - Job `8f2d4cc1` — 2026-04-03 07:37 → 10:56 (3h 19min)
   - Job `f5e798f0` — 2026-04-03 09:28 → 11:01 (1h 33min)
   - **Overlap window: 09:28 → 10:56** (1.5 ชั่วโมง)
2. Migrator code ใน `backend/internal/migrationjob/runners.go` line 214-289 มี
   idempotency check แต่ใช้ **in-memory map** ที่ไม่ thread-safe ระหว่าง jobs
3. Job B โหลด `existingPointRefs` ตอน 09:28 (snapshot ก่อน Job A insert บางส่วน)
4. หลังจากนั้น Job A insert users ใหม่ → Job B's map ไม่รู้ → INSERT ซ้ำ
5. ผลคือ users 482,359 คน (≈64%) ที่อยู่ใน overlap window มี ledger row × 2

**ผลกระทบ (verified จาก `backend/internal/ledger/service.go`):**

- ✅ **Current balance ที่ user เห็น = ถูก** (อ่านจาก `balance_after` column ของ row ล่าสุด)
- ✅ Scan / redeem / lucky_draw / debit operations ใช้ balance_after = ทำงานปกติ
- ❌ `GetBalance().TotalEarned` ใช้ `SUM(credit)` → **แสดงผิด × 2** สำหรับ 482K users
- ❌ Wallet UI "สะสมทั้งหมด" จะแสดงเกินจริง × 2

**Fix (3 layers):**

1. **DB cleanup** — ลบ 482,359 duplicate rows
   ```sql
   ALTER TABLE point_ledger DISABLE TRIGGER trg_ledger_no_update;
   DELETE FROM point_ledger
   WHERE id IN (
     SELECT id FROM (
       SELECT id, ROW_NUMBER() OVER (
         PARTITION BY tenant_id, user_id, reference_id, amount, balance_after, created_at
         ORDER BY id
       ) AS rn
       FROM point_ledger WHERE reference_type='v1_migration'
     ) sub WHERE rn > 1
   );
   ALTER TABLE point_ledger ENABLE TRIGGER trg_ledger_no_update;
   ```

2. **Migration 043** — เพิ่ม partial unique index ป้องกันที่ DB level
   ```sql
   CREATE UNIQUE INDEX idx_point_ledger_v1_migration_unique
       ON point_ledger (tenant_id, user_id, reference_id)
       WHERE reference_type = 'v1_migration';
   ```

3. **Migrator code fix** — ใส่ `ON CONFLICT DO NOTHING` ใน
   `backend/internal/migrationjob/runners.go` (line 270-285)
   ```go
   INSERT INTO point_ledger (...) VALUES (...)
   ON CONFLICT (tenant_id, user_id, reference_id)
   WHERE reference_type = 'v1_migration'
   DO NOTHING
   ```

**Backup:** `backup/point_ledger_before_dedup_20260409.dump`
(78MB, `pg_dump --data-only -F c`)

**Verification หลัง fix:**
- ✅ Duplicate groups: 0 (จาก 482,359)
- ✅ Total v1_migration rows: 758,935 (จาก 1,241,294)
- ✅ Users with `balance_after` ≠ `SUM(credit-debit)`: 0 (จาก 482,359)
- ✅ Users with negative balance: 0
- ✅ `go build ./...` pass
- ✅ Migration 043 registered ใน schema_migrations

**Risk หลังจากนี้:**
- ✅ Migrate v1 ซ้ำได้ปลอดภัย (DB จะ reject duplicate ที่ระดับ index)
- ✅ Run jobs concurrent ได้ (DB constraint ป้องกัน)
- ✅ Manual `INSERT INTO point_ledger ... 'v1_migration' ...` ก็ได้

---

### Removed — Orphan cleanup (หลัง commit `b99ad6f`)

**เหตุผล:** ทีม dev ลบ route pages `/badges`, `/donations`, `/donations/[id]`,
`/history/donations`, `/leaderboard` ใน commit `b99ad6f` พร้อมกับ seed files + BUILT_IN_PAGES
entries ของ admin — แต่เหลือ orphan code/data ค้างอยู่ 15+ จุด

**รอบนี้ clean up ตาม** เพื่อให้ code ตรงกับเจตนาทีม (ทีมยืนยันว่า "ไม่ต้องการลง DB
— function พวกนี้ไม่แสดงใน Page Builder เลยลบโค้ดที่เกี่ยวข้องออกไปก่อน")

#### ลบไฟล์ section components (6 ไฟล์)
- `consumer/src/components/sections/BadgesPageHeader.tsx`
- `consumer/src/components/sections/BadgesGrid.tsx`
- `consumer/src/components/sections/DonationsPageHeader.tsx`
- `consumer/src/components/sections/DonationsHistoryList.tsx`
- `consumer/src/components/sections/LeaderboardPageHeader.tsx`
- `consumer/src/components/sections/LeaderboardList.tsx`

#### ลบ entries ใน `consumer/src/components/sections/registry.ts`
- 6 dynamic imports
- 6 entries ใน `sectionRegistry`
- 6 entries ใน `sectionMeta`

**ก่อน:** 51 sections → **หลัง:** 45 sections

#### ลบ entries ใน `frontend/src/app/(admin)/page-builder/page.tsx`
- 6 entries ใน `sectionTypes`: `badges_page_header`, `badges_grid`, `leaderboard_page_header`,
  `leaderboard_list`, `donations_page_header`, `donations_history_list`

#### ลบ rows ใน DB table `page_configs`
- `DELETE FROM page_configs WHERE page_slug IN ('badges', 'donations', 'leaderboard')`
- ลบ 3 rows (ทั้งหมดเป็น tenant default `00000000-0000-0000-0000-000000000001`)

**Backup:** `backup/page_configs_before_cleanup_20260409.sql`
(มี 3 rows ที่ลบออกอยู่ในนั้น — ถ้าอยาก restore ให้ `psql -f` ไฟล์นี้)

---

### ถ้า feature กลับมา — วิธี restore

ทีมบอกว่าลบ "ก่อน" (อาจกลับมาทำใหม่) — ทุกอย่างกู้คืนได้จาก git:

```bash
# Restore section components จาก commit ก่อน cleanup
git show <cleanup-commit>^ -- consumer/src/components/sections/BadgesGrid.tsx \
  > consumer/src/components/sections/BadgesGrid.tsx

# ทำแบบเดียวกันกับ 5 ไฟล์ที่เหลือ
# จากนั้น restore registry entries + admin sectionTypes
# สุดท้ายสร้าง consumer route page /badges, /donations, /leaderboard ใหม่
```

หรือใช้ `git revert <cleanup-commit>` ก็ได้ (จะ revert ทุกอย่างในครั้งเดียว)

---

## [Phase 9f] — 2026-04-08 (commit `77b7642`)

### Added
- Privacy + Terms pages ผ่าน Page Builder (ใช้ `rich_text` + `page_header_basic` — generic sections)

## [Phase 9e] — 2026-04-08 (commit `fed2b4d`)

### Added
- Settings page sections: `settings_page_header`, `settings_notifications_group`,
  `settings_delete_account_card`, `settings_app_version_footer`

## [Phase 9a-9d] — 2026-04-07..08

### Added
- News, Notifications, Badges, Leaderboard, Donations, Support sections
  (Badges/Leaderboard/Donations ถูกลบในภายหลัง — ดู Unreleased section ด้านบน)

## [Phase 3-8] — 2026-04-05..07

### Added
- Home, Rewards, Missions, Shop, Wallet sections
- Multi-currency context (`useCurrencies`)
- Currency management (public API + admin editor)

## [Phase 2] — 2026-04-08 (commit `79c62d2`)

### Added
- History page sections (HistoryPageHeader, HistoryStatSummary, HistoryTabsNav, HistoryScanList)
- Live Preview panel ใน Page Builder admin (3-column layout + iframe)
- Menu Editor version history (backend: `nav_menu_history` table + handler endpoints;
  frontend: History/Restore UI)
- Drawer.tsx แปลงเป็น API-driven (ดึง `/api/v1/public/nav-menu/drawer` แทน hard-code)
- Migration `042_nav_menu_history.up.sql`
- `docs/prompts.md` — prompt templates สำหรับสั่ง AI agents / dev team
  พัฒนาต่อโดยไม่ hard-code

### Changed
- `nav_menus` table: เพิ่ม `version` column (default 1)
- `NavMenu` struct (Go): เพิ่ม `Version int`
- `MenuItem` struct (Go): เพิ่ม optional `Group string`
- Backend routes: เพิ่ม `GET /nav-menus/:type/versions` + `POST /nav-menus/:type/restore`

## [Phase 1] — 2026-04-07 (commit `872e0ba`)

### Added
- POC: Profile page → Page Builder
- `page_configs` + `page_config_history` tables (migrations 032, 033)
- `PageRenderer` component + section registry pattern
- 6 profile sections (ProfileHeaderCard, ProfileTierProgress, etc.)
