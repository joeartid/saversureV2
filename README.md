# Saversure V2

Multi-Tenant Loyalty & Reward Platform with zero-oversell guarantee.

## Architecture

| Component | Technology | Port | Domain |
|-----------|-----------|------|--------|
| Backend API | Go + Gin | 30400 | `api.svsu.me` |
| Admin Portal | Next.js + TypeScript | 30401 | `admin.svsu.me` |
| Factory Portal | Next.js + TypeScript | 30402 | — (internal) |
| Consumer Frontend | Next.js + TypeScript | 30403 | `{brand}.svsu.me` |
| QR Redirect | Go (same backend) | 30400 | `qr.svsu.me` |
| Database | PostgreSQL 17 | 5432 | — |
| Cache | Redis 7 (Docker) | 6379 | — |
| Queue | NATS JetStream (Docker) | 4222 | — |
| Storage | MinIO (shared) | 59300 | — |

### Domain Structure (svsu.me)

```
svsu.me (V2 Platform — via Cloudflare Tunnel)
├── api.svsu.me          → Backend API (shared, multi-tenant)
├── admin.svsu.me        → Admin Panel (shared, tenant selector)
├── qr.svsu.me           → QR Scan → resolve brand → redirect
├── *.svsu.me            → Consumer Frontend (wildcard, detect brand from hostname)
│   ├── julasherb.svsu.me   → Jula'sHerb consumer
│   ├── brand2.svsu.me      → Brand 2 consumer
│   └── brand3.svsu.me      → Brand 3 consumer
```

## Quick Start

```bash
# 1. Start infrastructure (PostgreSQL, Redis, NATS)
docker compose up -d

# 2. Run database migrations
cd backend
cp ../../run/saversureV2/.env.dev .env
go run ./cmd/migrate up

# 3. Start API server
go run ./cmd/api

# 4. Start admin portal (separate terminal)
cd frontend && npm install && npm run dev

# 5. Start consumer frontend (separate terminal)
cd consumer && npm install && npm run dev

# 6. Start Cloudflare tunnel (optional, for public access)
cloudflared tunnel run saversure
```

## Project Structure

```
saversureV2/
├── backend/              Go API
│   ├── cmd/api/          Entry point
│   ├── cmd/migrate/      Migration runner
│   ├── internal/         Business logic
│   │   ├── auth/         JWT + RBAC + LINE Login (per-tenant)
│   │   ├── tenant/       Multi-tenant management
│   │   ├── branding/     Tenant-specific theming (public API)
│   │   ├── campaign/     Campaign CRUD
│   │   ├── batch/        QR batch generation
│   │   ├── code/         QR scan + redirect (qr.svsu.me)
│   │   ├── roll/         Roll lifecycle management
│   │   ├── qc/           QC verification (ref2)
│   │   ├── redemption/   2-phase reservation
│   │   ├── inventory/    Reward stock management
│   │   ├── ledger/       Immutable point ledger
│   │   ├── audit/        Audit trail
│   │   └── middleware/   Auth, CORS, rate limit, idempotency
│   ├── pkg/codegen/      QR code generation, ref1/ref2, HMAC
│   └── migrations/       SQL migrations
├── frontend/             Next.js Admin Portal (port 30401)
├── consumer/             Next.js Consumer Frontend (port 30403)
│   └── src/
│       ├── lib/tenant.ts       Hostname-based tenant detection
│       ├── components/TenantProvider.tsx  Dynamic branding
│       └── app/                Pages (scan, login, rewards, etc.)
├── factory-portal/       Next.js Factory Portal (port 30402)
├── docker-compose.yml    PostgreSQL + Redis + NATS
└── BACKLOG.md            Development backlog & roadmap
```

## Core Design Principles

- **Zero Oversell**: Atomic 2-phase reservation with row-level locks
- **Immutable Ledger**: Point transactions cannot be edited or deleted
- **Multi-Tenant / Multi-Brand**: 1 backend, N brands via subdomain detection
- **Dynamic Branding**: Each brand gets custom theme/logo via branding API
- **Per-Tenant LINE Login**: LINE credentials stored in tenant settings (not global env)
- **Idempotent APIs**: Duplicate requests return same result
- **QR Redirect**: `qr.svsu.me/s/{code}` → resolve brand → redirect to `{brand}.svsu.me/s/{code}`
