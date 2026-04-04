# Migration Log: saversurejulaherb (V1) → saversure (V2)

**วันที่ดำเนินการ:** 2026-04-03 ~ 2026-04-05
**ผู้ดำเนินการ:** Super Admin + Claude AI Assistant
**Branch:** `dev/bugfixes-and-setup`
**สถานะ:** ✅ **Phase 1 เสร็จสมบูรณ์**

---

## ผลลัพธ์สุดท้าย

| | V1 (เก่า) | V2 (ใหม่) | ลดลง |
|---|---:|---:|---:|
| **DB Size** | 12 GB | **6.1 GB** | 49% |
| Schema Migrations | - | 42 (001-041) | - |

### ข้อมูลที่ Migrate สำเร็จ

| ข้อมูล | V1 | V2 | Success Rate |
|--------|---:|---:|:-----------:|
| Users | 819,185 | 803,195 | 98% |
| Addresses | 41,577 | 40,911 | 98.4% |
| Point Ledger | - | 1,241,340 | ✅ |
| Products | 176 | 149 (กรอง 23 + fail 4) | 85% |
| Rewards | 154 | 153 | 99.4% |
| Coupon Codes | - | 1,100 | ✅ |
| Scan History | 12,094,802 | 11,872,062 | 98.2% |
| Redeem History | 77,502 | 76,033 | 98.1% |

### ข้อมูลที่ไม่ Migrate (ตั้งใจตัดออก)

| ข้อมูล | V1 ขนาด/จำนวน | เหตุผล |
|--------|-------------:|--------|
| QR Codes | 41.5M rows / 2.7 GB | V2 ใช้ HMAC stateless |
| Unregistered Scans | 5.1M rows / 2.1 GB | ไม่จำเป็น |
| JSONB location/device_info | ~3-4 GB | V2 เก็บ latitude/longitude + province แทน |
| FB integration | 176 คน | 0.02% ไม่คุ้มค่า |

### ข้อมูลที่เลือกไม่ Migrate (Phase 2 ถ้าต้องการ)

| ข้อมูล V1 | จำนวน | เหตุผล |
|-----------|------:|--------|
| Lucky Draw Campaigns | 57 | ต้องสร้าง runner ใหม่ (~2-3 วัน) |
| Lucky Draw Histories | 330,967 | ประวัติเก่า ไม่เชื่อมกับ V2 |
| News | 36 | สร้าง content ใหม่ง่ายกว่า |
| Support Cases | 3,369 | เคสเก่าปิดแล้ว |
| Support Messages | 11,322 | ข้อความในเคสเก่า |
| User Flag Histories | 15,006 | V2 เก็บ flag ปัจจุบันใน users.customer_flag แล้ว |
| Partner Shops | 1,237 | ต้องตัดสินใจว่าใช้ใน V2 ไหม |
| Staffs | 22 | V2 ใช้ user_roles สร้างใหม่ได้ |
| Settings | 7 | V2 ใช้ tenant.settings (JSONB) แทน |
| Donations/Histories | 0 | V1 ว่างเปล่า |

---

## Timeline ทั้งหมด

### Phase 0: เตรียมการ (2026-04-03 14:00-15:00)

| งาน | Commit |
|------|--------|
| ลบ .exe ออกจาก git + เพิ่ม .gitignore | `e57bff1` |
| แก้ API_BASE frontend fallback | `98e40ee` |
| Pull branch dev/bugfixes-and-setup | - |
| Schema Migration 038-040 | - |

### Phase 1: Data Migration (2026-04-03 15:00 ~ 2026-04-04 10:30)

| Module | เวลา | ผลลัพธ์ |
|--------|------|---------|
| Dry Run | 1 วินาที | ✅ estimated 1.6M items |
| **Customer** (Job 1) | 3 ชม. 19 นาที | 179K success (interrupted) |
| **Customer** (Retry) | 1 ชม. 33 นาที | ✅ 1.3M success |
| **Product** | < 1 นาที | ✅ 149 inserted |
| **Rewards** (5 attempts) | ~15 นาที | ✅ 153 inserted + 1,100 coupons |
| **Scan History** | ~3 ชม. | ✅ 11.2M inserted (0 failed!) |
| **Redeem History** | ~7 นาที | ✅ 76K inserted |

### Phase 2: Optimization & Cleanup (2026-04-04 ~ 2026-04-05)

| งาน | ผลลัพธ์ |
|------|---------|
| Batch scan_history (500 rows/tx) | เร็วขึ้น 16 เท่า |
| Fast customer skip (≥95%) | < 1 วินาทีแทน 40 นาที |
| ลบ entity_maps scan_history | ลด DB 5 GB |
| สร้าง Migration 041 | rewards constraint >= 0 |
| สร้าง Baseline Snapshot ใหม่ | `backup/v2_dev_baseline.dump` |

---

## Bugs ที่พบและแก้ไข (7 จุด)

### Bug 1: API_BASE frontend เป็น string ว่าง
- **ไฟล์:** `frontend/src/lib/api.ts` บรรทัด 1
- **Commit:** `98e40ee`

### Bug 2: rewards `images` column type mismatch
- **ปัญหา:** V1 `text` แต่ Go scan เป็น `[]string`
- **ไฟล์:** `backend/internal/migrationjob/runners.go`
- **Commit:** `3ac67d6`

### Bug 3: `upsertEntityMap` empty string UUID
- **ปัญหา:** ส่ง `""` เป็น jobID → UUID column reject
- **ไฟล์:** `backend/internal/migrationjob/service.go`
- **Commit:** `3ac67d6`

### Bug 4: `rewards_point_cost_check` constraint
- **ปัญหา:** V1 มี 2 rewards ที่ point = 0
- **แก้:** constraint `>= 0` + migration 041
- **Commit:** `5a69d26`

### Bug 5: `runRewards` ไม่มี `rows.Err()` check
- **Commit:** `3ac67d6`

### Bug 6: Error messages ไม่ระบุจุดที่ fail
- **Commit:** `3ac67d6`

### Bug 7: scan_history ช้ามาก (50 ชม.)
- **สาเหตุ:** 1 row/transaction + DB query duplicate check ทุก row
- **แก้:** batch 500 rows/tx + in-memory duplicate map + fast customer skip
- **ผลลัพธ์:** เร็วขึ้น 16 เท่า (3.6K → 57K rows/นาที)
- **Commit:** `5a69d26`

---

## Commits ทั้งหมด (บน dev/bugfixes-and-setup)

| Commit | Message |
|--------|---------|
| `e57bff1` | chore: remove Go binaries from git and add *.exe to .gitignore |
| `98e40ee` | fix: restore API_BASE fallback to localhost:30400 for frontend |
| `3ac67d6` | fix(migration): resolve rewards module bugs + add migration log |
| `5a69d26` | feat(migration): batch scan_history, fast customer skip, migration 041 |

---

## Migration Jobs History (13 jobs)

| # | Mode | Modules | Status | Success | Failed |
|---|------|---------|:------:|--------:|-------:|
| 1 | dry_run | customer,product,rewards | ✅ | 0 | 0 |
| 2 | execute | customer | ✅ (11%) | 179,235 | 1,165 |
| 3 | execute | customer (retry) | ✅ | 1,326,464 | 16,000 |
| 4 | execute | product,rewards | ❌ | 149 | 4 |
| 5-8 | execute | rewards | ❌ x4 | 0 | 0 |
| 9 | execute | rewards | ✅ | 153 | 1 |
| 10 | execute | scan_history (slow) | ❌ cancelled | 303K | 0 |
| 11 | execute | scan_history (slow v2) | ❌ cancelled | - | - |
| 12 | execute | **scan_history (batch)** | **✅** | **11,244,988** | **0** |
| 13 | execute | **redeem_history** | **✅** | **76,176** | **1** |

---

## Infrastructure

| Service | Status | Port |
|---------|:------:|------|
| saversure-postgres | ✅ | 5433 |
| saversure-redis | ✅ | 6379 |
| saversure-nats | ✅ | 4222 |
| saversure-minio | ✅ | 59300 |
| saversure-api-prod (PM2) | ✅ | 30400 |
| saversure-admin-prod (PM2) | ✅ | 30401 |
| saversure-consumer-prod (PM2) | ✅ | 30403 |

---

## ต้องทำต่อ (Phase 2)

- [ ] ทดสอบ Frontend Consumer (LINE login, คะแนน, แลกรางวัล)
- [ ] ทดสอบ Admin Dashboard (จำนวนลูกค้า, สินค้า, scan)
- [ ] พิจารณา Lucky Draw migration (57 campaigns + 330K histories)
- [ ] พิจารณา Partner Shops migration (1,237 ร้าน)
- [ ] พิจารณา News migration (36 บทความ)
