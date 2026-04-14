# Saversure V1 -> V2 Cutover Runbook

เอกสารนี้สรุปแนวทางเตรียมฐานข้อมูล V2 สำหรับ migration รอบจริง โดยยึดหลัก `baseline reset` แทนการลบข้อมูลปลายทางทีละตาราง

## 1. Snapshot ที่ตรวจพบใน V2 ตอนนี้

จากการสำรวจฐานข้อมูล `saversure` ปัจจุบัน พบว่า V2 ยังไม่ใช่ baseline สะอาด แต่เป็นก้อนผสมระหว่างข้อมูล V1 ที่เคย migrate แล้วกับข้อมูล demo/CMS

### 1.1 ข้อมูล V1 ที่ค้างอยู่ใน V2

| กลุ่ม | จำนวนที่พบ | ตัวบ่งชี้ |
|---|---:|---|
| Users | 810,918 | มี `v1_user_id` แล้ว 810,915 คน |
| Addresses | 40,563 | ผูกกับ users ที่มาจาก V1 |
| Point ledger | 765,485 | `reference_type = 'v1_migration'` 765,472 แถว |

หมายเหตุ:

- `point_ledger` ยังมีอีก 13 แถวที่ไม่ใช่ `v1_migration`
- ก่อน cutover จริงให้ตรวจว่ามาจาก bootstrap/test flow อะไร และตัดสินใจว่าจะเก็บไว้ใน baseline หรือไม่

### 1.2 ข้อมูล V2 แบบ demo/test/CMS ที่ยังค้าง

| กลุ่ม | จำนวนที่พบ | หมายเหตุ |
|---|---:|---|
| Products | 150 | อยู่ใน tenant `00000000-0000-0000-0000-000000000001` |
| Rewards | 11 | อยู่ใน campaign demo |
| Scan history | 13 | ดูเป็นข้อมูลทดลอง |
| Reward reservations | 2 | ดูเป็นข้อมูลทดลอง |
| Campaigns | 3 | 1 active + 2 draft |
| Page configs | 2 | `home`, `rewards` |
| Nav menus | 3 | `bottom_nav`, `drawer`, `header` |
| Popups | 3 | เป็น CMS demo |
| Migration jobs | 5 | metadata จากการทดลอง |

### 1.3 ตัวอย่างข้อมูล bootstrap/local-only ที่พบ

users ที่ไม่มี `v1_user_id` ตอนนี้มี 3 บัญชี:

- `admin@saversure.com`
- `shantou@saversure.com`
- `tanlab01@saversure.com`

หมายเหตุ:

- บัญชีเหล่านี้อาจเป็น operator/bootstrap account ที่ใช้เข้า admin ได้
- ถ้าจะทำ baseline ใหม่ ควรเก็บไว้เฉพาะบัญชีที่จำเป็นจริงต่อการเข้า Migration Center

## 2. ข้อมูล V1 ล่าสุดที่พร้อมใช้

### 2.1 Dump หลัก

- `E:\saversure _db_v1\saversurejulaherb_prod_with_history_20260409.dump`

จาก TOC ของ dump พบ domain สำคัญที่ใช้วางแผน migration รอบนี้ได้แล้ว เช่น:

- `users`
- `user_address`
- `products`
- `rewards`
- `reward_redeem_histories`
- `qrcode_scan_history`
- `coupons`
- `settings`
- `staffs`
- `news`
- `partner_shops`
- `lucky_draw_campaigns`
- `lucky_draw_histories`

### 2.2 QR dataset แยก

- `E:\saversure _db_v1\saversurejulaherb_qrcodes_2025H1_20260331.csv.gz`

สถานะ:

- มีไฟล์ QR แยกแล้ว 1 ก้อน
- ให้ถือเป็น partial dataset สำหรับ phase ถัดไป
- รอบ migration หลักตอนนี้ยังไม่ต้อง import full QR dataset

## 3. สิ่งที่ควร Keep ใน baseline

baseline ที่จะใช้ migrate รอบจริงควรเก็บเฉพาะสิ่งจำเป็นต่อการเปิดระบบและสั่ง migration

- schema ล่าสุดของ V2
- bootstrap admin/operator account ที่จำเป็นจริง
- config ระบบขั้นต่ำที่ทำให้ backend/admin เปิดได้
- migration center และ dependency ของระบบ

สิ่งที่ไม่ควรติดมากับ baseline ถ้าจะรับข้อมูลจริงจาก V1:

- tenant demo/CMS ของ `000...001`
- campaign demo
- rewards/products demo
- page configs/nav menus/popups demo
- migrated V1 data เดิมจากรอบทดลอง

## 4. สิ่งที่ควรถูก Clear ก่อน migration รอบจริง

อย่าลบทีละ table บน DB ปัจจุบัน ให้ทำผ่าน baseline reset ทั้งก้อน

### 4.1 กลุ่มข้อมูลที่ต้องหายไปจาก V2 เป้าหมายก่อน Execute

- `users` แถวที่มี `v1_user_id`
- `user_addresses` ที่มาจาก V1
- `point_ledger` แถวที่ `reference_type = 'v1_migration'`
- `products`
- `rewards`
- `scan_history`
- `reward_reservations`
- `migration_jobs`
- `migration_job_modules`
- `migration_job_errors`
- `migration_entity_maps`

### 4.2 กลุ่ม config/demo ที่ควรหายไปเช่นกันถ้าไม่ได้ใช้เป็น baseline จริง

- `campaigns` demo
- `page_configs`
- `nav_menus`
- `popups`
- seed data จากไฟล์:
  - `backend/migrations/seed_demo_data.sql`
  - `backend/migrations/seed_demo_data_admin.sql`
  - `backend/seed_cms.sql`
  - `backend/seed_rewards.sql`
  - `backend/migrations/seed_user_chanakorn.sql`

## 5. แนวทาง Baseline Reset

อ้างอิงหลัก:

- `docs/dev-migration-reset.md`
- `scripts/create-v2-baseline-snapshot.ps1`
- `scripts/reset-v2-from-baseline.ps1`

### 5.1 baseline ที่แนะนำ

ให้สร้าง `backup/v2_dev_baseline.dump` หลังจาก:

1. schema migrations ของ V2 ครบ
2. bootstrap admin พร้อมใช้งาน
3. ยังไม่มีการ import ข้อมูล V1 รอบจริง
4. ไม่มี tenant/demo CMS ที่ไม่ต้องการใน cutover baseline

### 5.2 ขั้นตอน reset ก่อน migrate จริง

1. `docker compose up -d`
2. reset V2 จาก baseline:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/reset-v2-from-baseline.ps1 -Force
```

3. ยืนยันว่า API และ admin เปิดได้
4. เปิด Migration Center
5. ตรวจ `Source Connection` ให้ชี้ไป V1 source ล่าสุด

## 6. Dry Run / Execute Plan

ลำดับ module ตามระบบ:

1. `customer`
2. `product`
3. `rewards`
4. `scan_history`
5. `redeem_history`

dependency ในระบบ:

- `scan_history` ต้องมี `customer`
- `redeem_history` ต้องมี `customer` + `rewards`

### 6.1 รอบ Dry Run ที่แนะนำ

รอบที่ 1:

- `customer`
- `product`
- `rewards`

เป้าหมาย:

- ดู counts ตั้งต้น
- ดู warnings เรื่อง field mapping
- ดูว่ามี constraint/format mismatch หรือไม่

รอบที่ 2:

- `scan_history`
- `redeem_history`

เป้าหมาย:

- ยืนยัน dependency ถูก resolve
- ประเมินเวลารันและ chunk size ที่เหมาะสม

### 6.2 รอบ Execute ที่แนะนำ

1. `customer`
2. `product`
3. `rewards`
4. `scan_history`
5. `redeem_history`

หลังแต่ละรอบ ให้เช็ก reconciliation:

- users / addresses
- products / rewards
- point ledger opening balances
- scan count
- redeem history count

## 7. V1 Live Sync (Incremental Sync จาก AWS RDS)

> **เพิ่มเมื่อ 2026-04-10** — หลัง Phase 1 migration เสร็จ เราเปลี่ยนแนวทางมาใช้ V1 Live Sync แทน dump-based migration

### 7.1 แนวคิด

แทนที่จะ down V1 แล้ว dump → restore ใหม่ทุกรอบ ตอนนี้ V2 เชื่อมต่อไป V1 (AWS RDS) ตรงๆ แล้วดึงข้อมูลใหม่มาแบบ incremental ผ่าน watermark:

```
V1 (AWS RDS) ──── internet ────► V2 Live Sync Service ──► V2 DB (Docker)
                                  ├── users (incremental by id)
                                  └── scan_history (incremental by id)
```

### 7.2 การทำงาน

- **Service**: `backend/internal/v1sync/`
- **Config**: `.env` → `V1_LIVE_DB_HOST`, `V1_LIVE_DB_PORT`, `V1_LIVE_DB_USER`, `V1_LIVE_DB_PASSWORD`, `V1_LIVE_DB_NAME`
- **Watermark table**: `v1_sync_state` เก็บ `entity_type`, `last_synced_id`
- **Trigger**: ตั้งเวลา (scheduled) + กดมือ (manual via API)
- **Batch size**: 500-2000 ต่อรอบ

### 7.3 สิ่งที่ sync ได้แล้ว

| Entity | สถานะ | Watermark ปัจจุบัน |
|--------|:------:|---:|
| users | ✅ | 849,526 |
| scan_history | ✅ | 12,171,755 |

### 7.4 สิ่งที่ทำระหว่าง sync

- **User ใหม่**: insert user + entity map + point_ledger snapshot (จาก V1 `users.point`)
- **User ที่มีแล้ว**: อัปเดต point snapshot เท่านั้น
- **Scan ใหม่**: insert scan_history + entity map (ใน transaction เดียว)
- **Scan ที่มีแล้ว**: patch legacy fields ที่ยังว่าง (serial, product name, etc.)

## 8. Legacy Fields Convention

### 8.1 ทำไมต้องมี legacy fields

V1 มี concept บางอย่างที่ V2 ไม่ได้เก็บตรงๆ (เช่น QR serial, V1 product ID) เราจึงเพิ่ม `legacy_*` columns ไว้ใน `scan_history` เพื่อเก็บข้อมูล V1 ดั้งเดิม:

| Column | Type | คำอธิบาย |
|--------|------|---------|
| `legacy_qr_code_id` | bigint | QR ID จาก V1 |
| `legacy_qr_code_serial` | text | Serial เช่น A4WUCWUY |
| `legacy_product_v1_id` | bigint | Product ID ฝั่ง V1 |
| `legacy_product_name` | text | ชื่อสินค้า V1 |
| `legacy_product_sku` | text | SKU V1 |
| `legacy_product_image_url` | text | URL รูปสินค้า V1 |
| `legacy_status` | smallint | สถานะ V1 (2=success) |
| `legacy_verify_method` | smallint | วิธีตรวจ V1 |

### 8.2 กฎ

- เมื่อจะเพิ่ม field ที่เกี่ยวกับ V1 → prefix ด้วย `legacy_` เสมอ
- ใน UI → แสดง badge V1/V2 ด้วย (amber=V1, emerald=V2)
- ใน API → ส่ง `data_source: "v1"|"v2"` ให้ frontend ตัดสินใจแสดงผล

### 8.3 Backfill Tools

| Tool | คำสั่ง | หน้าที่ |
|------|-------|--------|
| `cmd/backfillv1scanserial` | `go run ./cmd/backfillv1scanserial` | เติม serial จาก V1 ให้ scan_history ที่ยังว่าง |
| `cmd/backfillv1userpoints` | `go run ./cmd/backfillv1userpoints` | เติม point snapshot จาก V1 ให้ user ที่ยังไม่มี ledger |

## 9. Point Balance — Dual-Source Calculation

เนื่องจาก user V1 บางส่วนไม่มี `point_ledger` (เช่น point=0 ใน V1) ระบบ V2 จึงคำนวณ balance แบบ fallback:

```
1. ถ้ามี point_ledger → ใช้ balance_after ล่าสุด
2. ถ้าไม่มี → SUM(scan_history.points_earned WHERE success) - SUM(reward_reservations.point_cost WHERE CONFIRMED)
```

รองรับทั้ง user ที่มาจาก V1 (migrated) และ V2 (native) โดยอัตโนมัติ

## 10. QR V1 Compatibility (สำหรับ Phase ถัดไป)

### 10.1 สถานการณ์ปัจจุบัน

- V1 ถูก down ชั่วคราว แต่สามารถเปิดให้กลับมารันได้
- สินค้า V1 ที่มี QR code ยังวางขายในท้องตลาด **จำนวนมาก**
- ลูกค้า scan QR V1 ผ่าน URL เช่น `qr.saversure.com?code=XXXXX`

### 10.2 แนวทางที่พิจารณา

**แนวทาง A — V1 Redirect + V2 Backend**
- Route QR URL มาที่ V2
- V2 lookup serial จาก `legacy_qr_code_serial` หรือ archive table
- ให้ point เท่าเดิมตาม V1 product/QR config

**แนวทาง B — V1 ยังรัน + Live Sync**
- ปล่อย V1 ให้รับ scan ต่อไป
- V2 ดึง scan ใหม่มาผ่าน Live Sync
- เหมาะช่วง transition ที่ V2 ยังไม่พร้อมรับ scan ตรง

ปัจจุบันใช้ **แนวทาง B** อยู่ — V1 สามารถเปิดกลับมาได้ + V2 Live Sync คอยกวาดข้อมูลล่าสุด

### 10.3 QR Dump

- `saversure_legacy_qrcodes_only.dump` — QR dataset จาก V1 (dump เสร็จแล้ว)
- ยังไม่ได้ restore เข้า V2
- ถ้าจะทำ แนวทาง A → ต้อง restore เป็น archive table แยก

## 11. Checklist สถานะปัจจุบัน (2026-04-10)

### ✅ เสร็จแล้ว
- [x] Gap-only migration: customer, product, rewards, scan_history, redeem_history
- [x] V1 Live Sync: users + scan_history (watermark-based)
- [x] Legacy field backfill: serial, product name, status
- [x] Point snapshot backfill: V1 users ที่มี point > 0
- [x] Customer detail UI: รองรับ V1+V2 data source
- [x] Scan history admin UI: แสดง serial, product, scan_type, V1/V2 badge
- [x] Workspace rule + Skill สำหรับ V1→V2 transition

### 🔄 กำลังดำเนินการ
- [ ] V1 ยังปิดอยู่ — รอตัดสินใจเปิดกลับ
- [ ] QR V1 compatibility layer ยังไม่ได้ implement

### ⏳ ยังไม่ได้ทำ (Phase ถัดไป)
- [ ] QR dataset import (restore `saversure_legacy_qrcodes_only.dump`)
- [ ] QR V1 redirect/lookup service
- [ ] Lucky Draw campaigns migration (57 campaigns + 330K histories)
- [ ] Partner Shops migration (1,237 ร้าน)
- [ ] News migration (36 บทความ)
- [ ] Consumer frontend testing (LINE login, scan, redeem)

## 12. ไฟล์อ้างอิง

### Documents
- `docs/v1-to-v2-cutover-runbook.md` — ไฟล์นี้
- `docs/dev-migration-reset.md` — วิธี reset V2 จาก baseline
- `backup/MIGRATION_LOG_V1_TO_V2.md` — Migration log รวม Phase 1-3

### Backend Code
- `backend/internal/migrationjob/` — Migration job runners (Phase 1)
- `backend/internal/v1sync/` — V1 Live Sync service (Phase 3)
- `backend/cmd/backfillv1scanserial/` — Backfill scan serial tool
- `backend/cmd/backfillv1userpoints/` — Backfill user points tool
- `backend/internal/customer/service.go` — Customer detail (dual-source balance)
- `backend/internal/scanhistory/service.go` — Scan history list (CTE optimized)

### Scripts
- `scripts/create-v2-baseline-snapshot.ps1`
- `scripts/reset-v2-from-baseline.ps1`

### Config & Rules
- `backend/.env` — V1 Live Sync config (`V1_LIVE_DB_*`)
- `.cursor/rules/saversure-v2.mdc` — Workspace rule (V1→V2 awareness)
