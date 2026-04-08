# Prompts สำหรับสั่งทีมพัฒนา (และ AI Agents) — saversureV2

เอกสารนี้รวม prompt template สำหรับสั่งงานทีม (หรือ AI agents เช่น Claude, Cursor, etc.)
ให้พัฒนาต่อจาก framework ที่มีอยู่ **โดยไม่ hard-code หน้าใหม่**

## หลักการสำคัญ — อ่านก่อนใช้ทุก prompt

1. **ห้าม hard-code หน้า consumer ใหม่** — ทุกหน้าใหม่ต้องสร้างผ่าน Page Builder framework
2. **คงของเดิมทั้งหมด** — ไม่ rewrite ระบบที่ทำงานอยู่ ใช้เป็น fallback
3. **ทำเฉพาะที่สั่ง** — ห้ามแตะหน้าอื่นโดยพลการ
4. **ห้ามแตะ auth pages ตลอดไป** — login, register, OTP, scan, forgot-password, auth/*
5. **ใช้ pattern เดิม 100%** — อ่านไฟล์ตัวอย่างก่อนเริ่ม code

## สถานะ Framework ปัจจุบัน

| ระบบ | สถานะ | หน้าที่จัดการได้ |
|---|:---:|---|
| Page Builder | ✅ พร้อม | `/profile`, `/history` |
| Menu Editor | ✅ พร้อม | `header`, `bottom_nav`, `drawer` |
| Version History | ✅ พร้อม | page_configs + nav_menus |
| Live Preview ใน Page Builder | ✅ พร้อม | iframe + auto-reload หลัง save |

---

## Prompt 1: แปลงหน้า Consumer ให้จัดการผ่าน Page Builder

ใช้เมื่อต้องการ "เอาหน้าที่ยัง hard-code อยู่ มาใส่ใน Page Builder"

**วิธีใช้:** Copy block ด้านล่าง แล้วแทนที่ `{ชื่อหน้า}` ด้วย slug ที่ต้องการ
(เช่น `missions`, `news`, `lucky-draws`, `rewards`, `home`)

```
ฉันต้องการให้คุณแปลงหน้า /{ชื่อหน้า} ของ consumer ให้จัดการผ่าน Page Builder
ตาม pattern เดียวกับที่ /profile (Phase 1) และ /history (Phase 2) ทำไปแล้ว

## กฎที่ต้องทำตามอย่างเคร่งครัด

1. ห้าม hard-code หน้าใหม่ — ต้องสร้างผ่าน Page Builder framework ที่มีอยู่
2. คงของเดิมทั้งหมด — ไม่ rewrite logic เดิม ใช้เป็น fallback
3. ทำเฉพาะหน้าที่บอก — ห้ามแตะหน้าอื่น โดยเฉพาะ auth pages
   (login, register, OTP, scan, forgot-password, auth/*)
4. ใช้ pattern เดิม 100% จาก Phase 1/2 — ไม่คิดวิธีใหม่

## ขั้นตอนที่ต้องทำ (ตามลำดับ)

### Phase 0: สำรวจก่อน (อ่านอย่างเดียว)
- อ่าน consumer/src/app/{ชื่อหน้า}/page.tsx ทั้งไฟล์
- ระบุ visual sections ที่เห็น (header, list, card, ฯลฯ)
- ระบุ APIs ที่ใช้ + state/logic ที่ต้องคง
- อ่าน consumer/src/components/sections/registry.ts เพื่อเข้าใจ pattern
- อ่าน 1 section เก่าเป็นตัวอย่าง
  (เช่น ProfileHeaderCard.tsx หรือ HistoryPageHeader.tsx)

### Phase 1: สร้าง section components
- ไฟล์ละ 1 section ที่ consumer/src/components/sections/{Name}.tsx
- ใช้ "use client"
- รับ props จาก JSONB (พวก toggle/text/number/select)
- มี loading/empty/login states ในตัว (ไม่ใช้ external state)
- คง styling เดิม 100% — copy class จากของเดิม
- ถ้าต้อง auth → return null เมื่อยังไม่ login (เหมือน Phase 1/2)

### Phase 2: ลงทะเบียน sections
- แก้ consumer/src/components/sections/registry.ts:
  - เพิ่ม dynamic import
  - เพิ่ม mapping ใน sectionRegistry
  - เพิ่ม sectionMeta (label, icon, description)

### Phase 3: เพิ่ม section definitions ใน admin
- แก้ frontend/src/app/(admin)/page-builder/page.tsx:
  - เพิ่ม entries ใน sectionTypes object
  - แต่ละ entry มี: label, icon, description, defaultProps, fields[]
  - field types ที่ใช้ได้: text, textarea, number, boolean, select, image, items
- ตรวจว่า slug ของหน้านี้อยู่ใน BUILT_IN_PAGES (ถ้าไม่มี ให้เพิ่ม)

### Phase 4: แปลง consumer page
- แก้ consumer/src/app/{ชื่อหน้า}/page.tsx:
  - เก็บ logic เดิมทั้งหมดไว้เป็น component ชื่อ {Name}Fallback
  - export default function ใหม่ใช้
    <PageRenderer pageSlug="{ชื่อหน้า}" fallback={<{Name}Fallback />} />
  - คง Navbar, BottomNav, layout wrapper เดิม

### Phase 5: Seed default config ลง DB
- เขียน SQL INSERT ลง page_configs ที่ tenant_id = default tenant
- sections array ตรงกับ default ที่อยากให้แสดงตอนเปิดครั้งแรก
- ใช้ ON CONFLICT (tenant_id, page_slug) DO NOTHING

### Phase 6: Verify
- cd consumer && npx tsc --noEmit → ต้องผ่าน
- cd frontend && npx tsc --noEmit → ต้องผ่าน
- curl /api/v1/public/page-config/{ชื่อหน้า} ต้อง return sections ครบ
- เปิด consumer หน้านี้ในเบราว์เซอร์ → render ได้เหมือนเดิม
- ทดสอบ fallback: DELETE FROM page_configs WHERE page_slug='{ชื่อหน้า}'
  → consumer ยังแสดง layout เดิมจาก fallback

## ห้ามทำ

- ห้ามแตะ backend (page-config API พร้อมแล้ว)
- ห้ามแก้ Navbar, BottomNav, Drawer (มี Menu Editor แยก)
- ห้ามแก้ HistoryTabs, ProfileFallback, HistoryFallback ที่มีอยู่
- ห้ามแตะหน้า auth (login/register/OTP/scan/forgot-password)
- ห้ามสร้าง section ใหม่นอกระบบ registry
- ห้ามใส่ section อื่นในหน้านี้นอกจากที่จำเป็น

## ไฟล์อ้างอิง pattern (อ่านก่อนเริ่ม)

- Section component: consumer/src/components/sections/HistoryPageHeader.tsx
- Stateful section: consumer/src/components/sections/HistoryStatSummary.tsx
- Complex section + infinite scroll: consumer/src/components/sections/HistoryScanList.tsx
- Registry: consumer/src/components/sections/registry.ts
- Admin definitions: frontend/src/app/(admin)/page-builder/page.tsx
  (ดู history_* entries)
- Consumer page wrapper: consumer/src/app/history/page.tsx
  (ดู HistoryFallback pattern)
- PageRenderer: consumer/src/components/PageRenderer.tsx

## หลังเสร็จ

ผู้ใช้จะ:
1. เปิด /page-builder ใน admin
2. เลือก tab ของหน้านี้
3. เห็น sections default + แก้ผ่าน form ได้
4. กด Save → Live Preview reload เห็นค่าใหม่ทันที
5. ถ้าผิดพลาด → กด History → Restore version เก่าได้

ถ้า user สั่งให้ทำหลายหน้า → ทำทีละหน้า ห้ามทำพร้อมกัน
ถ้าไม่แน่ใจ scope → ถามก่อนเริ่ม code
ใช้ EnterPlanMode ก่อนเริ่ม implement เพื่อ user approve approach
```

---

## Prompt 2: เพิ่ม Section Type ใหม่ใน Page Builder

ใช้เมื่อต้องการ "สร้าง section ใหม่" ที่ admin สามารถลากไปวางหน้าไหนก็ได้
(เช่น `image_carousel`, `countdown_timer`, `qr_scanner_button`, `video_embed`)

**วิธีใช้:** Copy block ด้านล่าง แทนที่ `{section_name}` (snake_case) และ `{PascalName}`

```
ฉันต้องการเพิ่ม section type ใหม่ชื่อ {section_name} ใน Page Builder
เพื่อให้ admin ลากไปวางในหน้าไหนก็ได้

กฎ: ใช้ pattern เดียวกับ section ที่มีอยู่ ไม่สร้างของใหม่ที่ผิดรูปแบบ

## ขั้นตอน

1. สร้าง consumer/src/components/sections/{PascalName}.tsx
   - ใช้ "use client"
   - รับ props จาก JSONB (TypeScript interface ตามที่ออกแบบ)
   - มี loading/empty states ในตัว (ถ้าต้อง fetch data)
   - คง styling แบบ Tailwind ตรงกับ design system เดิม
   - ถ้าต้อง auth → return null เมื่อยังไม่ login

2. ลงทะเบียนใน consumer/src/components/sections/registry.ts
   - เพิ่ม dynamic import
   - เพิ่มใน sectionRegistry
   - เพิ่มใน sectionMeta (label, icon, description)

3. เพิ่ม entry ใน frontend/src/app/(admin)/page-builder/page.tsx ที่ sectionTypes
   - label, icon, description, defaultProps, fields[]
   - field types ที่ใช้ได้: text, textarea, number, boolean, select, image, items

4. ทดสอบ
   - cd consumer && npx tsc --noEmit ผ่าน
   - cd frontend && npx tsc --noEmit ผ่าน
   - เปิด page-builder → Add section → เลือก type ใหม่
   - ตั้งค่า props → Save → Live Preview แสดงผล
   - ทดสอบ visibility toggle, drag reorder, restore version

## ห้ามทำ

- ห้ามแตะ backend (registry pattern เป็น frontend อย่างเดียว)
- ห้าม hard-code section นี้ลงในหน้าใดหน้าหนึ่ง
- ห้ามสร้าง global state ภายใน section (ใช้ local useState เท่านั้น)
- ห้ามใช้ context provider ใหม่

## ไฟล์อ้างอิง

- ตัวอย่าง section ง่าย (props อย่างเดียว): HistoryPageHeader.tsx
- ตัวอย่าง section ที่ fetch API: HistoryStatSummary.tsx
- ตัวอย่าง section ซับซ้อน + state: HistoryScanList.tsx
- Registry: consumer/src/components/sections/registry.ts
- Admin field types reference: frontend/src/app/(admin)/page-builder/page.tsx
```

---

## Prompt 3: เพิ่ม Version History ให้ระบบใหม่

ใช้เมื่อต้องการเพิ่ม snapshot/restore ให้ระบบอื่น (เช่น branding, popups, rewards config)

**วิธีใช้:** Copy block ด้านล่าง แทนที่ `{ชื่อระบบ}`, `{entity}`, `{table}`

```
ฉันต้องการเพิ่ม version history (snapshot/restore) ให้ระบบ {ชื่อระบบ}
ตาม pattern เดียวกับ Page Builder (page_config_history)
และ Menu Editor (nav_menu_history)

## ไฟล์อ้างอิง (อ่านก่อนเริ่ม)

- backend/internal/pageconfig/history.go (HistoryService template)
- backend/internal/navmenu/history.go (latest reference)
- backend/migrations/042_nav_menu_history.up.sql (table schema template)
- backend/internal/pageconfig/handler.go (snapshot integration)
- frontend/src/app/(admin)/page-builder/page.tsx (UI ปุ่ม History + Restore panel)
- frontend/src/app/(admin)/menu-editor/page.tsx (latest UI reference)

## ขั้นตอน

1. Migration ใหม่ (ใช้เลขถัดจาก migration ล่าสุดใน backend/migrations/)
   - เพิ่ม version INT NOT NULL DEFAULT 1 ใน {table}
   - สร้าง {entity}_history table มี: id, {entity}_id, tenant_id,
     [key fields], version, [data JSONB], updated_by, updated_at, created_at
   - INDEX (tenant_id, [key], version DESC)

2. สร้าง backend/internal/{module}/history.go
   - VersionEntry struct
   - HistoryService struct + NewHistoryService(db)
   - SaveSnapshot(ctx, entity)
   - ListVersions(ctx, tenantID, key) — ORDER BY version DESC LIMIT 50
   - GetVersion(ctx, tenantID, key, version)

3. แก้ service.go ของระบบนั้น
   - เพิ่ม Version int ใน struct
   - แก้ Upsert: SET version = {table}.version + 1 + RETURNING version
   - แก้ List/Get methods ให้ scan version field

4. แก้ handler.go
   - Handler struct: เพิ่ม history *HistoryService
   - NewHandler: instantiate ทั้ง 2 services
   - Upsert: existing := svc.Get(...) → svc.Upsert(...) → ถ้า existing != nil
     → history.SaveSnapshot(existing)
   - เพิ่ม method ListVersions และ RestoreVersion (ดู pageconfig/handler.go)

5. แก้ backend/cmd/api/main.go
   - เพิ่ม 2 routes ใน admin group:
     GET /:id/versions และ POST /:id/restore

6. แก้ Admin UI ของระบบนั้น
   - state: version, showHistory, versions, loadingVersions
   - functions: fetchVersions, restoreVersion (copy จาก page-builder)
   - UI: badge v{N} + ปุ่ม History + Restore panel collapsible

7. ทดสอบ
   - cd backend && go build ./... ผ่าน
   - รัน migration ใหม่
   - cd frontend && npx tsc --noEmit ผ่าน
   - Save → version+1
   - History → restore → ของเก่ากลับมา

## ห้ามทำ

- ห้ามใช้วิธีอื่นนอกจาก pattern นี้
- ห้ามเก็บ history ในตารางเดียวกันกับ entity
- ห้าม snapshot ตอน Insert (เฉพาะ Update)
- ห้ามลบ history เก่า (ให้ user restore ได้ตลอด)
```

---

## Prompt 4: ทำงานทั่วไปกับ Codebase นี้

ใช้เมื่อสั่งงานอะไรก็ตามใน repo นี้ — ผนวกกับ prompt อื่นเพื่อตั้งกฎพื้นฐาน

```
ก่อนทำงานในโปรเจ็กต์ saversureV2 ให้ทำตามกฎต่อไปนี้เสมอ:

## โครงสร้าง 3 apps
- backend/ — Go + Gin + PostgreSQL (port 30400)
- frontend/ — Next.js Admin Panel (port 30401)
- consumer/ — Next.js Customer App (port 30403)

## กฎพื้นฐาน

1. คงของเดิมทั้งหมด — ไม่ rewrite, ไม่ refactor นอกขอบเขต
2. ทำเฉพาะที่ user สั่ง — ไม่ทำงานเกินขอบเขต
3. ห้าม hard-code feature ใหม่ในหน้า consumer — ใช้ Page Builder
4. ห้ามแตะหน้า auth ตลอดไป (login/register/OTP/scan/forgot-password/auth/*)
5. Multi-tenant — ทุก query ต้อง scope ด้วย tenant_id
6. ใช้ dedicated tools (Read/Edit/Glob/Grep) แทน bash cat/find/grep

## ก่อนเริ่ม implement

- ใช้ EnterPlanMode ทุกครั้งสำหรับงาน non-trivial
- อ่านไฟล์ที่จะแก้ก่อนทุกครั้ง (ห้าม Edit โดยไม่ Read)
- ถ้ามีไฟล์ pattern อยู่แล้ว ใช้เป็นต้นแบบ ไม่คิดวิธีใหม่

## หลังเสร็จ

- Run tsc --noEmit / go build ตามภาษา
- Verify ผ่าน preview server (ถ้ามี dev server รันอยู่)
- ห้าม commit เว้นแต่ user สั่ง

## ระบบ framework ที่มีอยู่ (ใช้ก่อนสร้างใหม่)

- Page Builder: จัดการหน้า consumer แบบ section-based
  → backend/internal/pageconfig/, frontend/src/app/(admin)/page-builder/
- Menu Editor: จัดการ Header/BottomNav/Drawer
  → backend/internal/navmenu/, frontend/src/app/(admin)/menu-editor/
- Version History: snapshot/restore สำหรับ page_configs และ nav_menus
- Tenant context: middleware ตั้ง tenant_id จาก JWT (admin) หรือ X-Tenant-ID (consumer)
- Branding/Theme: tenant-specific colors, logo, font ผ่าน TenantProvider

## ดู docs/ ก่อนสร้างไฟล์ใหม่
- docs/HARDCODED_VALUES.md
- docs/dev-migration-reset.md
- docs/start-servers.md
- docs/prompts.md (ไฟล์นี้)
```

---

## Prompt 5: แก้บั๊กในหน้าที่อยู่ใน Page Builder

ใช้เมื่อ "หน้าที่ผ่าน Page Builder แล้ว" มีปัญหา

```
หน้า /{ชื่อหน้า} ใน consumer มีปัญหา: {อธิบายปัญหา}

หน้านี้จัดการผ่าน Page Builder แล้ว ก่อน fix ให้ตรวจตามนี้:

1. ตรวจ DB ก่อน:
   docker exec saversure-postgres psql -U saversure_app -d saversure -c \
     "SELECT page_slug, version, jsonb_array_length(sections) FROM page_configs
      WHERE page_slug='{ชื่อหน้า}';"

2. ตรวจ public API:
   curl -s "http://localhost:30400/api/v1/public/page-config/{ชื่อหน้า}" \
     -H "X-Tenant-ID: 00000000-0000-0000-0000-000000000001"

3. ระบุว่าปัญหาอยู่ที่:
   a. Section component (consumer/src/components/sections/{Name}.tsx) — bug ใน render
   b. Section definition ใน admin (page-builder/page.tsx) — field schema ผิด
   c. PageRenderer (consumer/src/components/PageRenderer.tsx) — bug การ map
   d. Backend (page-config API) — return ผิด
   e. DB data (sections JSONB) — admin save ค่าผิด
   f. Fallback (consumer page.tsx) — fallback layout มี bug

4. Fix เฉพาะจุดที่เป็นต้นเหตุจริง — ห้ามแก้นอกขอบเขต
5. ทดสอบทั้ง happy path + fallback path (ลบ config แล้วยังต้อง render ได้)

ห้าม:
- ห้าม revert กลับเป็น hard-code
- ห้าม disable section
- ห้าม bypass PageRenderer
```

---

## ตัวอย่างการเรียกใช้

### กรณี 1: User อยากให้ AI ทำ /missions ให้ใช้ Page Builder
```
[Copy Prompt 1, แทนที่ {ชื่อหน้า} = missions]
```

### กรณี 2: User อยากเพิ่ม section "Countdown Timer" ใหม่
```
[Copy Prompt 2, แทนที่ {section_name} = countdown_timer, {PascalName} = CountdownTimer]
```

### กรณี 3: User อยากเพิ่ม version history ให้ branding
```
[Copy Prompt 3, แทนที่ {ชื่อระบบ} = branding, {entity} = brand, {table} = brandings]
```

### กรณี 4: ทุกครั้งที่สั่งงาน
```
[Copy Prompt 4 ก่อน] + [Prompt เฉพาะงานต่อท้าย]
```

---

## หมายเหตุสำหรับทีมพัฒนา

- **อย่าลืม restart backend** หลังแก้ไฟล์ Go (HMR ไม่มีใน Go)
- **Frontend HMR** ทำงานปกติ — แก้แล้วเห็นใน browser ทันที
- **Consumer HMR** ทำงานปกติ
- **Migrations** ต้องรันด้วยมือผ่าน docker exec (ดู docs/dev-migration-reset.md)
- **ทุกครั้งที่ Save ใน Page Builder/Menu Editor** = สร้าง snapshot อัตโนมัติ → restore ได้
- **Live Preview** reload หลัง Save เท่านั้น (ไม่ใช่ instant preview ก่อน save)
- **ถ้า Page Builder ลบ sections หมด** → consumer fallback ไป layout เดิม (ของหายไม่จริง)

---

## ติดต่อ / คำถาม

- ตัวอย่าง implementation ที่ทำเสร็จแล้ว: ดู `/profile` (Phase 1) และ `/history` (Phase 2)
- ดู git history เพื่อเข้าใจการเปลี่ยนแปลง: `git log --oneline | head -30`
- ดู plan files ที่ผ่านมา (ถ้ามี): `.claude/plans/`
