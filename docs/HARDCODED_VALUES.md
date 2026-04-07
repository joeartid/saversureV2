# Hardcoded Values — SaversureV2

> สรุปค่าที่ hard-code ไว้ในโปรเจกต์ทั้งหมด (ไม่ผ่าน env / config)
> สร้างเมื่อ: 2026-04-07

---

## 1. URLs / Endpoints

| Value | Where | Risk |
|-------|-------|------|
| `http://localhost:30400` | `frontend/src/lib/api.ts`, `consumer/src/lib/api.ts`, `consumer/src/lib/tenant.ts`, `consumer/src/lib/media.ts`, `frontend/src/components/ui/image-upload.tsx`, `factory-portal/lib/api.ts`, `consumer/src/app/donations/[id]/page.tsx`, `consumer/src/app/history/coupons/page.tsx`, `frontend/src/app/(admin)/rewards/page.tsx`, `.github/workflows/ci.yml` | Low — เป็น fallback ของ `NEXT_PUBLIC_API_URL` |
| `192.168.0.60:5433` (Postgres) | `backend/check_*.go` × 4 (debug scripts), `backup/*.py` × 6 | **High** — IP LAN + password ชัดเจน |
| `192.168.0.60:59300` (MinIO) | `docker-compose.yml`, `backend/.env` | Medium — LAN endpoint |
| `host.docker.internal:15433` | `docker-compose.yml`, `backend/env.cloudflare.example` | Low — dev only |

---

## 2. Credentials / Secrets ⚠️

| Value | Where |
|-------|-------|
| **DB Password:** `julaherb789` | `docker-compose.yml`, `backend/.env`, `backend/check_*.go` × 4, `backup/*.py` × 6, `.claude/settings.local.json` |
| **MinIO Secret:** `julaherb789minio` | `docker-compose.yml`, `backend/.env`, `backend/env.cloudflare.example` |
| **JWT Secret:** `saversure-dev-jwt-secret-change-in-prod-2026` | `docker-compose.yml`, `backend/.env`, `backend/env.cloudflare.example` |
| **HMAC Secret:** `saversure-dev-hmac-2026` | `docker-compose.yml`, `backend/.env`, `backend/env.cloudflare.example` |
| **SMS (Ants) Password:** `jb3cPSuX%6#wh` | `backend/.env` |
| **SMS Username:** `Julaherb_Thailand` | `backend/.env`, `V1_PRODUCTION_REFERENCE.md` |
| **SMS OTP OTC ID:** `633904b9-3ac3-4beb-8ecc-b81cc76e3be4` | `backend/.env`, `V1_PRODUCTION_REFERENCE.md` |
| **MinIO Access Key:** `saversure-admin` | `docker-compose.yml`, `backend/.env` |
| **POSTGRES_USER:** `saversure_app` | ทุกที่ที่ระบุ DB |

---

## 3. UUID / IDs

| Value | Meaning | Where |
|-------|---------|-------|
| `00000000-0000-0000-0000-000000000001` | System / Default Tenant ID | `frontend/src/lib/auth.ts` (`SYSTEM_TENANT_ID`), `consumer/src/lib/api.ts`, `consumer/src/lib/tenant.ts`, `consumer/.env.example`, `factory-portal/app/login/page.tsx`, `consumer/src/app/auth/line/callback/page.tsx`, `backend/migrations/seed_*.sql` |
| `00000000-0000-0000-0000-000000000012` | Reward "แต้มพิเศษ x2 (7 วัน)" | DB `rewards` (legacy `physical` type) |
| Seed UUIDs (`...0002`, `...0003`, ...) | Demo data | `backend/migrations/seed_*.sql` |

---

## 4. Ports

| Service | Port | Where |
|---------|------|-------|
| Backend API | `30400` | `backend/.env`, `docker-compose.yml`, `frontend`, `consumer`, `factory-portal`, `restart_backend.bat`, `.github/workflows/ci.yml` |
| Admin Frontend | `30401` | `frontend/package.json` (next dev -p 30401) |
| Consumer Frontend | `30403` | `consumer/package.json` (next dev -p 30403) |
| Postgres (Docker) | `15433:5432` | `docker-compose.yml` |
| Postgres (Remote LAN) | `5433` | `backend/.env`, debug scripts, backup scripts |
| Redis | `6379` | `docker-compose.yml`, `backend/.env` |
| NATS | `4222`, `18222` (mgmt) | `docker-compose.yml`, `backend/.env` |
| MinIO API / Console | `59300` / `59301` | `docker-compose.yml`, `backend/.env` |

---

## 5. Domains (Production / Cloudflare Tunnel)

| Domain | Purpose |
|--------|---------|
| `svsu.me` | Root domain |
| `api.svsu.me` | Shared Backend API |
| `admin.svsu.me` | Shared Admin Panel |
| `qr.svsu.me` | QR redirect resolver |
| `julasherb.svsu.me` | Consumer: Jula'sHerb |
| `*.svsu.me` | Wildcard for tenant subdomains |

อ้างอิงใน `BACKLOG.md` แต่ไม่ได้ hardcode ใน code (ใช้ tenant settings)

---

## 6. SMS / OTP Provider

| Field | Value | Where |
|-------|-------|-------|
| Host | `https://api-service.ants.co.th` | `backend/.env` |
| Username | `Julaherb_Thailand` | `backend/.env` |
| OTC ID | `633904b9-3ac3-4beb-8ecc-b81cc76e3be4` | `backend/.env` |

---

## 7. Reward Type Enum (ที่ hard-code ใน UI)

ไฟล์: `frontend/src/app/(admin)/rewards/page.tsx:38-53`

```ts
const typeOptions = [
  { value: "product",  label: "สินค้าจริง" },
  { value: "premium",  label: "สินค้าพรีเมียม" },
  { value: "coupon",   label: "คูปอง" },
  { value: "digital",  label: "ดิจิทัล" },
  { value: "ticket",   label: "ตั๋ว" },
];

const deliveryOptions = [
  { value: "none",     label: "ไม่ระบุ" },
  { value: "shipping", label: "📦 จัดส่ง" },
  { value: "coupon",   label: "🎫 คูปอง" },
  { value: "pickup",   label: "📍 รับหน้าร้าน" },
  { value: "digital",  label: "📱 ดิจิทัล" },
  { value: "ticket",   label: "🎟️ ตั๋ว/บัตร" },
];
```

⚠️ **DB มี value `physical` 1 record** ที่ไม่ตรงกับ enum นี้ (legacy)

---

## 8. Risk Summary

### 🔴 ต้องแก้ก่อนขึ้น Production
1. **Secrets ใน `docker-compose.yml`** — ย้ายไป `.env` + Secret Manager (Vault, AWS SM)
2. **Debug scripts `backend/check_*.go`** — มี hardcoded DB URL พร้อมรหัสผ่าน → ลบ หรือใส่ใน `.gitignore`
3. **Backup scripts `backup/*.py`** — มีรหัสผ่านในไฟล์ → ใช้ env แทน
4. **JWT/HMAC secrets** ใช้ string `dev-...` → generate ใหม่สำหรับ production

### 🟡 ควรปรับปรุง
1. **`SYSTEM_TENANT_ID = "00000000-0000-0000-0000-000000000001"`** — ฝังในหลายที่ ควรย้ายเป็น env หรือ config กลาง
2. **`localhost:30400` fallback** ใน 10+ ไฟล์ — ควร throw error ถ้าไม่มี env แทน fallback เงียบ
3. **Reward type enum** ฝังใน UI — ควรดึงจาก backend `/api/v1/enums/reward-types` หรือ shared config

### 🟢 OK (acceptable)
1. **Ports** — เป็น convention ของโปรเจกต์ ใส่ใน `package.json` ได้
2. **MinIO endpoint** ตอน dev — ใช้ LAN IP สำหรับทีม

---

## 9. Recommendations

```bash
# 1. ลบ debug scripts ที่มี secret
git rm backend/check_all_redemptions.go \
       backend/check_lucky_draw.go \
       backend/check_user_info_cmd.go \
       backend/check_user_redemptions.go

# 2. ย้าย secrets ไป .env (ห้าม commit)
echo ".env" >> .gitignore

# 3. ใช้ docker-compose override สำหรับ secrets
# docker-compose.override.yml (gitignored)

# 4. สำหรับ production: ใช้ Cloudflare Secrets / Vault / AWS Secrets Manager
```
