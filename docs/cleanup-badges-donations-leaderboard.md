# Cleanup Log: badges / donations / leaderboard

**Date:** 2026-04-09
**Trigger commit (ทีม dev ลบ route pages):** `b99ad6f push` โดย chadtida-lab
**Cleanup commit (ไฟล์นี้อยู่ใน commit ไหน):** ดูจาก git log หลัง date ด้านบน

---

## 📍 Context — ทำไมต้องมี cleanup รอบนี้

### สิ่งที่เกิดขึ้นก่อนหน้า

1. **Phase 9c+9d** (commit `3384872`) — ทีมเพิ่ม sections สำหรับ
   badges/donations/leaderboard/support เข้า Page Builder ครบทั้งชุด
   (consumer route pages, section components, registry, admin definitions, seed files)

2. **Post-cleanup migration** (ที่ Claude session ก่อน) — seed files ถูกรันลง DB
   ทำให้ `page_configs` มี rows สำหรับ badges/donations/leaderboard 3 rows

3. **commit `b99ad6f`** — ทีม dev ตัดสินใจลบ feature เหล่านี้ออกจาก consumer เพราะ
   "function พวกนี้ไม่ได้แสดงใน Page Builder อยู่แล้ว" แต่ลบ**ไม่ครบชุด**:
   - ✅ ลบแล้ว: consumer route pages (`/badges`, `/donations`, `/leaderboard`, ฯลฯ)
   - ✅ ลบแล้ว: seed files (`seed_badges_page_config.sql`, ฯลฯ)
   - ✅ ลบแล้ว: 3 entries จาก admin `BUILT_IN_PAGES`
   - ❌ **ยังเหลือ**: 6 section component files
   - ❌ **ยังเหลือ**: 6 registry entries (dynamic imports + mapping + meta)
   - ❌ **ยังเหลือ**: 6 sectionTypes definitions ใน admin page-builder
   - ❌ **ยังเหลือ**: 3 DB rows ใน `page_configs`

### ผลที่ตามมาก่อน cleanup

- Registry.ts มี 51 sections ลงทะเบียน แต่ **6 ตัวเข้าไม่ถึง**
  (ไม่มี consumer route, ไม่มี admin tab → ไม่มีทางใช้จริง)
- DB มี orphan rows 3 rows — ไม่มี UI ใดเข้าถึงได้ลบได้ต้องผ่าน SQL ตรง ๆ
- Dev คนถัด ๆ ไปเปิดดู code จะ confuse ว่าทำไมมี component ที่ไม่มีที่ใช้

### การ confirm จาก user

User ถามทีมโดยตรง ทีมยืนยันว่า:
> "ทางทีมไม่ได้ต้องการลง DB นะ แต่ ฟังก์ชั่นที่อยู่ใน page builder
> มันไม่ได้แสดงในส่วนนี้ เลยลบ โค้ดที่เกี่ยวข้องออกไปก่อน"

คำว่า **"ลบโค้ดที่เกี่ยวข้อง"** + **"ไม่ได้ต้องการลง DB"** = ต้องการให้หายทั้งชุด
Cleanup รอบนี้จึงเป็นการ **complete การลบที่ทีมเริ่มไว้**

---

## 🧹 สิ่งที่ cleanup ไป

### 1. Section component files ที่ลบ (6 ไฟล์)

```
consumer/src/components/sections/BadgesPageHeader.tsx
consumer/src/components/sections/BadgesGrid.tsx
consumer/src/components/sections/DonationsPageHeader.tsx
consumer/src/components/sections/DonationsHistoryList.tsx
consumer/src/components/sections/LeaderboardPageHeader.tsx
consumer/src/components/sections/LeaderboardList.tsx
```

**Pre-check ก่อนลบ:** `grep` ทั้ง codebase ยืนยันว่าไม่มีไฟล์อื่น import 6 components นี้
(นอกจาก `registry.ts` ที่รู้อยู่แล้ว)

### 2. `consumer/src/components/sections/registry.ts`

**ลบ dynamic imports:**
```ts
// ลบบรรทัดเหล่านี้ออก:
const BadgesPageHeader = dynamic(() => import("./BadgesPageHeader"));
const BadgesGrid = dynamic(() => import("./BadgesGrid"));
const LeaderboardPageHeader = dynamic(() => import("./LeaderboardPageHeader"));
const LeaderboardList = dynamic(() => import("./LeaderboardList"));
const DonationsPageHeader = dynamic(() => import("./DonationsPageHeader"));
const DonationsHistoryList = dynamic(() => import("./DonationsHistoryList"));
```

**ลบจาก `sectionRegistry` mapping:**
```ts
// ลบ 6 entries:
badges_page_header, badges_grid,
leaderboard_page_header, leaderboard_list,
donations_page_header, donations_history_list
```

**ลบจาก `sectionMeta`:** 6 entries (label/icon/description) ของ type keys ข้างบน

### 3. `frontend/src/app/(admin)/page-builder/page.tsx`

ลบ 6 entries จาก `sectionTypes` object:
- `badges_page_header`
- `badges_grid`
- `leaderboard_page_header`
- `leaderboard_list`
- `donations_page_header`
- `donations_history_list`

### 4. DB: `page_configs` table

```sql
DELETE FROM page_configs
WHERE page_slug IN ('badges', 'donations', 'leaderboard');
-- ผล: DELETE 3
```

**Backup ก่อนลบ:**
```
backup/page_configs_before_cleanup_20260409.sql
```
(ใช้ `pg_dump -t page_configs --data-only --column-inserts` — มี 3 rows ที่ลบอยู่ในนั้น)

---

## ✅ Verification

### Registry counts — ทั้ง 4 ตัวตรงกัน

```
consumer/src/components/sections/registry.ts
  - dynamic() imports:     45  (เดิม 51 − 6)
  - sectionRegistry keys:  45
  - sectionMeta keys:      45

frontend/src/app/(admin)/page-builder/page.tsx
  - sectionTypes keys:     45
```

### Type check ผ่าน

```
cd consumer && npx tsc --noEmit   → ✅ ไม่มี error
cd frontend && npx tsc --noEmit   → ✅ ไม่มี error
```

### DB state

```sql
SELECT page_slug FROM page_configs ORDER BY page_slug;
```
```
 page_slug
---------------
 history
 home
 missions
 news
 notifications
 privacy
 profile
 rewards
 settings
 shop
 support
 terms
 wallet
(13 rows)
```

**13 rows** = ตรงกับ 13 หน้าที่มี consumer route จริง + Page Builder tab จริง

---

## 🔄 ถ้าอยาก Restore — ทำยังไง

### Option A: Git revert (ทั้งชุด)

```bash
git revert <cleanup-commit-hash>
```

จะกลับมาครบทั้ง code + registry + admin definitions
(แต่ **ไม่ restore DB rows** — ต้องรัน backup file ต่อ)

### Option B: Restore ทีละไฟล์จาก git history

```bash
# 1. Restore section component files (6 ไฟล์)
git show <cleanup-commit-hash>^ -- \
  consumer/src/components/sections/BadgesPageHeader.tsx \
  consumer/src/components/sections/BadgesGrid.tsx \
  consumer/src/components/sections/DonationsPageHeader.tsx \
  consumer/src/components/sections/DonationsHistoryList.tsx \
  consumer/src/components/sections/LeaderboardPageHeader.tsx \
  consumer/src/components/sections/LeaderboardList.tsx \
  | git apply

# 2. Restore registry + admin page-builder (3 files — section ที่เกี่ยวข้อง)
# → แก้ไฟล์เอง ดู git diff ของ cleanup commit เป็น reference

# 3. สร้าง consumer route pages ใหม่
#    /consumer/src/app/badges/page.tsx
#    /consumer/src/app/donations/page.tsx
#    /consumer/src/app/leaderboard/page.tsx
# (ใช้ pattern <PageRenderer pageSlug="..." /> เหมือนหน้าอื่น)

# 4. สร้าง seed files ใหม่
#    backend/migrations/seed_badges_page_config.sql
#    backend/migrations/seed_donations_page_config.sql
#    backend/migrations/seed_leaderboard_page_config.sql

# 5. เพิ่ม 3 entries กลับเข้า BUILT_IN_PAGES ใน admin page-builder
```

### Option C: Restore DB rows จาก backup

```bash
docker exec -i saversure-postgres psql -U saversure_app -d saversure \
  < backup/page_configs_before_cleanup_20260409.sql
```

⚠️ ต้องระวัง — backup file `INSERT` rows เข้า `page_configs` → ถ้ามี row
ที่ slug เดียวกันอยู่แล้ว อาจชน unique constraint → แนะนำให้อ่านไฟล์ + เลือก
copy เฉพาะ INSERT statements ของ badges/donations/leaderboard เท่านั้น

---

## 📝 ผลต่อทีมที่ทำงานต่อ

### สิ่งที่**ไม่กระทบ**
- ✅ ระบบ Page Builder หลัก (profile, history, home, ฯลฯ) ทำงานเหมือนเดิม
- ✅ Menu Editor + version history — ไม่กระทบ
- ✅ Drawer API-driven — ไม่กระทบ
- ✅ 45 sections ที่เหลือ — ใช้งานได้ปกติ
- ✅ Auth pages — ไม่แตะเลย

### สิ่งที่ทีม**ต้องรู้**
- 🔔 ถ้ามี plan จะ resurrect feature badges/donations/leaderboard → มี cost ต้องสร้างใหม่
  (ไม่ใช่แค่ revert commit เพราะต้องสร้าง route page ใหม่ + seed ใหม่ + ทดสอบ)
- 🔔 Git history ก่อน cleanup commit ยังมีโค้ดเก่าอยู่ครบ — เอากลับมาได้
- 🔔 Backup SQL ของ DB rows อยู่ใน `backup/page_configs_before_cleanup_20260409.sql`
  ห้ามลบไฟล์นี้จนกว่าจะมั่นใจว่าไม่ต้อง restore
- 🔔 หน้าใหม่ที่จะทำต่อ (ถ้ามี) — อย่าใช้ section types ที่ถูกลบ
  (`badges_*`, `donations_*`, `leaderboard_*`) เพราะไม่มีใน registry แล้ว

### สิ่งที่ทีม**ควรทำต่อ**
- [ ] ตัดสินใจเรื่อง `/badges`, `/donations`, `/leaderboard` จะกลับมาในอนาคตหรือ
      ปิดถาวร → ถ้าปิดถาวร → ลบ backup SQL file ด้วย
- [ ] ตรวจ backend API endpoints ที่เกี่ยวข้อง:
      - `GET /api/v1/public/badges` + `GET /api/v1/my/badges`
      - `GET /api/v1/my/donations`
      - `GET /api/v1/public/leaderboard`
      → ถ้า feature ปิดถาวร → consider deprecating API routes ด้วย

### Migration safety
- ❌ ไม่มี schema migration ใหม่ในรอบ cleanup นี้ (แค่ data delete)
- ✅ `page_config_history` (versioning) ไม่กระทบ
- ✅ ไม่ต้อง migrate down / up อะไร
- ✅ เครื่อง dev อื่นแค่ `git pull` + รัน `DELETE FROM page_configs WHERE page_slug IN (...)` ตามตัวอย่างด้านบน

---

## 🎯 Concept ที่ cleanup นี้ยึดถือ

1. **Single source of truth** — code + DB + UI ต้องตรงกันเสมอ ไม่มี orphan
2. **Git = history** — ไม่เก็บ "reserve code" ในโปรเจ็กต์ เพราะ git ทำหน้าที่นี้แล้ว
3. **Document the trail** — ทุก cleanup ต้องมี changelog + rollback plan
4. **Safety first** — backup ก่อนทุกครั้งก่อน delete DB
5. **คงของเดิมที่ทีมตัดสิน** — ไม่ overstep, ไม่ revert decision ของทีม,
   ทำตามที่ทีมเริ่มให้จบ
