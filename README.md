# Hostel Room Exchange & Multi-Party Swap Platform

A full-stack hostel room exchange platform supporting both **direct swaps (`A ↔ B`)** and **multi-party circular swaps (`A → B → C → ... → A`, up to 5 participants)** with automated policy validation, cycle detection, participant acceptance, atomic Warden execution, immutable audit logging (CSV/PDF export), and admin management.

The workspace is organized as an npm monorepo with a shared Express/PostgreSQL/Prisma backend consumed identically by both a **React (Vite)** frontend and a **Next.js (App Router)** frontend.

---

## After pulling: run `./setup.sh` then `npm run dev:all`

Every time you pull or clone the repository on your laptop:

```bash
# 1. Automated one-step setup (installs deps, prepares .env, starts DB, generates Prisma, syncs schema, seeds data)
chmod +x setup.sh scripts/*.sh
./setup.sh

# 2. Start the database, backend (port 4000), and Next.js (port 3000) together
npm run dev:all
```

- **Health check**: `http://localhost:4000/health` (returns `{"status":"ok","healthy":true}`)
- **Next.js App**: `http://localhost:3000`
- **React App (optional)**: `npm run dev:react` at `http://localhost:5173`

---

## Architecture

```
┌─────────────────────────┐      ┌─────────────────────────┐
│   React + Vite App      │      │   Next.js App Router    │
│   http://localhost:5173 │      │   http://localhost:3000 │
│   (Vite /api proxy)     │      │   (Next /api rewrite)   │
└───────────┬─────────────┘      └───────────┬─────────────┘
            │         REST + JWT Bearer        │
            └────────────────┬─────────────────┘
                             ▼
            ┌──────────────────────────────────┐
            │   Node.js + Express REST API     │
            │   http://localhost:4000/api      │
            │   - Zod validation & RBAC        │
            │   - 12-rule Policy Validator     │
            │   - Bounded DFS Cycle Detector   │
            │   - Atomic Prisma Transactions   │
            │   - CSV/PDF Audit Export         │
            └────────────────┬─────────────────┘
                             │ Prisma ORM
                             ▼
            ┌──────────────────────────────────┐
            │   PostgreSQL 16+ Database        │
            │   Hostels, Blocks, Rooms, Beds,  │
            │   Students, Requests, Cycles,    │
            │   Approvals, AuditLogs, Notifs   │
            └──────────────────────────────────┘
```

### Key Workflow
1. **Request Creation & Validation**: Student selects a desired room (or preferences: AC/Non-AC, bed count, floor, block) with reason & expiry date. A 12-check policy validator enforces same gender block, optional batch/year matching, AC eligibility/fee rules, capacity compatibility, semester swap limits, cooldown periods, blocked swap windows, and duplicate guards.
2. **Swap Detection**: Models active pending requests as a directed graph (`student → desired room's current occupant`), runs bounded DFS to find direct (`2-way`) and circular (`3..N-way`) swaps, ranks candidates (shorter cycle length first, oldest requests first), and locks disjoint participants into `SwapGroup` records so no request enters two active cycles simultaneously.
3. **Participant Acceptance**: Every student in a detected cycle reviews the circular swap diagram and accepts or rejects. Any rejection (or expiry) dissolves the entire `SwapGroup` and releases remaining requests back to the active pool without touching room allocations.
4. **Warden Approval & Atomic Execution**: Once all participants accept, the cycle enters the Warden Approval Queue. Upon approval, a single PostgreSQL `$transaction` updates all student room/bed assignments atomically (all succeed or all roll back) and records immutable `AuditLog` entries + in-app/email-stub `Notification`s.

---

## Project Structure

```
Hostel_New_Room/
├── package.json              # Workspace root scripts
├── backend/                  # Express + TypeScript + Prisma + PostgreSQL REST API
│   ├── docker-compose.yml    # Optional Postgres container setup
│   ├── prisma/
│   │   ├── schema.prisma     # Relational schema
│   │   └── seed.ts           # Seeds 2 hostels, 4 blocks, 44 rooms, 108 students, sample cycles
│   └── src/
│       ├── config/           # Environment config
│       ├── middleware/       # JWT auth, RBAC, Zod validation, rate limiter
│       ├── routes/           # auth, rooms, exchanges, swaps, warden, admin, audit, notifications
│       ├── services/         # policyValidator, cycleDetector, swapLifecycle, wardenApproval, auditService, csvImportService
│       └── __tests__/        # Vitest unit tests (policyValidator + cycleDetector)
├── react-app/                # Vite + React (JSX) + Tailwind + React Router + Axios
└── next-app/                 # Next.js (App Router, JSX) + Tailwind + Axios
```

---

## Prerequisites & Setup

- **Node.js** >= 18 and **npm** >= 9
- **PostgreSQL** >= 15 (via Docker Compose or local PostgreSQL)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Database & Environment
Copy `backend/.env.example` to `backend/.env` if not already present, and ensure `DATABASE_URL` points to your running PostgreSQL instance:
```env
DATABASE_URL="postgresql://hostel_user:hostel_pass@127.0.0.1:5432/hostel_exchange?schema=public"
JWT_SECRET="replace-with-secure-secret"
PORT=4000
CORS_ORIGIN="http://localhost:5173,http://localhost:3000"
```

Option A — Docker Postgres (from `backend/`):
```bash
docker compose up -d
```

Option B — Local PostgreSQL:
Ensure a database matching `DATABASE_URL` is created and running.

### 3. Generate Prisma Client, Push Schema & Seed Data
```bash
npm run prisma:generate --workspace=backend
npm run db:push
npm run seed
```

### 4. Run Tests & Production Builds
```bash
npm run test:backend
npm run build
```

### 5. Start All Services
Run all three apps concurrently from the workspace root:
```bash
npm run dev
```
Or start each workspace individually:
```bash
npm run dev:backend   # http://localhost:4000
npm run dev:react     # http://localhost:5173
npm run dev:next      # http://localhost:3000
```

---

## Demo Credentials

| Role | Email | Password | Room / Notes |
| --- | --- | --- | --- |
| **Admin** | `admin@hostel.edu` | `Admin@123` | Full system, policy, room, student, CSV import & stats panel |
| **Warden** | `warden@hostel.edu` | `Warden@123` | Approves/rejects accepted swap cycles atomically |
| **Student A (Cycle `CYC-101`)** | `aarav@hostel.edu` | `Student@123` | `A-101` Bed `B1` (2-Bed AC, `acEligible: true`, already accepted `CYC-101`) |
| **Student B (Cycle `CYC-101`)** | `rohan@hostel.edu` | `Student@123` | `A-205` Bed `B2` (2-Bed AC, `acEligible: true`, `PENDING` acceptance) |
| **Student C (Cycle `CYC-101`)** | `kabir@hostel.edu` | `Student@123` | `A-310` Bed `B1` (2-Bed AC, `acEligible: true`, `PENDING` acceptance) |
| **Student (AC-Blocked Test)** | `deepak@hostel.edu` | `Student@123` | `A-102` Bed `B1` (2-Bed Non-AC, `acEligible: false`) |
| **Student (AC-Eligible Non-AC)** | `tanmay@hostel.edu` | `Student@123` | `A-103` Bed `B2` (3-Bed Non-AC, `acEligible: true`, pending `EX-1009`) |
| **Student (Direct Cycle `CYC-102`)** | `vikram@hostel.edu` | `Student@123` | `B-101` ↔ `arjun@hostel.edu` (`B-202`), ready in Warden Queue |
| **Student (Restricted)** | `siddharth@hostel.edu` | `Student@123` | `A-104`, `isRestricted: true` |
| **Girls Hostel Cycle (`CYC-103`)** | `ananya@hostel.edu` | `Student@123` | `KCGH` 3-way swap with `diya@hostel.edu` & `meera@hostel.edu` |

---

## API Reference (`/api`)

| Area | Endpoints |
| --- | --- |
| **Health** | `GET /api/health` |
| **Auth** | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` |
| **Rooms & Hostels** | `GET /api/hostels`, `GET /api/rooms`, `GET /api/rooms/:id` |
| **Exchange Requests** | `POST /api/exchanges/validate-preview`, `POST /api/exchanges`, `GET /api/exchanges`, `GET /api/exchanges/:id`, `POST /api/exchanges/:id/cancel` |
| **Swap Detection & Matching** | `GET /api/swaps/matches`, `GET /api/swaps/:groupId`, `POST /api/swaps/detect`, `POST /api/swaps/:groupId/respond` |
| **Warden Queue** | `GET /api/warden/queue`, `POST /api/warden/swaps/:groupId/approve`, `POST /api/warden/swaps/:groupId/reject` |
| **Admin** | `GET /api/admin/stats`, `GET /api/admin/policies`, `PATCH /api/admin/policies/:id`, `POST /api/admin/hostels`, `POST /api/admin/blocks`, `POST /api/admin/rooms`, `PATCH /api/admin/rooms/:id`, `GET /api/admin/students`, `PATCH /api/admin/students/:id`, `GET /api/admin/swaps`, `POST /api/admin/import/rooms`, `POST /api/admin/import/students` |
| **Audit Logs** | `GET /api/audit-logs`, `GET /api/audit-logs/export?format=csv\|pdf` |
| **Notifications** | `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`, `GET /api/notifications/email-stubs` |

---

## Demo Walkthrough

1. **Live Policy Validation (`deepak@hostel.edu`)**: Go to **Request Exchange**, choose an AC room (e.g., `A-101`), and inspect the live validation checklist blocking Non-AC → AC without AC eligibility.
2. **Multi-Party Cycle Acceptance (`rohan@hostel.edu` & `kabir@hostel.edu`)**: Open **Swap Matches** to view the animated circular swap graph for `CYC-101` (`Aarav → Rohan → Kabir → Aarav`). Accept as Rohan and Kabir to promote `CYC-101` to `AWAITING_WARDEN`.
3. **Atomic Warden Execution (`warden@hostel.edu`)**: Open **Warden Queue**, approve `CYC-102` or `CYC-101` with remarks, and verify that all student bed allocations swap atomically in one transaction.
4. **Immutable Audit Trail & Exports**: Open **Audit Log** as Warden or Admin to inspect room before/after changes and download CSV or PDF exports.
5. **Admin Controls (`admin@hostel.edu`)**: View swap analytics, toggle hostel swap policies, manage rooms/students, or run CSV bulk imports on **Admin Dashboard**.
