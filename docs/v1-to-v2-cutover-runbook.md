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

## 7. ขอบเขต QR Phase ถัดไป

รอบนี้:

- ออกแบบเผื่อ QR phase
- ยังไม่ import full QR dataset

สิ่งที่ต้องตัดสินใจก่อนทำ phase QR จริง:

- QR จะใช้เพื่อ audit/history อย่างเดียว หรือใช้ lookup/validation ด้วย
- ถ้าใช้แค่อ้างอิงย้อนหลัง อาจเก็บเป็น archive/read-only source แยก
- ถ้าต้องใช้คู่ขนานกับ legacy QR ช่วง cutover ต้องออกแบบ compatibility layer เพิ่ม

ข้อเสนอสำหรับ phase QR:

1. ใช้ไฟล์ `saversurejulaherb_qrcodes_2025H1_20260331.csv.gz` สำรวจ schema ก่อน
2. สรุป use case ให้ชัดว่า V2 ต้อง query QR เก่าหรือไม่
3. ถ้าจำเป็นต้องใช้ full QR จริง ค่อยแยกเป็น migration stream อิสระจาก customer/reward/scan/redeem

## 8. Checklist ก่อนกด Execute รอบจริง

- baseline ถูก restore จาก dump ที่สะอาด
- ไม่มี migrated V1 data ค้างอยู่ใน V2
- ไม่มี demo tenant/CMS ที่จะชนกับข้อมูลจริง
- source config ชี้ไป V1 ล่าสุด
- dry run ผ่านและ counts สมเหตุผล
- admin/operator account ยังเข้าใช้งานได้
- ตกลงขอบเขต QR phase แล้วว่าไม่รวมในรอบ execute หลัก

## 9. ไฟล์อ้างอิง

- `docs/dev-migration-reset.md`
- `backup/MIGRATION_LOG_V1_TO_V2.md`
- `backend/internal/migrationjob/types.go`
- `backend/internal/migrationjob/service.go`
- `backend/internal/migrationjob/runners.go`
- `scripts/create-v2-baseline-snapshot.ps1`
- `scripts/reset-v2-from-baseline.ps1`
