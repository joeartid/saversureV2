# Saversure V2 — Development Backlog

> เอกสาร Requirement & Backlog ฉบับสมบูรณ์
> เปรียบเทียบจาก V1 + ปรับปรุง + ฟีเจอร์ใหม่
>
> สร้างเมื่อ: 2026-03-04
> อัปเดตล่าสุด: 2026-03-08
> อ้างอิง: V1 repos (jlc-group), saversure-charter-v2.docx, batch-qr-creator-01

---

## Status Refresh (2026-03-23)

This section is the latest checkpoint after code review in the current workspace.

### Confirmed Implemented Since Earlier Backlog Notes

- Reward redemption flow is already connected in backend + consumer, including coupon return and shipping address handling.
- Web QR camera fallback is already implemented in consumer via `html5-qrcode`, alongside existing LIFF hooks.
- Ops digest and admin alerts are already implemented in backend and exposed in admin `Ops Center`.
- Admin fulfillment flow is now implemented with:
  - fulfillment list page
  - status updates (`pending -> preparing -> shipped -> delivered`)
  - bulk updates
  - printable shipping labels
  - downloadable PDF delivery notes

### Recommended Next Priorities

1. Production safety baseline
   - add unit tests for redemption, ledger, codegen, and fulfillment PDF generation
   - add CI for backend/frontend type and test checks
2. Fulfillment hardening
   - add courier/provider metadata, delivery note numbering, and audit trail for PDF exports
3. Backlog cleanup
   - merge older recommendation sections with the real implementation status to avoid duplicate or outdated priorities

---

## สถานะปัจจุบันของ V2

### สิ่งที่ทำเสร็จแล้ว

| Module | Backend | Admin UI | Consumer UI | หมายเหตุ |
|--------|---------|----------|-------------|----------|
| Multi-Tenant | ✅ | ✅ | — | CRUD tenant, settings per tenant (JSONB) |
| Auth (JWT) | ✅ | ✅ | ✅ | Login (email+phone), Register, Consumer OTP Register, Refresh |
| Campaign CRUD | ✅ | ✅ | — | สร้าง/แก้ไข/list, publish API |
| Batch Create | ✅ | ✅ | — | Quantity-based, auto serial range, campaign dropdown |
| Batch Export (CSV) | ✅ | ✅ | — | Export แบบ roll/full, lot_size flexible |
| QR Code (HMAC) | ✅ | — | — | HMAC-SHA256 signing + validation |
| Ref1/Ref2 | ✅ | — | — | Obfuscated base36, checksum |
| QC Verify | ✅ | ✅ | — | Mobile-friendly QC page |
| Scan API | ✅ | — | ✅ | QR + ref1, quota, location, fraud check |
| Reward CRUD | ✅ | ✅ | ✅ | Rewards catalog + detail + tier restriction |
| Reward Inventory | ✅ | ✅ | — | Stock management, flash rewards |
| 2-Phase Redemption | ✅ | — | ✅ | Reserve → Confirm, row-level lock |
| Point Ledger | ✅ | ✅ | ✅ | Credit/debit/refund, balance, history |
| Coupon Code Pool | ✅ | ✅ | — | Bulk import, atomic claim |
| Audit Trail | ✅ | ✅ | — | Append-only audit log |
| Tenant Settings | ✅ | ✅ | — | code_export, scan_base_url, branding |
| Rate Limiting | ✅ | — | — | Per-endpoint + scan quota per day |
| Idempotency | ✅ | — | — | Redis-backed |
| Dashboard | ✅ | ✅ | — | Summary, charts, funnel, geo, activity |
| Scan History | ✅ | ✅ | — | List + filter + detail |
| Transactions | ✅ | ✅ | — | List, status update, export CSV |
| Customer Mgmt | ✅ | ✅ | — | List, search, detail page, refund |
| Staff & Roles | ✅ | ✅ | — | CRUD, role-based sidebar |
| Products | ✅ | ✅ | — | CRUD, points_per_scan, CSV import |
| Factories | ✅ | ✅ | — | CRUD, link to batches |
| Lucky Draw | ✅ | ✅ | ✅ | Campaigns, prizes, draw, register |
| News & Banner | ✅ | ✅ | ✅ | CRUD, published list, consumer view |
| Support/Ticket | ✅ | ✅ | ✅ | Cases, chat, status management |
| Donation | ✅ | ✅ | ✅ | Campaigns, donate, progress tracking |
| Point Currencies | ✅ | ✅ | ✅ | Multi-currency configurable |
| API Keys | ✅ | ✅ | — | Create (SHA256), revoke, delete |
| Webhooks | ✅ | ✅ | — | CRUD, test, HMAC delivery, logs |
| Gamification | ✅ | ✅ | ✅ | Missions, badges, leaderboard |
| Mission Engine | ✅ | — | — | Auto-track progress on events |
| Notification Engine | ✅ | — | ✅ | Auto-trigger on scan/redeem/donate |
| Notifications | ✅ | — | ✅ | In-app, unread count, mark read |
| Reward Tiers | ✅ | ✅ | ✅ | CRUD, user tier calculation |
| Branding | ✅ | ✅ | ✅ | Tenant-specific theming |
| OTP (SMS) | ✅ | — | ✅ | Ants provider, rate limiting |
| File Upload | ✅ | ✅ | — | MinIO, image/file upload components |
| Geolocation | ✅ | — | — | Reverse geocoding, backfill |
| Consumer Profile | ✅ | — | ✅ | Edit profile, addresses CRUD |
| Consumer Register | ✅ | — | ✅ | OTP + profile + PDPA |
| PDPA | ✅ | — | ✅ | Consent records, withdrawal |
| DB Indexes | ✅ | — | — | Performance indexes migration |
| Redis Cache | ✅ | — | — | Response caching middleware |
| Docker Prod | ✅ | — | — | docker-compose.prod.yml |

### V2 ข้อได้เปรียบเหนือ V1

1. **Multi-Tenant** — V1 single-tenant, V2 หลายแบรนด์
2. **QR Security (HMAC-SHA256)** — ปลอมแปลงไม่ได้
3. **Zero Oversell (2-phase)** — Row-level lock + atomic reserve
4. **Immutable Ledger** — ทุก transaction บันทึก
5. **Idempotency** — กัน duplicate redeem
6. **Flexible Settings per Tenant/Campaign**
7. **Gamification** — Missions, Badges, Leaderboard
8. **Multi-Currency Points** — Configurable per tenant
9. **Coupon Code Pool** — Atomic claim, bulk import
10. **Mission Engine** — Auto-track, auto-award
11. **Notification Engine** — Event-driven notifications
12. **API Keys & Webhooks** — External integration ready
13. **PDPA Compliance** — Consent records + withdrawal
14. **Docker Self-Hosted** — ประหยัดกว่า AWS ($202/mo → ~$50/mo)

### ตัดออกจาก V1

| Feature | เหตุผล |
|---------|--------|
| **Salepage** | ไม่ใช่ core loyalty |
| **Facebook Login** | LINE เป็นช่องทางหลัก |
| **Doc Convert** | Tool เฉพาะทาง |
| **Survey** | ใช้ external embed |
| **Thailand Post auto-sync** | Tracking manual ก็พอ |
| **Diamond Point hardcode** | แทนด้วย configurable point currencies (หลายสกุลพร้อมกัน + lifecycle) |

### เสร็จเพิ่ม (2026-03-05)

| Module | Backend | Admin UI | หมายเหตุ |
|--------|---------|----------|----------|
| Roll Lifecycle | ✅ | ✅ | Pipeline view, Map Product, QC approval + evidence, separation of duties |
| V1 Product Import | ✅ | — | 150 สินค้า import + cleaned |

### เสร็จเพิ่ม (2026-03-06 — 2026-03-07)

| Module | Backend | Admin UI | Consumer UI | หมายเหตุ |
|--------|---------|----------|-------------|----------|
| Roll Management UX | — | ✅ | — | Filter bar, sorting, clickable inline filter, pagination |
| Collapsible Sidebar | — | ✅ | — | Hamburger menu, collapsed icons, localStorage persist |
| Export Improvements | ✅ | ✅ | — | Large batch export (>500K), tab-based export history, cross-batch prevention |
| Workflow Help Popup | — | ✅ | — | แบรนด์/โรงงานพิมพ์/โรงงานแปะ flow diagram |
| Responsive Tables | — | ✅ | — | overflow-x-auto, min-w สำหรับ mobile/tablet |
| Filter Staff from Customers | ✅ | — | — | Customer list/detail/dashboard แสดงเฉพาะ api_client |
| Staff Creation Fix | ✅ | ✅ | — | แก้ factory dropdown, API validation |
| Product Image Upload | ✅ | ✅ | — | Upload ไฟล์รูปตรง + URL input, labels ครบทุกช่อง |
| V1 Product Image Migration | ✅ | — | — | ดึงรูปจาก legacy S3 → upload MinIO → อัพเดท V2 |
| QC Verify Fix | ✅ | ✅ | — | แก้ field mismatch (valid/checksum_ok), แสดง product/roll info |

### เสร็จเพิ่ม (2026-03-07 — 2026-03-08)

| Module | Backend | Admin UI | Consumer UI | หมายเหตุ |
|--------|---------|----------|-------------|----------|
| LINE Login | ✅ | — | ✅ | OAuth 2.1 flow, LINE profile sync, auto-register |
| LINE Login per Tenant | ✅ | — | ✅ | LINE credentials จาก tenant settings (fallback env) |
| Custom Domain (svsu.me) | ✅ | — | — | Cloudflare Tunnel: api/admin/qr/consumer subdomains |
| Wildcard Subdomain | ✅ | — | — | `*.svsu.me` → consumer frontend |
| Consumer Tenant Detection | ✅ | — | ✅ | Detect brand จาก hostname (ไม่ใช่ env var) |
| Dynamic Branding | ✅ | — | ✅ | Fetch branding API → apply CSS vars, logo, favicon, title |
| QR Redirect | ✅ | — | — | `qr.svsu.me/s/{code}` → resolve brand → redirect |
| Public Branding API | ✅ | — | — | `GET /api/v1/public/branding-by-slug?slug=X` (no auth) |
| Public Tenant Resolve | ✅ | — | — | `GET /api/v1/public/tenant-by-slug?slug=X` (no auth) |
| Consumer Homepage Fix | — | — | ✅ | แก้ toLocaleString error, SSR hydration |
| Scan URL (qr.svsu.me) | ✅ | ✅ | — | เปลี่ยน scan_base_url → `qr.svsu.me`, QR preview ใช้ domain |
| Ref1 Display on Scan | ✅ | — | ✅ | แสดง ref1 ก่อน login + หลัง scan สำเร็จ |

### ข้อเสนอแนะหลังสำรวจ V2 + Legacy (2026-03-06)

> สำรวจเทียบจาก `saversure-legacy` เพิ่มเติมแล้ว พบว่า V2 พร้อมมากในด้าน architecture และ security แต่ยังมีบาง flow ที่ควรปิดให้ “ใช้งานจริงครบวงจร” ก่อนงาน external dependency อย่าง LINE/LIFF แบบเต็มรูปแบบ

#### Top 5 งานถัดไปที่ควรทำก่อน

1. **ปิด Reward Redemption Flow ให้จบจริง**
   - เชื่อม flow `reserve -> confirm` ให้ครบใน consumer/admin
   - ทำ coupon delivery / coupon display หลังแลกให้ลูกค้าใช้งานได้จริง
   - เหตุผล: กระทบ stock, transaction, และ UX โดยตรง

2. **ทำ Camera Scan แบบ Web Fallback ก่อน LIFF**
   - ให้ consumer scan ผ่าน browser ได้ก่อน แม้ยังไม่มี LINE credentials
   - คง deep link / LIFF เป็น phase ถัดไป
   - เหตุผล: เป็น user-facing action สำคัญที่สุดของระบบ

3. **เพิ่ม Fulfillment Flow หลังแลก + PDF Delivery Notes**
   - ย้ายจากแค่ redeem/reserve ไปสู่ flow เตรียมของ/จัดส่ง/สำเร็จ
   - สร้างใบแพ็ก/ใบจ่าหน้า PDF สำหรับงานคลัง
   - เหตุผล: legacy ใช้จริงและช่วยงาน operation มาก

4. **ทำ Daily Ops Digest + Admin Alerts**
   - สรุป pending redeem, QC fail, recalled rolls, suspicious scans, stock ใกล้หมด
   - แสดงใน admin และเตรียมต่อ LINE/Email ภายหลัง
   - เหตุผล: ช่วยทีมปฏิบัติการเห็นปัญหาเร็วขึ้น

5. **ทำ Production Safety Baseline**
   - Unit tests สำหรับ HMAC / codegen / ledger / redemption
   - Integration tests สำหรับ API สำคัญ
   - CI/CD + metrics + error tracking + uptime monitoring
   - เหตุผล: ลดความเสี่ยง regression ก่อน rollout จริง

#### สิ่งที่ได้จาก Legacy ที่ควรพอร์ตแนวคิดมาใช้

- **PDF ใบแพ็ก/ใบจ่าหน้า + fulfillment status** — practical มากสำหรับหลังบ้าน
- **Deep-link smart landing** — เลือก flow ให้เหมาะกับ device/context
- **Admin direct outreach / ops alerts** — จาก scan/redeem ปัญหาสามารถ follow-up ได้เร็ว
- **Coupon display หลังแลก** — โดยเฉพาะของรางวัลแบบ partner code / barcode / QR
- **Practical anti-abuse tools** — remark, flag, suspicious pattern review, manual correction workflow

#### ไอเดียใหม่ที่แนะนำเพิ่ม

- **Suspicious Scan Playbook**
  รวม remark, customer flag, support case, และ action ต่อเนื่องไว้ในหน้าเดียว
- **Dynamic Coupon Token**
  ออก QR/barcode แบบ single-use + expiry + audit log แทน static code
- **Factory SLA Dashboard**
  วัด turnaround time ตั้งแต่ assign -> map -> QC -> distribute แยกตามโรงงาน
- **Export Health Monitor**
  ดูประวัติ export, duplicate export, download activity, expired links, และไฟล์ที่โหลดบ่อยผิดปกติ

#### หมายเหตุ backlog ที่ควรอัปเดตสถานะ

- `Batch Status/Recall UI buttons` — ✅ ทำแล้วใน admin batches page
- `Select factory/product during batch creation` — ✅ ทำแล้วใน admin batches page
- `Roll Lifecycle` / `Export redesign` / `Factory portal` — ✅ เสร็จแล้ว ใช้เป็นฐาน phase ถัดไป
- `LINE Login` — ✅ ทำเสร็จแล้ว (OAuth 2.1, per-tenant, auto-register)
- `Custom domain (svsu.me)` — ✅ ทำเสร็จแล้ว (Cloudflare Tunnel, wildcard)
- `Multi-Brand consumer frontend` — ✅ ทำเสร็จแล้ว (hostname detection, dynamic branding)
- `Staff/Customer separation` — ✅ ทำเสร็จแล้ว (filter by role)
- `Roll Management UX` — ✅ ทำเสร็จแล้ว (sort, filter, sidebar, responsive)

#### Top 5 ปรับสถานะ (จาก 2026-03-06 recommendations)

1. **ปิด Reward Redemption Flow ให้จบจริง** — ⬜ ยังไม่ได้ทำ
2. **ทำ Camera Scan แบบ Web Fallback ก่อน LIFF** — ⬜ ยังไม่ได้ทำ
3. **เพิ่ม Fulfillment Flow หลังแลก + PDF Delivery Notes** — ⬜ ยังไม่ได้ทำ
4. **ทำ Daily Ops Digest + Admin Alerts** — ⬜ ยังไม่ได้ทำ
5. **ทำ Production Safety Baseline** — ⬜ ยังไม่ได้ทำ (tests, CI/CD, metrics)

---

## Status Refresh (2026-03-23)

This section is the latest checkpoint after code review in the current workspace.

### Confirmed Implemented Since Earlier Backlog Notes

- Reward redemption flow is already connected in backend + consumer, including coupon return and shipping address handling.
- Web QR camera fallback is already implemented in consumer via `html5-qrcode`, alongside existing LIFF hooks.
- Ops digest and admin alerts are already implemented in backend and exposed in admin `Ops Center`.
- Admin fulfillment flow is now implemented with:
  - fulfillment list page
  - status updates (`pending -> preparing -> shipped -> delivered`)
  - bulk updates
  - printable shipping labels
  - downloadable PDF delivery notes

### Recommended Next Priorities

1. Production safety baseline
   - add unit tests for redemption, ledger, codegen, and fulfillment PDF generation
   - add CI for backend/frontend type and test checks
2. Fulfillment hardening
   - add courier/provider metadata, delivery note numbering, and audit trail for PDF exports
3. Backlog cleanup
   - merge older recommendation sections with the real implementation status to avoid duplicate or outdated priorities

---

## สิ่งที่ยังเหลือ (Requires External Dependencies)

### LINE Login / LIFF

**สถานะ:** ✅ LINE Login ทำเสร็จแล้ว | ⬜ LIFF ยังไม่ได้ทำ

**เสร็จแล้ว:**
- [x] Backend: `GET /api/v1/auth/line` — OAuth 2.1 authorization URL
- [x] Backend: `POST /api/v1/auth/line/callback` — exchange code → JWT
- [x] Backend: LINE credentials per tenant (tenant settings fallback env)
- [x] Consumer: LINE Login button + callback flow
- [x] Consumer: auto-register from LINE profile (display_name, picture)
- [x] DB: email/password_hash nullable for LINE-only users

**ยังไม่ได้ทำ:**
- [ ] Backend: LINE LIFF middleware
- [ ] Config: LIFF Channel ID, LIFF App URL per tenant
- [ ] Consumer: LIFF init + login flow
- [ ] Consumer: QR camera scanner via LIFF scanCode

### LINE Bot & Notify (ต้องการ LINE credentials)

**สถานะ:** ❌ ยังไม่ได้ทำ

**งานที่ต้องทำ:**
- [ ] Backend: LINE Messaging API client
- [ ] Backend: LINE Notify → admin group alerts
- [ ] Admin UI: Send LINE from customer detail
- [ ] Consumer: LINE push notifications

### White-Label Consumer App (Multi-Brand)

**สถานะ:** ✅ ส่วนใหญ่เสร็จแล้ว

**เสร็จแล้ว:**
- [x] Custom domain: `svsu.me` + Cloudflare Tunnel
- [x] Wildcard subdomain: `*.svsu.me` → consumer
- [x] Tenant detection from hostname (subdomain → slug → tenant_id)
- [x] Dynamic branding: fetch branding API → apply CSS vars, logo, favicon
- [x] LINE credentials per tenant (stored in tenant settings)
- [x] QR redirect: `qr.svsu.me/s/{code}` → resolve brand → redirect

**ยังไม่ได้ทำ:**
- [ ] LIFF per tenant (ต้อง LINE OA per brand)
- [ ] Rich menu per brand

---

## Status Refresh (2026-03-23)

This section is the latest checkpoint after code review in the current workspace.

### Confirmed Implemented Since Earlier Backlog Notes

- Reward redemption flow is already connected in backend + consumer, including coupon return and shipping address handling.
- Web QR camera fallback is already implemented in consumer via `html5-qrcode`, alongside existing LIFF hooks.
- Ops digest and admin alerts are already implemented in backend and exposed in admin `Ops Center`.
- Admin fulfillment flow is now implemented with:
  - fulfillment list page
  - status updates (`pending -> preparing -> shipped -> delivered`)
  - bulk updates
  - printable shipping labels
  - downloadable PDF delivery notes

### Recommended Next Priorities

1. Production safety baseline
   - add unit tests for redemption, ledger, codegen, and fulfillment PDF generation
   - add CI for backend/frontend type and test checks
2. Fulfillment hardening
   - add courier/provider metadata, delivery note numbering, and audit trail for PDF exports
3. Backlog cleanup
   - merge older recommendation sections with the real implementation status to avoid duplicate or outdated priorities

---

## Multi-Brand Strategy & Central Platform (วางแผนแล้ว — ยังไม่ implement)

> สรุปจากการพูดคุยเมื่อ 2026-03-08
> สถานะ: **อยู่ระหว่างวางแผน** — ยังไม่เปลี่ยนโค้ด

### Domain Structure

```
svsu.me (V2 — Multi-Brand Platform)
├── api.svsu.me           → Shared Backend API (multi-tenant)
├── admin.svsu.me         → Shared Admin Panel (tenant selector inside)
├── qr.svsu.me            → QR Redirect (resolve brand → redirect)
│   └── /jh/A6FPZKTQL6    → URL มี brand shortcode + ref1
│   └── /b2/XXXXXXXXXX    → แต่ละ brand มี shortcode ต่างกัน
├── julasherb.svsu.me     → Consumer: Jula'sHerb
├── brand2.svsu.me        → Consumer: Brand 2
├── brand3.svsu.me        → Consumer: Brand 3
└── app.svsu.me           → (อนาคต) Saversure Central App

saversure.com (Legacy V1 — Jula'sHerb only)
├── julaherb.saversure.com      → V1 Consumer (รันอยู่)
├── admin-web.julaherb.saversure.com → V1 Admin (รันอยู่)
└── qr.saversure.com            → V1 QR Scan (รันอยู่)
```

### QR Scan URL Format (ตกลงแล้ว)

**รูปแบบ:** `qr.svsu.me/{brand_shortcode}/{ref1}`

**ตัวอย่าง:**
- `qr.svsu.me/jh/A6FPZKTQL6` → Jula'sHerb, ref1 = `A6FPZKTQL6`
- `qr.svsu.me/b2/XXXXXXXXXX` → Brand 2

**Flow การทำงาน:**
1. ลูกค้าสแกน QR → เข้า `qr.svsu.me/jh/A6FPZKTQL6`
2. Backend resolve `jh` → tenant slug = `julasherb`
3. Redirect ไป `julasherb.svsu.me/s/A6FPZKTQL6`
4. Consumer frontend แสดงหน้าสะสมแต้ม + branding ของ Jula'sHerb

**ข้อดีของรูปแบบนี้:**
- URL อ่านง่าย, ref1 สั้น (ไม่มี brand prefix ใน ref1)
- ลูกค้าที่ซื้อสินค้ารู้อยู่แล้วว่าเป็นแบรนด์ไหน (สติ๊กเกอร์มีลายแบรนด์)
- Backend สามารถ resolve brand จาก shortcode ใน URL ได้เลย
- ไม่มีปัญหา ref1 ซ้ำข้ามแบรนด์ (resolve จาก URL path ไม่ใช่ ref1)

### LINE Integration (per Brand)

**จำนวน LINE OA ที่ต้องมี: 3 OA = 3 แบรนด์**

| Brand | LINE OA | หน้าที่ |
|-------|---------|---------|
| Jula'sHerb | @julasherb | Consumer login, push notification, rich menu → `julasherb.svsu.me` |
| Brand 2 | @brand2 | Consumer login, push notification, rich menu → `brand2.svsu.me` |
| Brand 3 | @brand3 | Consumer login, push notification, rich menu → `brand3.svsu.me` |

- LINE Login credentials เก็บใน tenant settings (ระบบรองรับแล้ว)
- Rich Menu แต่ละ OA ชี้ไปหน้า consumer ของ brand นั้น
- LIFF (ถ้าจะใช้): ต้องสร้าง LIFF App per LINE OA

### Central Saversure Platform (อนาคต)

**Vision:** แอปส่วนกลาง `app.svsu.me` (หรือ Saversure app) ที่:
1. ลูกค้าเห็นแต้มของแต่ละ brand แยกกัน (Jula'sHerb 500 pts, Brand2 200 pts)
2. แลก Brand Point → Saversure Point ตามอัตราที่กำหนด
3. Saversure ส่วนกลางจัดกิจกรรม (ชิงโชค, แจกของรางวัล) ด้วย Saversure Point
4. ลูกค้าเชื่อม LINE account เดียวกับหลาย brand ได้

**สถานะระบบปัจจุบัน:**
- ✅ Multi-tenant isolation (แต้มแยกตาม tenant อยู่แล้ว)
- ✅ Point ledger per tenant
- ✅ LINE Login per tenant
- ⬜ Cross-tenant user identity (ผูก user ข้ามแบรนด์ด้วย LINE user_id / เบอร์โทร)
- ⬜ "Saversure Point" (platform-level currency)
- ⬜ Point Exchange Engine (Brand Point → Saversure Point)
- ⬜ Central activity/lucky draw (platform-level campaigns)
- ⬜ Central app frontend (app.svsu.me)

**Technical Requirements (ยังไม่ implement):**
```
1. cross_tenant_identity table
   - platform_user_id (UUID)
   - tenant_id + user_id → link to per-brand user
   - identity_key (line_user_id / phone)
   - ลูกค้าคนเดียวมีหลาย tenant user records

2. platform_point_ledger
   - สกุล: "saversure_point"
   - credit/debit เหมือน per-tenant ledger
   - reference_type: "brand_exchange" (แลกจาก brand point มา)

3. Point Exchange API
   - POST /api/v1/exchange
   - body: { from_tenant_id, amount, rate }
   - debit brand points → credit saversure points (atomic)

4. Central campaigns / lucky draw
   - campaigns ที่ tenant_id = null (platform-level)
   - ใช้ saversure_point แทน brand point
```

---

## Status Refresh (2026-03-23)

This section is the latest checkpoint after code review in the current workspace.

### Confirmed Implemented Since Earlier Backlog Notes

- Reward redemption flow is already connected in backend + consumer, including coupon return and shipping address handling.
- Web QR camera fallback is already implemented in consumer via `html5-qrcode`, alongside existing LIFF hooks.
- Ops digest and admin alerts are already implemented in backend and exposed in admin `Ops Center`.
- Admin fulfillment flow is now implemented with:
  - fulfillment list page
  - status updates (`pending -> preparing -> shipped -> delivered`)
  - bulk updates
  - printable shipping labels
  - downloadable PDF delivery notes

### Recommended Next Priorities

1. Production safety baseline
   - add unit tests for redemption, ledger, codegen, and fulfillment PDF generation
   - add CI for backend/frontend type and test checks
2. Fulfillment hardening
   - add courier/provider metadata, delivery note numbering, and audit trail for PDF exports
3. Backlog cleanup
   - merge older recommendation sections with the real implementation status to avoid duplicate or outdated priorities

---

## สิ่งที่ยังเหลือ (Nice-to-have / Future)

### Admin Enhancements
- [x] Roll Management UX: filter bar, sorting, clickable filters, pagination
- [x] Collapsible sidebar (hamburger menu, localStorage persist)
- [x] Export improvements (large batch, export history tab, cross-batch prevention)
- [x] Workflow help popup (brand/factory flow diagram)
- [x] Responsive tables (mobile/tablet scrollable)
- [x] Product image upload (file + URL)
- [x] Product form labels (ครบทุกช่อง)
- [x] QC Verify result display (product, roll, status info)
- [ ] Bulk status update for transactions
- [ ] Export PDF delivery notes
- [ ] Admin notification bell + dropdown
- [ ] Brand admin scoped dashboard
- [ ] Daily Ops digest / operational alert center
- [ ] Suspicious scan review tools (remark, flag, action playbook)

### Consumer Enhancements
- [x] LINE Login (OAuth flow, auto-register)
- [x] Dynamic branding (CSS vars, logo, favicon per brand)
- [x] Tenant detection from hostname
- [x] Ref1 display on scan page (before + after login)
- [ ] QR camera scanner (native/LIFF)
- [ ] Deep link flow (scan QR → LIFF → auto-verify)
- [ ] Web camera scanner fallback (non-LIFF)
- [ ] Coupon display (QR/barcode)
- [ ] Flash reward countdown timer
- [ ] Auto-schedule flash rewards
- [ ] Smart scan landing based on device/context

### Backend Enhancements
- [x] LINE Login per tenant (credentials from tenant settings)
- [x] Public branding/tenant APIs (no auth needed)
- [x] QR redirect endpoint (`/s/:code` → resolve brand → redirect)
- [x] Filter staff from customer lists (api_client role only)
- [x] Staff creation fix (factory dropdown, validation)
- [x] V1 product image migration (S3 → MinIO)
- [ ] **QR URL format: brand shortcode in path** (qr.svsu.me/jh/A6FPZKTQL6) — ยังไม่ implement
- [ ] Leaderboard refresh job (cron)
- [ ] Fraud detection rules (real-time)
  - สแกนเกิน X ครั้ง/วัน → ระงับ
  - IP-based fraud detection
- [ ] Streaming CSV for large batch exports
- [ ] Rate limiting per tenant
- [ ] Tier rules configurable per tenant
- [ ] Reward redemption confirm flow end-to-end
- [ ] Fulfillment workflow after redeem (prepare / shipping / completed)
- [ ] Dynamic coupon token with single-use / expiry / audit log
- [ ] Factory SLA metrics + export health metrics
- [ ] Cross-tenant user identity (central platform)
- [ ] Platform point ledger (Saversure Point)
- [ ] Point Exchange Engine (Brand → Saversure Point)

### Phase 6 — Non-Functional (Ongoing)

**Done:**
- [x] Database indexing review (migration 011)
- [x] Redis caching middleware
- [x] Docker production config
- [x] PDPA consent flow
- [x] Health check endpoint
- [x] Structured JSON logging

**Remaining:**
- [ ] Unit tests — codegen, HMAC, ref1/ref2, ledger
- [ ] Integration tests — API endpoints
- [ ] Load testing — concurrent scan + redeem
- [ ] CI/CD (GitHub Actions)
- [ ] DB migration automation
- [ ] Prometheus metrics endpoint
- [ ] Sentry error tracking
- [ ] Uptime monitoring

---

## Status Refresh (2026-03-23)

This section is the latest checkpoint after code review in the current workspace.

### Confirmed Implemented Since Earlier Backlog Notes

- Reward redemption flow is already connected in backend + consumer, including coupon return and shipping address handling.
- Web QR camera fallback is already implemented in consumer via `html5-qrcode`, alongside existing LIFF hooks.
- Ops digest and admin alerts are already implemented in backend and exposed in admin `Ops Center`.
- Admin fulfillment flow is now implemented with:
  - fulfillment list page
  - status updates (`pending -> preparing -> shipped -> delivered`)
  - bulk updates
  - printable shipping labels
  - downloadable PDF delivery notes

### Recommended Next Priorities

1. Production safety baseline
   - add unit tests for redemption, ledger, codegen, and fulfillment PDF generation
   - add CI for backend/frontend type and test checks
2. Fulfillment hardening
   - add courier/provider metadata, delivery note numbering, and audit trail for PDF exports
3. Backlog cleanup
   - merge older recommendation sections with the real implementation status to avoid duplicate or outdated priorities

---

## API Endpoints Summary

### Auth (Public)
```
POST   /api/v1/auth/register           — Email registration (admin)
POST   /api/v1/auth/register-consumer  — OTP + profile registration (consumer)
POST   /api/v1/auth/login              — Email login
POST   /api/v1/auth/login-phone        — Phone login
POST   /api/v1/auth/refresh            — Refresh token
POST   /api/v1/otp/request             — Request OTP
POST   /api/v1/otp/verify              — Verify OTP
GET    /api/v1/auth/line               — LINE Login authorization URL (per tenant)
POST   /api/v1/auth/line/callback      — LINE Login callback (exchange code → JWT)
```

### Admin APIs
```
— Dashboard —
GET    /api/v1/dashboard/summary
GET    /api/v1/dashboard/scan-chart
GET    /api/v1/dashboard/top-products
GET    /api/v1/dashboard/funnel
GET    /api/v1/dashboard/geo-heatmap
GET    /api/v1/dashboard/recent-activity

— Tenants —
POST/GET/PATCH  /api/v1/tenants

— Campaigns —
POST/GET/PATCH  /api/v1/campaigns
POST   /api/v1/campaigns/:id/publish

— Batches —
POST/GET  /api/v1/batches
GET    /api/v1/batches/:id/export
PATCH  /api/v1/batches/:id/status
POST   /api/v1/batches/:id/recall

— Rewards & Inventory —
POST/GET  /api/v1/rewards
PATCH  /api/v1/rewards/:id/inventory

— Transactions —
GET    /api/v1/redeem-transactions
PATCH  /api/v1/redeem-transactions/:id
GET    /api/v1/redeem-transactions/export

— Points —
GET    /api/v1/points/balance
GET    /api/v1/points/history
POST   /api/v1/points/refund

— Customers —
GET    /api/v1/customers
GET    /api/v1/customers/:id
GET    /api/v1/customers/:id/detail
PATCH  /api/v1/customers/:id

— Products —
CRUD   /api/v1/products
POST   /api/v1/products/import

— Factories, Staff, News, Support, Lucky Draw, Donations —
CRUD endpoints (all done)

— Currencies, API Keys, Webhooks, Gamification —
CRUD endpoints (all done)

— Tiers, Branding, Coupons —
CRUD endpoints (all done)

— Scan History, Audit —
GET endpoints (all done)

— Upload —
POST   /api/v1/upload/image
POST   /api/v1/upload/file

— Geo —
GET    /api/v1/geo/reverse
POST   /api/v1/geo/backfill
```

### Consumer (Public) APIs
```
GET    /api/v1/public/news
GET    /api/v1/public/lucky-draw
GET    /api/v1/public/donations
GET    /api/v1/public/missions
GET    /api/v1/public/leaderboard
GET    /api/v1/public/badges
GET    /api/v1/public/tiers
GET    /api/v1/public/branding
GET    /api/v1/public/branding-by-slug  — Branding by tenant slug (multi-brand)
GET    /api/v1/public/tenant-by-slug    — Resolve tenant from slug
GET    /api/v1/public/resolve-ref1      — Convert compact code → ref1
GET    /api/v1/public/rewards
GET    /api/v1/public/rewards/:id
```

### QR Redirect (Root-level)
```
GET    /s/:code                         — Resolve code → brand → redirect to consumer
```

### Consumer (Authenticated) APIs
```
POST   /api/v1/scan
POST   /api/v1/redeem
GET    /api/v1/my/balances
GET    /api/v1/my/missions
GET    /api/v1/my/badges
GET    /api/v1/my/tier
GET    /api/v1/my/pdpa
POST   /api/v1/my/pdpa/withdraw
POST   /api/v1/my/lucky-draw/:id/register
POST   /api/v1/my/donations/:id/donate
GET/PATCH  /api/v1/profile
CRUD   /api/v1/profile/addresses
GET    /api/v1/notifications
GET    /api/v1/notifications/unread-count
PATCH  /api/v1/notifications/:id/read
POST   /api/v1/notifications/read-all
CRUD   /api/v1/support/my-cases
```

---

## Status Refresh (2026-03-23)

This section is the latest checkpoint after code review in the current workspace.

### Confirmed Implemented Since Earlier Backlog Notes

- Reward redemption flow is already connected in backend + consumer, including coupon return and shipping address handling.
- Web QR camera fallback is already implemented in consumer via `html5-qrcode`, alongside existing LIFF hooks.
- Ops digest and admin alerts are already implemented in backend and exposed in admin `Ops Center`.
- Admin fulfillment flow is now implemented with:
  - fulfillment list page
  - status updates (`pending -> preparing -> shipped -> delivered`)
  - bulk updates
  - printable shipping labels
  - downloadable PDF delivery notes

### Recommended Next Priorities

1. Production safety baseline
   - add unit tests for redemption, ledger, codegen, and fulfillment PDF generation
   - add CI for backend/frontend type and test checks
2. Fulfillment hardening
   - add courier/provider metadata, delivery note numbering, and audit trail for PDF exports
3. Backlog cleanup
   - merge older recommendation sections with the real implementation status to avoid duplicate or outdated priorities

---

---

## Status Refresh (2026-03-23)

This section is the latest checkpoint after code review in the current workspace.

### Confirmed Implemented Since Earlier Backlog Notes

- Reward redemption flow is already connected in backend + consumer, including coupon return and shipping address handling.
- Web QR camera fallback is already implemented in consumer via `html5-qrcode`, alongside existing LIFF hooks.
- Ops digest and admin alerts are already implemented in backend and exposed in admin `Ops Center`.
- Admin fulfillment flow is now implemented with:
  - fulfillment list page
  - status updates (`pending -> preparing -> shipped -> delivered`)
  - bulk updates
  - printable shipping labels
  - downloadable PDF delivery notes

### Recommended Next Priorities

1. Production safety baseline
   - add unit tests for redemption, ledger, codegen, and fulfillment PDF generation
   - add CI for backend/frontend type and test checks
2. Fulfillment hardening
   - add courier/provider metadata, delivery note numbering, and audit trail for PDF exports
3. Backlog cleanup
   - merge older recommendation sections with the real implementation status to avoid duplicate or outdated priorities

---

## Roll Lifecycle Management (Done: 2026-03-05)

ระบบจัดการม้วนสติ๊กเกอร์ QR Code แบบ strict workflow เพื่อป้องกัน staff map product ผิด

**Workflow:** `pending_print → printed → mapped → qc_approved → distributed`

**กฎสำคัญ:**
- ลูกค้าสแกน QR ได้เฉพาะ roll ที่ผ่าน QC (`qc_approved` / `distributed`) เท่านั้น
- QC ต้องแนบรูปถ่ายหลักฐานถึงจะ approve ได้
- คนที่ map product กับคนที่ QC approve ต้องเป็นคนละคน (separation of duties)
- Bulk operations: Mark Printed, Map Product, Mark Distributed
- Backward compatible กับ batch เก่าที่ไม่มี rolls

**ไฟล์:**
- Migration: `013_rolls.up.sql`
- Backend: `internal/roll/service.go`, `handler.go`
- Frontend: `app/(admin)/rolls/page.tsx`
- แก้ไข: `batch/service.go` (auto-create rolls), `code/service.go` (roll status check), `qc/service.go` (roll info)

---

## Status Refresh (2026-03-23)

This section is the latest checkpoint after code review in the current workspace.

### Confirmed Implemented Since Earlier Backlog Notes

- Reward redemption flow is already connected in backend + consumer, including coupon return and shipping address handling.
- Web QR camera fallback is already implemented in consumer via `html5-qrcode`, alongside existing LIFF hooks.
- Ops digest and admin alerts are already implemented in backend and exposed in admin `Ops Center`.
- Admin fulfillment flow is now implemented with:
  - fulfillment list page
  - status updates (`pending -> preparing -> shipped -> delivered`)
  - bulk updates
  - printable shipping labels
  - downloadable PDF delivery notes

### Recommended Next Priorities

1. Production safety baseline
   - add unit tests for redemption, ledger, codegen, and fulfillment PDF generation
   - add CI for backend/frontend type and test checks
2. Fulfillment hardening
   - add courier/provider metadata, delivery note numbering, and audit trail for PDF exports
3. Backlog cleanup
   - merge older recommendation sections with the real implementation status to avoid duplicate or outdated priorities

---

## Point System Design (V1 → V2 Migration Strategy)

### V1 มีอะไร

**3 ประเภทแต้มใน V1:**

| ประเภท | ลักษณะ | ตัวอย่าง |
|--------|--------|---------|
| **Point** (หลัก) | ได้ทุกครั้งที่สแกน, สะสมตลอด | สแกนแชมพู → ได้ 24 point |
| **Extra Point** | โบนัสชั่วคราว, ผูกช่วงเวลา | "1-31 มี.ค. สแกนสินค้า A ได้เพิ่ม 10 แต้ม" |
| **Diamond** | สกุลแยก, ผูกกิจกรรมพิเศษ | "สะสม Diamond แลกบัตร FAN MEET" |

**ปัญหาของ V1:**
1. Diamond มีแค่ประเภทเดียว → จัดกิจกรรม 2 อันพร้อมกันไม่ได้
2. Diamond ไม่มีวันหมดอายุ → กิจกรรมจบแล้ว Diamond ยังค้างอยู่
3. ไม่มีระบบ convert Diamond กลับเป็น Point เมื่อกิจกรรมจบ
4. Extra Point config อยู่ใน product level → ยากจะจัดการ

### V2 แนวทาง: Point หลัก + Campaign Promotions + Event Currencies

```
┌─────────────────────────────────────────────────────┐
│  Point (สกุลหลัก)                                    │
│  - ได้จาก products.points_per_scan                   │
│  - ไม่หมดอายุ                                        │
│  - ใช้แลกของรางวัลทั่วไป                              │
│  - accumulate_point → คำนวณระดับสมาชิก (Tier)         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Promotional Bonus (แทน Extra Point)                 │
│  - ผูกกับ Campaign + ช่วงเวลา                        │
│  - "สแกนสินค้า A ช่วง 1-31 มี.ค. ได้เพิ่ม 10 point"  │
│  - เครดิตเป็น Point หลัก (ไม่ใช่สกุลแยก)              │
│  - จัดการผ่าน Campaign settings                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Event Currencies (แทน Diamond — ปรับปรุง)            │
│  - สร้างได้หลายสกุลพร้อมกัน (Star, Diamond, etc.)    │
│  - ผูกกับ Campaign + มีวันหมดอายุ                     │
│  - เมื่อหมดอายุ: convert เป็น Point หรือหายไป          │
│  - ใช้แลกเฉพาะ Rewards ที่ผูกกับ Campaign นั้น        │
│  - ใช้ point_currencies table ที่มีอยู่แล้ว             │
└─────────────────────────────────────────────────────┘
```

### Migration Plan (V1 → V2)

**ข้อมูลลูกค้า:**
- `users.point` → credit เข้า V2 point_ledger (currency = 'point')
- `users.diamond_point` → convert เป็น Point ตามอัตราที่กำหนด (เช่น 1 Diamond = 10 Point)
  - เหตุผล: กิจกรรม Diamond V1 จบแล้ว ไม่มี reward ให้แลก
- `users.accumulate_point` → เก็บไว้ใน V2 user profile สำหรับ Tier calculation
- ลูกค้าต้องไม่รู้สึกสะดุด — ยอดแต้มหลังย้ายต้องเท่าเดิมหรือมากกว่า

**ข้อมูลสินค้า:** (เสร็จแล้ว)
- `products.points` → `products.points_per_scan` ✅
- `products.extra_points` / `diamond_point` → บันทึกไว้ใน description เพื่ออ้างอิง ✅

**สิ่งที่ต้องทำเพิ่ม:**
- [ ] กำหนดอัตราแปลง Diamond → Point (ต้องคุยกับเจ้าของ brand)
- [ ] Script migrate user balances: point + (diamond × rate)
- [ ] Script migrate scan history (เฉพาะที่จำเป็น)
- [ ] เพิ่ม lifecycle fields ใน point_currencies: `campaign_id`, `expires_at`, `expiry_action`
- [ ] Wire multi-currency เข้า ledger Credit/Debit (ส่ง currency parameter)
- [ ] Wire products.point_currency เข้า Scan flow
- [ ] Promotional Bonus Rules: campaign-level bonus points ตามช่วงเวลา

---

## Status Refresh (2026-03-23)

This section is the latest checkpoint after code review in the current workspace.

### Confirmed Implemented Since Earlier Backlog Notes

- Reward redemption flow is already connected in backend + consumer, including coupon return and shipping address handling.
- Web QR camera fallback is already implemented in consumer via `html5-qrcode`, alongside existing LIFF hooks.
- Ops digest and admin alerts are already implemented in backend and exposed in admin `Ops Center`.
- Admin fulfillment flow is now implemented with:
  - fulfillment list page
  - status updates (`pending -> preparing -> shipped -> delivered`)
  - bulk updates
  - printable shipping labels
  - downloadable PDF delivery notes

### Recommended Next Priorities

1. Production safety baseline
   - add unit tests for redemption, ledger, codegen, and fulfillment PDF generation
   - add CI for backend/frontend type and test checks
2. Fulfillment hardening
   - add courier/provider metadata, delivery note numbering, and audit trail for PDF exports
3. Backlog cleanup
   - merge older recommendation sections with the real implementation status to avoid duplicate or outdated priorities

---

## WeOrder × SaversureV2 Integration (Future Roadmap)

### Business Goal

ผูกข้อมูลลูกค้าจาก e-commerce platform (WeOrder) กับระบบ loyalty (SaversureV2)
เพราะ platform e-commerce ไม่ให้ข้อมูลลูกค้าโดยตรง

### Concept

```
┌──────────────┐    QR in box    ┌──────────────────┐
│   WeOrder    │ ──────────────→ │   SaversureV2    │
│ (E-Commerce) │                 │   (Loyalty)      │
│              │                 │                  │
│ สั่งซื้อ      │   ลูกค้าสแกน    │ ได้แต้มฟรี        │
│ Order #1234  │   QR ในกล่อง    │ + ผูก identity    │
└──────────────┘                 └──────────────────┘
```

**Flow:**
1. ลูกค้าสั่งซื้อสินค้าผ่าน WeOrder
2. กล่องพัสดุมี QR code (print จาก SaversureV2 batch)
3. ลูกค้ารับของ → สแกน QR → ได้แต้มสะสมฟรี
4. ระบบ map: Order ID (WeOrder) ↔ Customer ID (SaversureV2)
5. ได้ข้อมูลลูกค้า: เบอร์โทร, ที่อยู่, พฤติกรรมซื้อ

### Technical Design (Draft)

**Phase 1: QR in Box (ง่ายสุด)**
- WeOrder สร้าง order → request QR จาก SaversureV2 batch
- แนบ QR ไปในกล่อง (print หรือ sticker)
- ลูกค้าสแกน → ได้แต้ม + ผูก order_ref ไว้ใน scan metadata
- ไม่ต้อง integrate API ลึก — แค่จอง serial range ให้ WeOrder

**Phase 2: Deep Integration (ถ้าต้องการ)**
- WeOrder webhook → SaversureV2: "Order confirmed, assign QR"
- SaversureV2 API → WeOrder: "Customer scanned, here's their profile"
- Shared customer identity (phone number as key)
- Cross-platform rewards: ซื้อของออนไลน์ ได้แต้มแลกของที่ร้าน

### สิ่งที่ต้องทำ
- [ ] Design: QR allocation flow (WeOrder requests batch/serial range)
- [ ] Backend: API endpoint สำหรับ allocate QR ให้ external system
- [ ] Backend: Scan metadata field เก็บ `source` + `order_ref`
- [ ] Backend: Webhook เมื่อลูกค้าสแกน → แจ้ง WeOrder
- [ ] WeOrder: Integration client เรียก SaversureV2 API
- [ ] Dashboard: แสดง scan source (e-commerce vs offline)

---

## Status Refresh (2026-03-23)

This section is the latest checkpoint after code review in the current workspace.

### Confirmed Implemented Since Earlier Backlog Notes

- Reward redemption flow is already connected in backend + consumer, including coupon return and shipping address handling.
- Web QR camera fallback is already implemented in consumer via `html5-qrcode`, alongside existing LIFF hooks.
- Ops digest and admin alerts are already implemented in backend and exposed in admin `Ops Center`.
- Admin fulfillment flow is now implemented with:
  - fulfillment list page
  - status updates (`pending -> preparing -> shipped -> delivered`)
  - bulk updates
  - printable shipping labels
  - downloadable PDF delivery notes

### Recommended Next Priorities

1. Production safety baseline
   - add unit tests for redemption, ledger, codegen, and fulfillment PDF generation
   - add CI for backend/frontend type and test checks
2. Fulfillment hardening
   - add courier/provider metadata, delivery note numbering, and audit trail for PDF exports
3. Backlog cleanup
   - merge older recommendation sections with the real implementation status to avoid duplicate or outdated priorities

---

## Database Migrations Summary

| # | File | Description |
|---|------|-------------|
| 001 | initial_schema | tenants, users, user_roles, campaigns, batches, codes, rewards, etc. |
| 002 | add_tracking_and_status | lucky_draw_campaigns, prizes, tickets, winners |
| 003 | products_factories | products, factories |
| 004 | news_support_luckydraw | news, support_cases, support_messages, lucky draw |
| 005 | donation_notification | donations, donation_histories, notifications |
| 006 | configurable_point_types | point_currencies, currency columns |
| 007 | api_keys_webhooks | api_keys, webhooks, webhook_logs |
| 008 | gamification | missions, user_missions, badges, user_badges, leaderboard |
| 009 | flash_reward_tiers | reward_tiers, flash columns, tenant branding |
| 010 | consumer_enhancements | user profile fields, user_addresses, coupon_codes, scan enhancements |
| 011 | performance_indexes | Performance indexes for all high-traffic tables |
| 012 | pdpa_deletion_requested | deletion_requested_at column on users |
| 013 | rolls | rolls table, batch codes_per_roll, roll lifecycle indexes |
| 014 | promotions | promotion rules, campaign promotions |
| 015 | promotion_enhancements | promotion enhancements |
| 016 | promotion_bonus_rules | promotion bonus rules |
| 017 | customer_v1_fields | V1 customer fields (province, occupation, customer_flag, v1_user_id) |
| 018 | ref2_running_number | ref2 running number fields |
| 019 | export_redesign | export_logs redesign (batches array, roll tracking) |
| 020 | factory_export_format | factory export format settings |
| 021 | factory_user_link | factory-user link (staff → factory assignment) |
| 022 | redemption_coupon_code | redemption coupon code fields |
| 023 | line_login_nullable_email | email/password_hash nullable for LINE-only users |

---

## Status Refresh (2026-03-23)

This section is the latest checkpoint after code review in the current workspace.

### Confirmed Implemented Since Earlier Backlog Notes

- Reward redemption flow is already connected in backend + consumer, including coupon return and shipping address handling.
- Web QR camera fallback is already implemented in consumer via `html5-qrcode`, alongside existing LIFF hooks.
- Ops digest and admin alerts are already implemented in backend and exposed in admin `Ops Center`.
- Admin fulfillment flow is now implemented with:
  - fulfillment list page
  - status updates (`pending -> preparing -> shipped -> delivered`)
  - bulk updates
  - printable shipping labels
  - downloadable PDF delivery notes

### Recommended Next Priorities

1. Production safety baseline
   - add unit tests for redemption, ledger, codegen, and fulfillment PDF generation
   - add CI for backend/frontend type and test checks
2. Fulfillment hardening
   - add courier/provider metadata, delivery note numbering, and audit trail for PDF exports
3. Backlog cleanup
   - merge older recommendation sections with the real implementation status to avoid duplicate or outdated priorities

---

## V1 Production Reference

ดูไฟล์ `V1_PRODUCTION_REFERENCE.md` สำหรับข้อมูล:
- LINE credentials (Channel IDs, Tokens, LIFF IDs)
- SMS/OTP credentials (Ants)
- AWS services ที่ V1 ใช้
- V1 cost breakdown