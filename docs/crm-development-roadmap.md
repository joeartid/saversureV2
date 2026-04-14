# CRM Development Roadmap — SaversureV2

> สร้างเมื่อ: 2026-04-10
> สถานะ: อยู่ระหว่าง V1→V2 transition — ออกแบบให้ทำงานร่วมกับ V1 live sync ได้

## สถานะปัจจุบัน

SaversureV2 เป็น **Loyalty Platform** ที่แข็งแรง (QR → scan → point → redeem → fulfill ครบ) แต่ยังขาดความสามารถ CRM เชิงรุกเกือบทั้งหมด

| ด้าน | ความพร้อม |
|------|----------|
| CRM เชิงรับ (Reactive) | ~75% |
| CRM เชิงรุก (Proactive) | ~5% |

## หลักการออกแบบ

1. **V1-V2 Coexistence** — ทุก feature ใหม่ต้องทำงานกับข้อมูลที่มาจากทั้ง V1 (legacy sync) และ V2 (native) ได้โดยไม่ต้อง re-process
2. **AWS Cost Awareness** — ไม่ดึงข้อมูลจาก V1 AWS RDS เพิ่มเติมเกินจำเป็น; ใช้ข้อมูลที่ sync มาอยู่แล้วใน V2 local DB เป็นหลัก
3. **Pre-computed > Real-time** — ใช้ summary table / rollup แทนการ query raw table ตรงทุกครั้ง (แนวทางเดียวกับ `analytics_scan_rollups` ที่ทำไปแล้ว)
4. **Incremental Build** — ไม่สร้าง "big bang CRM" แต่เพิ่มทีละ layer ที่ใช้งานได้จริงทันที
5. **Background Compute** — งาน heavy ทำใน background scheduler (เหมือน `analyticswarm`) ไม่ block request

---

## Phase 1 — Customer Tags + Segmentation Foundation (สัปดาห์ 1-2)

> เป้าหมาย: Admin สามารถติด tag ลูกค้า และสร้าง segment จากเงื่อนไขได้

### 1.1 Customer Tags

**Database**
```sql
-- ตาราง tag กำหนดเอง
CREATE TABLE customer_tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    name        TEXT NOT NULL,
    color       TEXT DEFAULT '#6366f1',
    auto_rule   JSONB,            -- NULL = manual, มีค่า = auto-assign
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

-- junction table: user ↔ tag (many-to-many)
CREATE TABLE customer_tag_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID NOT NULL,
    tag_id      UUID NOT NULL REFERENCES customer_tags(id) ON DELETE CASCADE,
    assigned_by TEXT,              -- 'admin' | 'auto' | 'import'
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (tenant_id, user_id, tag_id)
);
CREATE INDEX idx_cta_user ON customer_tag_assignments (tenant_id, user_id);
CREATE INDEX idx_cta_tag  ON customer_tag_assignments (tenant_id, tag_id);
```

**Backend**
- CRUD API สำหรับ `customer_tags` (สร้าง/แก้ไข/ลบ tag)
- API assign/remove tag จาก customer (เดี่ยวและ bulk)
- ดึง tags ของ customer ใน `GET /customers/:id` และ `GET /customers`

**Frontend**
- หน้าจัดการ tags (settings หรือ tab ใหม่)
- แสดง tag badges บน customer list + customer detail
- Bulk assign tag จาก customer list (checkbox → assign tag)

**V1 Awareness**
- Tags เป็น V2-only feature — ไม่ต้องดึงอะไรจาก V1
- ลูกค้าที่ sync จาก V1 สามารถติด tag ได้ทันทีเพราะ user อยู่ใน V2 DB แล้ว

---

### 1.2 Customer Segments

**Database**
```sql
CREATE TABLE customer_segments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    name          TEXT NOT NULL,
    description   TEXT,
    rules         JSONB NOT NULL,   -- เงื่อนไข segment (ดูโครงสร้างด้านล่าง)
    cached_count  INT DEFAULT 0,    -- จำนวน members ล่าสุดที่คำนวณได้
    cached_at     TIMESTAMPTZ,
    created_by    UUID,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Segment Rules Schema (JSONB)**
```json
{
  "operator": "AND",
  "conditions": [
    { "field": "scan_count", "op": ">=", "value": 10 },
    { "field": "last_scan_days_ago", "op": "<=", "value": 30 },
    { "field": "point_balance", "op": ">=", "value": 100 },
    { "field": "province", "op": "in", "value": ["กรุงเทพ", "นนทบุรี"] },
    { "field": "tag", "op": "has", "value": "VIP" },
    { "field": "created_days_ago", "op": ">=", "value": 90 }
  ]
}
```

**Backend**
- CRUD API สำหรับ segments
- `GET /segments/:id/preview` — preview จำนวน + ตัวอย่าง members 20 คน (ไม่ cache)
- `POST /segments/:id/refresh` — คำนวณ count ใหม่ เก็บใน `cached_count`
- Segment evaluation query: สร้าง SQL WHERE clause จาก `rules` JSONB

**Performance**
- Segment count ใช้ `cached_count` ที่ precompute ใน background (ไม่ query real-time ทุกครั้ง)
- Preview limit 20 rows + timeout 5s
- ข้อมูล `scan_count`, `point_balance`, `last_scan_days_ago` ใช้จาก V2 local DB (ไม่ query V1)

**สิ่งที่ไม่ต้องทำ**
- ❌ ไม่ต้อง materialize member list (เก็บ user_id ไว้ใน table) — ใช้ query-based evaluation
- ❌ ไม่ต้องดึงข้อมูลใหม่จาก V1 — ใช้ข้อมูลที่ sync มาแล้ว

---

### 1.3 RFM Snapshot (Pre-computed Customer Metrics)

> หัวใจของ CRM — คำนวณ Recency/Frequency/Monetary ไว้ล่วงหน้าเพื่อใช้ segment + analytics

**Database**
```sql
CREATE TABLE customer_rfm_snapshots (
    tenant_id        UUID NOT NULL,
    user_id          UUID NOT NULL,
    last_scan_at     TIMESTAMPTZ,       -- Recency
    scan_count_30d   INT DEFAULT 0,     -- Frequency (30 วัน)
    scan_count_all   INT DEFAULT 0,     -- Frequency (ทั้งหมด)
    points_earned_all INT DEFAULT 0,    -- Monetary (แต้มที่ได้)
    points_spent_all  INT DEFAULT 0,    -- Monetary (แต้มที่ใช้)
    point_balance    INT DEFAULT 0,     -- ยอดคงเหลือ
    redeem_count_all INT DEFAULT 0,
    last_redeem_at   TIMESTAMPTZ,
    rfm_score        TEXT,              -- e.g. '5-4-3' สำหรับ visualization
    risk_level       TEXT DEFAULT 'normal', -- 'champion','loyal','at_risk','hibernating','lost'
    refreshed_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX idx_rfm_risk ON customer_rfm_snapshots (tenant_id, risk_level);
CREATE INDEX idx_rfm_refresh ON customer_rfm_snapshots (tenant_id, refreshed_at);
```

**Background Job** (เพิ่มใน `analyticswarm/scheduler.go`)
- รัน refresh RFM ทุก 6 ชั่วโมง (หรือ manual trigger)
- ดึงข้อมูลจาก `scan_history`, `point_ledger`, `reward_reservations` ใน **V2 local DB**
- คำนวณ `rfm_score` + `risk_level` ตาม quintile
- UPSERT เข้า `customer_rfm_snapshots`
- **Batch processing**: ทำทีละ 5,000 users เพื่อไม่กิน memory
- **ไม่ query V1 AWS RDS** — ใช้เฉพาะข้อมูลที่ sync มาแล้ว

**ข้อควรระวัง AWS Cost**
- RFM คำนวณจาก V2 local DB เท่านั้น — zero cost จาก AWS
- V1 live sync ที่รันอยู่แล้วจะ feed ข้อมูลมาเรื่อยๆ ไม่ต้องดึงเพิ่ม

---

## Phase 2 — Targeted Communication (สัปดาห์ 3-4)

> เป้าหมาย: ส่งข้อความ LINE ไปยัง segment ที่เลือกได้ พร้อมตั้งเวลาล่วงหน้า

### 2.1 Targeted LINE Broadcast

**Database**
```sql
CREATE TABLE broadcast_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    name            TEXT NOT NULL,
    message_type    TEXT DEFAULT 'text',   -- 'text','image','flex'
    message_payload JSONB NOT NULL,        -- ตัวข้อความ
    segment_id      UUID REFERENCES customer_segments(id),
    target_type     TEXT DEFAULT 'segment', -- 'segment','tag','all'
    target_value    TEXT,                   -- tag name ถ้า target_type='tag'
    scheduled_at    TIMESTAMPTZ,           -- NULL = ส่งทันที
    status          TEXT DEFAULT 'draft',  -- 'draft','scheduled','sending','sent','failed'
    total_recipients INT DEFAULT 0,
    sent_count      INT DEFAULT 0,
    failed_count    INT DEFAULT 0,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_by      UUID,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Backend**
- CRUD broadcast campaign
- `POST /broadcasts/:id/send` — ส่งทันที
- Sender worker: resolve segment → ดึง `line_user_id` จาก users → LINE multicast (batch 500)
- Scheduler: ตรวจ `scheduled_at` ทุก 1 นาที → trigger send
- Rate limit: หน่วง 100ms ต่อ batch เพื่อไม่ชน LINE rate limit

**Frontend**
- หน้าสร้าง broadcast: เลือก segment/tag → compose message → preview → send/schedule
- แสดง sent/failed count + status

**Performance**
- Resolve segment → query users with `line_user_id IS NOT NULL` + WHERE จาก segment rules
- ใช้ cursor-based pagination (ไม่ load ทั้ง segment)
- ส่งใน background goroutine ไม่ block API

**ไม่ต้องทำ**
- ❌ SMS campaign (ค่าใช้จ่ายสูง ยังไม่จำเป็น)
- ❌ Email campaign (ลูกค้า Saversure ส่วนใหญ่ใช้ LINE)

---

### 2.2 Admin Notes on Customer

**Database**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes_updated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_notes_updated_by UUID;
```

**Backend / Frontend**
- เพิ่ม editable notes field ใน customer detail page
- ไม่มี history tracking (เก็บแค่ค่าล่าสุด เพื่อความเรียบง่าย)

---

## Phase 3 — Customer Analytics Dashboard (สัปดาห์ 5-6)

> เป้าหมาย: Admin เห็นภาพรวมพฤติกรรมลูกค้า เพื่อตัดสินใจ campaign

### 3.1 RFM Distribution Chart

**API**: `GET /analytics/rfm-distribution`
- ดึงจาก `customer_rfm_snapshots` aggregate by `risk_level`
- Response: `{ champion: 1200, loyal: 3500, at_risk: 800, ... }`

### 3.2 Customer Cohort (Signup Month → Retention)

**Database**
```sql
CREATE TABLE analytics_customer_cohorts (
    tenant_id     UUID NOT NULL,
    cohort_month  TEXT NOT NULL,      -- '2025-01', '2025-02' ...
    month_offset  INT NOT NULL,      -- 0=signup month, 1=next month, ...
    active_users  INT DEFAULT 0,     -- จำนวน user ที่มี scan ใน month_offset
    total_users   INT DEFAULT 0,     -- จำนวน user ใน cohort นั้น
    refreshed_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (tenant_id, cohort_month, month_offset)
);
```

**Background Job**
- รันทุก 24 ชม. (หรือ manual)
- คำนวณ cohort จาก `users.created_at` (signup month) vs `scan_history.scanned_at` (active month)
- Batch process: ทำทีละ cohort month
- **ข้อมูลจาก V2 local DB เท่านั้น** (users + scan_history ที่ sync มาแล้ว)

### 3.3 Top Products / Rewards

**API**: `GET /analytics/top-products?period=30d`
- ดึงจาก `analytics_scan_rollups` + join products (ถ้ามี product_id)
- หรือ aggregate จาก `scan_history` group by product

### 3.4 Frontend — Analytics Page

- หน้าใหม่ `/analytics` ใน admin
- Charts: RFM distribution (pie/donut), Cohort heatmap, Top products (bar)
- Filter by period
- ใช้ข้อมูลจาก pre-computed tables ทั้งหมด — โหลดเร็ว

---

## Phase 4 — Point Expiry + Lifecycle Automation (สัปดาห์ 7-8)

> เป้าหมาย: ระบบตัดแต้มหมดอายุอัตโนมัติ + trigger-based notification เบื้องต้น

### 4.1 Point Expiry Processor

**Background Job** (ทำงานวันละ 1 ครั้ง เช่น 02:00)
```
1. SELECT point_ledger entries WHERE expires_at <= NOW() AND expiry_processed = FALSE
2. สำหรับแต่ละ entry:
   - คำนวณ remaining amount (credit - debit ที่ match)
   - INSERT entry_type='expiry' เข้า point_ledger
   - UPDATE expiry_processed = TRUE
3. ส่ง notification ให้ user ที่ถูกตัดแต้ม
```

**Pre-expiry Notification** (7 วันก่อนหมดอายุ)
```
1. SELECT entries WHERE expires_at BETWEEN NOW() AND NOW() + 7 days AND notify_sent = FALSE
2. ส่ง in-app notification + LINE message (ถ้า linked)
3. UPDATE notify_sent = TRUE
```

**Migration**: เพิ่ม columns
```sql
ALTER TABLE point_ledger ADD COLUMN IF NOT EXISTS expiry_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE point_ledger ADD COLUMN IF NOT EXISTS expiry_notify_sent BOOLEAN DEFAULT FALSE;
```

**ข้อควรระวัง V1**
- Point entries จาก V1 ส่วนใหญ่ไม่มี `expires_at` → ไม่ถูก process = ปลอดภัย
- ถ้าต้องการ expire points V1 ให้กำหนด policy ก่อน (เช่น "แต้มทุก entry ที่ไม่มี expires_at หมดอายุ 31 ธ.ค. 2026")

### 4.2 Simple Event Triggers

**Database**
```sql
CREATE TABLE crm_triggers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL,
    name         TEXT NOT NULL,
    event_type   TEXT NOT NULL,     -- 'signup','first_scan','days_inactive','point_expiring'
    delay_hours  INT DEFAULT 0,     -- ส่งหลัง event กี่ชม.
    action_type  TEXT NOT NULL,     -- 'line_message','notification','tag_assign'
    action_payload JSONB NOT NULL,  -- ข้อความ/tag ที่จะทำ
    active       BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_trigger_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_id  UUID NOT NULL REFERENCES crm_triggers(id),
    user_id     UUID NOT NULL,
    fired_at    TIMESTAMPTZ DEFAULT NOW(),
    status      TEXT DEFAULT 'sent' -- 'sent','failed','skipped'
);
CREATE INDEX idx_trigger_log_user ON crm_trigger_logs (user_id, trigger_id);
```

**Supported Triggers (เริ่มต้น)**

| Event | ตัวอย่าง Action |
|-------|----------------|
| `signup` | ส่ง welcome message ทาง LINE หลัง 1 ชม. |
| `first_scan` | ให้ badge "First Scanner" + notification |
| `days_inactive_30` | ติด tag "at_risk" + ส่ง LINE |
| `days_inactive_90` | ติด tag "hibernating" |
| `point_expiring_7d` | แจ้งเตือนแต้มใกล้หมดอายุ |

**Background Job** (ทุก 1 ชม.)
- ตรวจ trigger ที่ `active = true`
- สำหรับ `days_inactive_*`: query `customer_rfm_snapshots.last_scan_at`
- สำหรับ `signup`: query `users.created_at` + check ว่ายังไม่เคย fire
- Fire action → log ไว้ใน `crm_trigger_logs` (dedup by user+trigger)

**ไม่ทำ**
- ❌ Complex journey builder (too heavy, ยังไม่จำเป็น)
- ❌ A/B testing (ทำทีหลังเมื่อ base เสถียร)

---

## Phase 5 — Feedback + Referral (สัปดาห์ 9-10)

### 5.1 Simple Survey / NPS

**Database**
```sql
CREATE TABLE surveys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    title       TEXT NOT NULL,
    questions   JSONB NOT NULL,     -- array of { type: 'rating'|'text'|'choice', label, options }
    trigger_event TEXT,             -- 'after_redeem','manual','popup'
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE survey_responses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id   UUID NOT NULL REFERENCES surveys(id),
    user_id     UUID NOT NULL,
    tenant_id   UUID NOT NULL,
    answers     JSONB NOT NULL,
    rating      INT,               -- NPS/CSAT score (ถ้ามี)
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_survey_resp ON survey_responses (survey_id, created_at DESC);
```

### 5.2 Referral Program

**Database**
```sql
CREATE TABLE referral_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    user_id     UUID NOT NULL,       -- เจ้าของ code
    code        TEXT NOT NULL UNIQUE,
    uses        INT DEFAULT 0,
    max_uses    INT,                 -- NULL = unlimited
    reward_referrer INT DEFAULT 0,   -- แต้มที่ผู้แนะนำได้
    reward_referee  INT DEFAULT 0,   -- แต้มที่ผู้ถูกแนะนำได้
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE referral_history (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    referral_code TEXT NOT NULL,
    referrer_id   UUID NOT NULL,
    referee_id    UUID NOT NULL,
    points_given  INT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 6 — Advanced Analytics + Optimization (สัปดาห์ 11-12)

### 6.1 Product Affinity Analysis

- สินค้าไหนถูกสแกนร่วมกันบ่อย (basket analysis lite)
- คำนวณ batch → เก็บใน summary table
- ใช้ข้อมูลจาก `scan_history` ใน V2 local DB

### 6.2 CLV (Customer Lifetime Value) Estimation

- เพิ่ม `estimated_clv` ใน `customer_rfm_snapshots`
- คำนวณจาก: scan_count × avg_point_per_scan × retention_probability

### 6.3 Campaign ROI Tracking

- Track ว่า broadcast/promotion ส่งไปแล้ว → scan/redeem เพิ่มขึ้นกี่ %
- ใช้ `analytics_scan_rollups` เปรียบเทียบ before/after campaign period

### 6.4 Customer Data Export

- Export segment → CSV สำหรับใช้กับเครื่องมือภายนอก
- Async export: สร้าง file → upload MinIO → ให้ download link

---

## สิ่งที่ไม่ทำ (Out of Scope)

| สิ่งที่ไม่ทำ | เหตุผล |
|-------------|--------|
| Email marketing | ลูกค้า Saversure ใช้ LINE เป็นหลัก ไม่มี verified email |
| SMS campaign | ค่าใช้จ่ายสูง ใช้ LINE แทน |
| Complex journey builder | Over-engineering สำหรับ stage นี้ |
| Real-time personalization | ยังไม่คุ้มค่า complexity |
| AI/ML recommendation | ต้องมี data volume มากกว่านี้ |
| ดึงข้อมูลใหม่จาก V1 AWS เพิ่ม | ใช้ข้อมูลที่ V1 live sync มาแล้ว เพื่อ control cost |

---

## สรุป Timeline

```
สัปดาห์ 1-2   Phase 1: Tags + Segments + RFM Snapshots
สัปดาห์ 3-4   Phase 2: Targeted LINE Broadcast + Scheduled Send + Admin Notes
สัปดาห์ 5-6   Phase 3: Analytics Dashboard (RFM chart, Cohort, Top Products)
สัปดาห์ 7-8   Phase 4: Point Expiry Automation + Simple Event Triggers
สัปดาห์ 9-10  Phase 5: Survey/NPS + Referral Program
สัปดาห์ 11-12 Phase 6: Advanced Analytics (CLV, Affinity, Campaign ROI, Export)
```

## Dependencies

```
Phase 1 (Tags/Segments/RFM)  ← ไม่มี dependency, ทำได้ทันที
Phase 2 (Broadcast)          ← ต้องมี Segments จาก Phase 1
Phase 3 (Analytics)          ← ต้องมี RFM snapshots จาก Phase 1
Phase 4 (Expiry/Triggers)    ← ต้องมี Tags จาก Phase 1 (สำหรับ auto-tag)
Phase 5 (Survey/Referral)    ← อิสระ ทำก่อน Phase 4 ได้
Phase 6 (Advanced)           ← ต้องมี Phase 1-3 ก่อน
```

## Performance Budget

| Operation | Target | วิธีการ |
|-----------|--------|--------|
| Customer list + tags | < 200ms | JOIN `customer_tag_assignments` + index |
| Segment preview (20 rows) | < 500ms | Query-based + timeout 5s |
| RFM refresh (800K users) | < 15 min | Batch 5K users/round, V2 local DB only |
| Broadcast send (100K LINE) | < 30 min | Multicast 500/batch, 100ms delay |
| Cohort calculation | < 10 min | Monthly batch, V2 local DB only |
| Point expiry check | < 5 min | Index on `expires_at` + `expiry_processed` |

## AWS Cost Control Checklist

- [ ] RFM snapshot ใช้ V2 local DB เท่านั้น (0 AWS query)
- [ ] Cohort analysis ใช้ V2 local DB เท่านั้น (0 AWS query)
- [ ] Segment evaluation ใช้ V2 local DB เท่านั้น (0 AWS query)
- [ ] V1 live sync schedule ไม่เปลี่ยน (คง interval เดิม)
- [ ] ไม่เพิ่ม new query ไปที่ V1 DB โดยไม่จำเป็น
- [ ] Broadcast ส่งผ่าน LINE API (ค่าใช้จ่าย LINE, ไม่ใช่ AWS)
