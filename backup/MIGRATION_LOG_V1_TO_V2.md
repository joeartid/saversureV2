# Migration Log: saversurejulaherb (V1) → saversure (V2)

**วันที่ดำเนินการ:** 2026-04-03 ~ 2026-04-04
**ผู้ดำเนินการ:** Super Admin + Claude AI Assistant
**Branch:** `dev/bugfixes-and-setup`
**V1 DB:** `saversurejulaherb` @ localhost:5432 (12 GB, 67 tables)
**V2 DB:** `saversure` @ localhost:5433 Docker (schema: 41 migrations)

---

## สถานะล่าสุด (2026-04-04 02:30+07:00)

| รายการ | ค่า |
|--------|-----|
| **V2 DB Size** | **1,763 MB** (จาก V1 12 GB → ลด 85%) |
| **scan_history กำลังรัน** | 303,915 / 12,094,802 (~2.5%) |
| **ประมาณเวลาที่เหลือ** | ~50 ชม. (scan_history ช้า ~3.6K/นาที) |

### สรุปข้อมูลใน V2 ตอนนี้

| ข้อมูล | จำนวน | หมายเหตุ |
|--------|------:|----------|
| Users (total) | 803,210 | |
| Users (V1 migrated) | 803,195 | จาก V1 819,185 |
| User Addresses | 40,911 | จาก V1 41,577 |
| Point Ledger (V1) | 1,241,293 | |
| Products | 160 | 149 จาก V1 + 11 seed |
| Rewards | 163 | 153 จาก V1 + 10 seed |
| Coupon Codes | 1,100 | imported จาก V1 JSONB |
| Campaigns | 2 | 1 seed + 1 legacy_migration |
| Scan History | 303,915 | **กำลัง migrate (2.5% ของ 12M)** |
| Reward Reservations | 10 | seed data (ยังไม่ migrate redeem) |
| Entity Maps | 345,087 | tracking V1→V2 ID |
| Schema Migrations | 41 | ครบ (001-040) |

### Entity Maps Breakdown

| Entity Type | จำนวน |
|-------------|------:|
| scan_history | 303,987 |
| address | 40,910 |
| reward | 153 |
| product | 149 |
| campaign | 1 |

### V2 Table Sizes (Top 10)

| Table | Size | Rows |
|-------|-----:|-----:|
| users | 802 MB | 803,210 |
| point_ledger | 456 MB | 1,241,340 |
| user_roles | 192 MB | ~803K |
| migration_entity_maps | 153 MB | 345,087 |
| scan_history | 124 MB | 303,915 (กำลังเพิ่ม) |
| user_addresses | 16 MB | 40,911 |
| migration_job_errors | 15 MB | 48,009 |

---

## สิ่งที่ทำทั้งหมด (Timeline)

### Phase 0: เตรียมการ (2026-04-03 14:00-15:00)

| # | งาน | ไฟล์ | Commit |
|---|------|------|--------|
| 1 | ลบ .exe ออกจาก git + เพิ่ม .gitignore | `.gitignore`, `backend/*.exe` | `e57bff1` |
| 2 | แก้ API_BASE frontend fallback | `frontend/src/lib/api.ts` บรรทัด 1 | `98e40ee` |
| 3 | Pull branch `dev/bugfixes-and-setup` จาก remote | - | - |
| 4 | ตรวจสอบ DB port mismatch (.env vs docker-compose) | `backend/.env` | - |

### Phase 1: Schema Migration (2026-04-03 15:00-15:30)

| # | งาน | รายละเอียด |
|---|------|-----------|
| 1 | สร้าง Baseline Snapshot | `backup/v2_dev_baseline.dump` |
| 2 | รัน `make migrate-up` | apply 038, 039, 040 |
| 3 | แก้ migration 039 | เพิ่ม `IF NOT EXISTS` เพราะ columns มีอยู่แล้ว |
| 4 | Restart PM2 `saversure-api-prod` | ตรวจว่า API ทำงานปกติ |

### Phase 2: เตรียม Data Migration (2026-04-03 15:30-16:30)

| # | งาน | รายละเอียด |
|---|------|-----------|
| 1 | เพิ่ม `LEGACY_V1_DB_*` ใน `backend/.env` | ชี้ไป V1 DB localhost:5432 |
| 2 | เพิ่ม `LEGACY_V1_DB_*` ใน `Production/saversure-api/.env` | PM2 อ่าน config จากที่นี่ |
| 3 | Restart API + ตรวจ `/migration-jobs/config/source` | ยืนยันว่าเชื่อมต่อ V1 ได้ |
| 4 | Dry Run ทดสอบ (customer, product, rewards) | สำเร็จ 100%, estimated 1.6M items |

### Phase 3: Data Migration — Customer (2026-04-03 16:37-01:02+1)

| Job | Mode | Status | Success | Failed | เวลา |
|-----|------|--------|--------:|-------:|------|
| `8f2d4cc1` | execute | completed (11%) | 179,235 | 1,165 | 3 ชม. 19 นาที (interrupted) |
| `f5e798f0` | execute (retry) | **completed 100%** | 1,326,464 | 16,000 | 1 ชม. 33 นาที |

**ผลลัพธ์:**
- Users: 803,195 migrated (จาก 819,185)
- Addresses: 40,910 migrated (จาก 41,577)
- Point Balances: 1,241,293 entries สร้างใหม่
- Placeholder emails: 15,989 users

### Phase 4: Data Migration — Product + Rewards (2026-04-03 01:49-02:03+1)

**Product:**
| Job | Status | Inserted | Skipped | Failed |
|-----|--------|-------:|-------:|-------:|
| `6f107d9a` | completed (product only) | 149 | 23 | 4 |

**Rewards (5 attempts — 4 failed จาก bugs, 1 สำเร็จ):**
| Job | Status | Error |
|-----|--------|-------|
| `6f107d9a` | ❌ failed | `images` type mismatch (text vs []string) |
| `d5c922bc` | ❌ failed | UUID empty string |
| `05a34c6a` | ❌ failed | UUID empty string |
| `8bf2ff32` | ❌ failed | UUID empty string |
| `a8581fe4` | ❌ failed | UUID empty string (with better error msg) |
| **`3783a49d`** | **✅ completed** | 153 inserted, 1,100 coupons |

### Phase 5: Data Migration — Scan History (กำลังรัน)

| Job | Status | Progress | Success | เริ่ม |
|-----|--------|----------|--------:|------|
| `22c49ec3` | **running** | 2.5% (303K/12M) | 1,148,075 | 2026-04-04 01:32 |

**ประมาณเวลาที่เหลือ:** ~50 ชม. (ช้าเพราะต้อง lookup user map ทุก row)

---

## Bugs ที่พบและแก้ไข (5 จุด)

### Bug 1: `rewards.images` column type mismatch
- **ปัญหา:** V1 `rewards.images` = `text` แต่ Go scan เป็น `[]string` → pgx fail ทันที → module 0%
- **ไฟล์:** `backend/internal/migrationjob/runners.go` (~บรรทัด 476)
- **แก้ไข:** เปลี่ยนเป็น `*string` แล้ว parse `{url1,url2}` เป็น `[]string` เอง
- **Commit:** `3ac67d6`

### Bug 2: `upsertEntityMap` empty string UUID
- **ปัญหา:** `ensureMigrationCampaign()` ส่ง `""` เป็น jobID → UUID column reject → `ERROR: invalid input syntax for type uuid: ""`
- **ไฟล์:** `backend/internal/migrationjob/service.go` (~บรรทัด 680)
- **แก้ไข:** ถ้า `jobID == ""` ส่ง `nil` (NULL) + ใช้ `COALESCE` ใน SQL
- **Commit:** `3ac67d6`

### Bug 3: `rewards_point_cost_check` constraint
- **ปัญหา:** V1 มี 2 rewards ที่ point = 0 → ชน `CHECK (point_cost > 0)`
- **แก้ไข:** `ALTER TABLE rewards` เปลี่ยนเป็น `CHECK (point_cost >= 0)`
- **หมายเหตุ:** แก้ตรง DB เท่านั้น ยังไม่อัปเดต migration SQL (ควรเพิ่ม migration 041)

### Bug 4: `runRewards` ไม่มี `rows.Err()` check
- **ปัญหา:** หลัง loop ไม่เช็ค `rows.Err()` → debug ยากเมื่อ iteration fail
- **ไฟล์:** `backend/internal/migrationjob/runners.go` (หลัง rewards loop)
- **แก้ไข:** เพิ่ม `rows.Err()` check
- **Commit:** `3ac67d6`

### Bug 5: Error messages ไม่ระบุจุดที่ fail
- **ปัญหา:** `ensureCurrency` / `ensureMigrationCampaign` return error ไม่มี context
- **ไฟล์:** `backend/internal/migrationjob/runners.go` (ใน `runRewards`)
- **แก้ไข:** เพิ่ม `fmt.Errorf` wrap ด้วยชื่อ function
- **Commit:** `3ac67d6`

---

## งานอื่นที่ทำ (ไม่ใช่ migration)

| # | งาน | รายละเอียด |
|---|------|-----------|
| 1 | แก้ API_BASE frontend | `api.ts` fallback เป็น `""` → เปลี่ยนเป็น `http://localhost:30400` |
| 2 | ลบ .exe จาก git | 3 binary files (api.exe, saversure-api.exe, saversure.exe) ~72 MB |
| 3 | หยุด Docker containers ไม่จำเป็น | `webootsx-db-tiktok`, `minio` (ลด CPU) |
| 4 | Restart Docker Desktop | แก้ปัญหา `com.docker.backend` กิน CPU 51% → ลดเหลือ ~19% |
| 5 | ตรวจสอบ admin login 400/401 | สาเหตุ: API_BASE ว่าง + credentials ถูกต้อง (admin@saversure.com / Admin123!) |

---

## Error Summary (ทั้งหมด 48,009 error records)

| Module | Error Type | จำนวน | สาเหตุ |
|--------|-----------|------:|--------|
| customer | transaction aborted | 31,978 | duplicate key → cascade abort |
| customer (address) | invalid UTF8 | 20 | Thai text encoding เสีย |
| customer (user) | duplicate phone | 2 | phone ซ้ำกัน |
| product | invalid UTF8 | 4 | Thai text encoding เสีย |
| rewards | invalid UTF8 | 1 | Thai text encoding เสีย |
| scan_history | (กำลังรัน) | TBD | |

---

## Commits ที่ push ไปแล้ว

| Commit | Message | ไฟล์ที่เปลี่ยน |
|--------|---------|---------------|
| `e57bff1` | chore: remove Go binaries from git and add *.exe to .gitignore | .gitignore |
| `98e40ee` | fix: restore API_BASE fallback to localhost:30400 for frontend | frontend/src/lib/api.ts |
| `3ac67d6` | fix(migration): resolve rewards module bugs + add migration log | runners.go, service.go, 039.sql, MIGRATION_LOG |

---

## Infrastructure Status

### Docker Containers
| Container | Status | Port |
|-----------|--------|------|
| saversure-postgres | ✅ healthy | 5433 |
| saversure-redis | ✅ healthy | 6379 |
| saversure-nats | ✅ healthy | 4222 |
| saversure-minio | ✅ healthy | 59300 |
| minio (other) | ⚠️ running (ไม่จำเป็น) | 9500 |
| webootsx-db-tiktok | ⏹ stopped | - |

### PM2 Services
| Service | Status | Port |
|---------|--------|------|
| saversure-api-prod | ✅ online | 30400 |
| saversure-admin-prod | ✅ online | 30401 |
| saversure-consumer-prod | ✅ online | 30403 |

### Config Files ที่แก้ไข (ไม่ได้ commit)
| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `backend/.env` | เพิ่ม LEGACY_V1_DB_* |
| `D:\AI_WORKSPACE\Production\saversure-api\.env` | เพิ่ม LEGACY_V1_DB_* |

---

## สิ่งที่ต้องทำต่อ

- [ ] รอ **scan_history** เสร็จ (~50 ชม.)
- [ ] รัน **redeem_history** module (77K rows)
- [ ] สร้าง migration 041 แก้ `rewards_point_cost_check` ถาวร
- [ ] สร้าง Baseline Snapshot ใหม่หลังเสร็จทั้งหมด
- [ ] อัปเดต Migration Log ครั้งสุดท้าย + commit
- [ ] ทดสอบ frontend + consumer app
- [ ] พิจารณา Phase 2: lucky_draw, support_cases, donations
- [ ] พิจารณาเพิ่ม chunk_size หรือ batch insert เพื่อเร่ง scan_history
