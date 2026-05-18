# Voucher Tracker

> Personal voucher management app for Indian credit and debit card holders.
> Track RuPay quarterly vouchers and card offer benefits so you never miss a reward.

**Live demo:** [frontend-two-woad-69.vercel.app](https://frontend-two-woad-69.vercel.app) — click **Continue as Guest** to explore instantly.

---

## Screenshots

### Login — Sign in, register, or try as guest

![Login](docs/screenshots/01-login.png)

### Dashboard — Stats at a glance, filtered voucher list

![Dashboard](docs/screenshots/03-dashboard.png)

### Add Voucher — Brand, code, title, dates, and source card

![Add Voucher Modal](docs/screenshots/02-add-voucher-modal.png)

### Get Voucher — Brand-first flow to retrieve the oldest eligible voucher

![Get Voucher Modal](docs/screenshots/10-get-voucher-modal.png)

### My Vouchers — Full list with search, status, and brand filters

![Vouchers Page](docs/screenshots/04-vouchers.png)

### Brand Cloud — All brands grouped, tap any to browse its vouchers

![Brand Cloud](docs/screenshots/05-brand-cloud.png)

### Analytics — Status distribution, expiry alerts, monthly trend

![Analytics](docs/screenshots/06-analytics.png)

### Export — Excel, PDF, and automated monthly email report

![Export](docs/screenshots/07-export.png)

### Audit Log — Every API call logged with timestamps and status codes

![Audit Log](docs/screenshots/08-audit-log.png)

### Dark Mode — Full dark theme across all pages

![Dark Mode](docs/screenshots/09-dark-mode.png)

---

## Features

### Authentication & Access
- **Sign in** — username/password for registered accounts
- **Register** — create a personal account in seconds
- **Guest mode** — 2-hour sandbox session; all data is auto-deleted on expiry
- **Data isolation** — every user sees only their own vouchers and cards

### Dashboard
- **Live stats** — Total, Unredeemed, Redeemed, Expired, and Expiring in 7 days, displayed as clickable stat cards that filter the voucher list instantly
- **Expiry warning banner** — highlighted alert when vouchers are within 7 days of expiry
- **Status + brand filters** — combine any status with any brand; oldest-first ordering

### Voucher Management
- Add, edit, and delete vouchers with full field support: brand, title, voucher code, source program/card, description, issue date, expiry date, email, and card details
- **Duplicate detection** — voucher codes are checked at the frontend instantly and rejected at the backend with a 409 if a duplicate slips through
- **Redeem / unredeem** — idempotent PATCH endpoints; double-click safe
- Effective status computed server-side: `UNREDEEMED`, `REDEEMED`, or `EXPIRED` (based on expiry date)

### Get Voucher Flow
- Brand-first selection — pick a brand, then retrieve the oldest eligible unredeemed voucher
- Supports skipping already-viewed vouchers within the same session via an exclude list

### Brand Cloud
- Visual word cloud grouping all vouchers by brand
- Tap any brand to see its vouchers inline

### Card Management
- Card master table: account owner, card name, bank, last four digits, email, mobile number
- Cards grouped by bank in the UI
- Card fields feed autocomplete suggestions across all voucher forms

### Analytics
- **Pie chart** — voucher status distribution
- **Bar chart** — voucher count by brand
- **Line chart** — monthly trend of added vs redeemed vouchers
- All charts respond to the active theme (light/dark)

### Export
- **Excel** — 3-sheet workbook: full voucher list, summary stats, and monthly trend data
- **PDF** — landscape A4 branded report with tables and summary stats

### Automated Email Reports
- Runs automatically on the last calendar day of each month at **9:00 AM IST**
- Catches up on startup: if more than 30 days have elapsed since the last send, the report is sent immediately
- Manual trigger available via `POST /api/export/email`
- PDF report attached to every email
- Supports **Resend API** (primary) or **Gmail App Password** (SMTP fallback)

### Audit Log
- Full audit trail of every Create, Update, Delete, Redeem, and Unredeem operation
- Filterable by entity type (Voucher, Card, Field Value), action keyword, and date range
- Paginated table (50 records per page) with IST timestamps, HTTP status codes, and response duration
- Export filtered results to Excel (up to 50,000 rows)

### Smart Autocomplete
- Every form field (brand, bank, source program, title, email, etc.) suggests from saved usage history
- New values are auto-persisted on save and ranked by usage frequency
- Field values can be managed manually from the Settings page

### Developer Experience
- Full TypeScript — frontend and backend
- Zustand stores with persistence for UI state, vouchers, and cards
- Prisma migrations with a one-command seed script
- Docker Compose for zero-config local or production setup

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (dark mode built-in) |
| State | Zustand with persistence |
| Charts | Recharts |
| HTTP client | Fetch API |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 14+ |
| Auth | JWT (jsonwebtoken) + scrypt password hashing |
| Export | ExcelJS + PDFKit |
| Email | Nodemailer (SMTP) |
| Scheduler | node-cron (IST timezone) |
| Container | Docker + Compose |
| Frontend hosting | Vercel |
| Backend hosting | Render |

---

## Quick Start — Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally, **or** Docker (see Docker section below)

### First-time setup

```bash
git clone <repo> voucher-tracker
cd voucher-tracker
```

The setup script handles everything in one step:

```bash
npm run setup
```

This will:
1. Copy `backend/.env.example` → `backend/.env` (if not already present)
2. Install all dependencies (root + backend + frontend)
3. Push the Prisma schema to your database
4. Seed sample vouchers, cards, and autocomplete entries

> **Default database URL** (matches `docker-compose.yml`):
> `postgresql://voucher_user:voucher_pass@localhost:5432/voucher_tracker`
>
> Start Postgres first with `docker-compose up postgres -d`, then run setup.

### Running the app

```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |
| Health check | http://localhost:3001/api/health |
| Prisma Studio | `npm run db:studio` → http://localhost:5555 |

---

## Docker — One-Command Setup

```bash
# Build and start everything (PostgreSQL + backend + frontend)
docker-compose up --build

# Seed the database (run once in a second terminal)
docker-compose exec backend npx ts-node prisma/seed.ts
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

---

## Email Configuration

Add the following to `backend/.env` (or as environment variables in `docker-compose.yml`):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_gmail_app_password
REPORT_RECIPIENT=you@gmail.com
```

For Gmail, generate an App Password at:
**Google Account → Security → 2-Step Verification → App passwords**

---

## Database Schema

**`User`** — Registered users and guest sessions. `role` is `admin`, `user`, or `guest`. Guest records have an `expiresAt` timestamp; a cleanup cron deletes expired guests every 30 minutes (cascade-deleting all their data).

**`Voucher`** — Core entity. `voucherCode` is normalised to lowercase. `dateAdded` is always server-generated. Effective status is computed from `status` + `expiryDate`. Scoped to `userId`.

**`Card`** — Card master. Grouped by `bank` in the UI and feeds autocomplete. Scoped to `userId`.

**`AutocompleteEntry`** — One row per `(field, value)` pair. `count` tracks usage frequency for suggestion ranking. Fields: `bank`, `accountOwner`, `email`, `mobileNumber`, `brand`, `sourceProgramOrCard`, `title`.

**`AuditLog`** — Append-only log of every mutating API call: action, entity, details, HTTP status, response duration, IP address, and path.

**`AppSetting`** — Key/value store for server-side state (e.g. `lastEmailSentAt`).

See [`docs/schema.mermaid`](docs/schema.mermaid) for the full ERD.

---

## Business Rules

- `dateAdded` is **always server-generated** — never accepted from the frontend
- **Viewing or fetching a voucher never redeems it** — only an explicit `PATCH .../redeem` does
- `GET /vouchers/next` skips both redeemed and expired vouchers
- Duplicate `voucherCode` is rejected at the frontend (instant check) and at the backend (409) — scoped per user
- `PATCH .../redeem` is **idempotent** — safe to call multiple times
- The **Get Voucher flow** requires brand selection first, then fetches the oldest eligible voucher for that brand
- New autocomplete values are **auto-persisted** on every voucher or card save
- Guest session data is **automatically deleted** after 2 hours via cascade delete

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Sign in (admin or registered user) |
| `POST` | `/api/auth/register` | Create a new account |
| `POST` | `/api/auth/guest` | Start a 2-hour guest session |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/vouchers` | List all vouchers (oldest first) |
| `GET` | `/api/vouchers/next?brand=X` | Next eligible unredeemed voucher |
| `GET` | `/api/vouchers/:id` | Single voucher |
| `POST` | `/api/vouchers` | Create voucher |
| `PATCH` | `/api/vouchers/:id` | Update voucher fields |
| `PATCH` | `/api/vouchers/:id/redeem` | Mark as redeemed |
| `PATCH` | `/api/vouchers/:id/unredeem` | Mark as unredeemed |
| `DELETE` | `/api/vouchers/:id` | Delete voucher |
| `GET` | `/api/cards` | List all cards |
| `POST` | `/api/cards` | Create card |
| `PATCH` | `/api/cards/:id` | Update card |
| `DELETE` | `/api/cards/:id` | Delete card |
| `GET` | `/api/autocomplete?field=brand&q=sw` | Autocomplete suggestions |
| `GET` | `/api/analytics` | Analytics data (charts) |
| `GET` | `/api/export/excel` | Download Excel workbook |
| `GET` | `/api/export/pdf` | Download PDF report |
| `POST` | `/api/export/email` | Send email report now |
| `GET` | `/api/audit` | Paginated audit log |
| `GET` | `/api/audit/export` | Download audit log as Excel |

Full documentation: [`docs/API.md`](docs/API.md)

---

## Folder Structure

```
voucher-tracker/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # DB schema
│   │   └── seed.ts                 # Sample data seeder
│   └── src/
│       ├── index.ts                # Express server entry point
│       ├── middleware/
│       │   ├── authMiddleware.ts   # JWT verification + user context
│       │   ├── auditLogger.ts      # Request/response audit middleware
│       │   └── errorHandler.ts     # Centralised error handling
│       ├── routes/
│       │   ├── auth.ts             # Login, register, guest endpoints
│       │   ├── vouchers.ts         # Voucher CRUD + /next endpoint
│       │   ├── cards.ts            # Card CRUD
│       │   ├── autocomplete.ts     # Suggestion API
│       │   ├── reports.ts          # Analytics + export endpoints
│       │   └── audit.ts            # Audit log + export
│       ├── services/
│       │   ├── analyticsService.ts
│       │   ├── autocompleteService.ts
│       │   ├── exportService.ts    # Excel + PDF generation
│       │   ├── auditService.ts
│       │   └── emailService.ts     # Nodemailer + PDF attachment
│       └── jobs/
│           ├── guestCleanup.ts     # Deletes expired guest sessions every 30m
│           ├── monthlyReport.ts    # node-cron monthly scheduler
│           └── backup.ts
│
├── frontend/
│   └── src/
│       ├── api/client.ts           # Typed API client + auth endpoints
│       ├── components/
│       │   ├── layout/             # Sidebar, Layout, topbar, guest countdown
│       │   ├── ui/                 # SmartInput, Modal, ConfirmDialog
│       │   ├── vouchers/           # Add, Edit, Get voucher modals + VoucherCard
│       │   └── cards/              # CardModal
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── VouchersPage.tsx
│       │   ├── WordCloudPage.tsx
│       │   ├── CardsPage.tsx
│       │   ├── AnalyticsPage.tsx
│       │   ├── ExportPage.tsx
│       │   ├── AuditPage.tsx
│       │   └── SettingsPage.tsx
│       ├── store/
│       │   ├── uiStore.ts          # Theme, sidebar, active page
│       │   ├── authStore.ts        # Token, role, guest expiry
│       │   ├── voucherStore.ts     # Voucher CRUD + derived selectors
│       │   └── cardStore.ts        # Card CRUD
│       ├── types/index.ts
│       └── utils/formatters.ts
│
├── docs/
│   ├── screenshots/                # README screenshots
│   ├── API.md
│   └── schema.mermaid
│
├── scripts/setup.js
├── vercel.json
├── docker-compose.yml
└── package.json
```
