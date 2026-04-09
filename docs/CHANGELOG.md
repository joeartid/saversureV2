# Changelog

บันทึกการเปลี่ยนแปลงสำคัญของ saversureV2 — เรียงจากใหม่ → เก่า

รูปแบบอ้างอิง [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

## หมายเหตุสำหรับทีม dev

ไฟล์นี้บันทึก**เฉพาะ change ที่ส่งผลต่อ architecture, conventions, หรือ data shape**
— Features ปกติ (Phase 1-9) ดูที่ git log + commit messages แทน

---

## [Unreleased]

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
