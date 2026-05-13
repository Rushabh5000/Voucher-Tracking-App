# Voucher Tracker v2

Personal voucher management app for Indian credit and debit card holders.
Tracks RuPay quarterly vouchers and card offer benefits so you never miss a benefit.

## What's new in v2

| Feature | Details |
|---|---|
| **Card master** | Manage your credit/debit cards — accountOwner, bank, email, mobile |
| **Smart autocomplete** | Every form field suggests from saved history; new values auto-saved |
| **Brand-first Get Voucher** | Pick a brand, then fetch oldest unredeemed for that brand |
| **Analytics** | Pie, bar, and line charts — status, brand breakdown, monthly trend |
| **Excel export** | 3-sheet workbook — vouchers, summary, monthly trend |
| **PDF export** | Full branded report with tables and stats |
| **Monthly email** | Auto-scheduled report via cron + nodemailer, PDF attached |
| **Dark mode** | Full light/dark support with theme persistence |
| **Left sidebar nav** | Dashboard, Vouchers, Cards, Analytics, Export, Settings |
| **TypeScript** | Full type safety frontend and backend |
| **Zustand** | State management with persistence |
| **PostgreSQL + Prisma** | Production-grade database with migrations |

---

## Quick start — local development

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally (or use Docker Compose — see below)

### First time

```bash
git clone <repo> voucher-tracker
cd voucher-tracker
```

The setup script does everything in one go:

```bash
npm run setup
```

What it does automatically:
1. Copies `backend/.env.example` → `backend/.env` (if not already present)
2. Installs all dependencies (root + backend + frontend)
3. Pushes the Prisma schema to your database
4. Seeds 12 sample vouchers, 5 cards, and 60+ autocomplete entries

> **Database credentials** are pre-configured to match `docker-compose.yml`:
> `postgresql://voucher_user:voucher_pass@localhost:5432/voucher_tracker`
> Start Postgres first with `docker-compose up postgres -d`, then run setup.

### Every time after that

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

## Docker — one-command setup

```bash
# Build and start everything (PostgreSQL + backend + frontend)
docker-compose up --build

# Then seed in a second terminal:
docker-compose exec backend npx ts-node prisma/seed.ts
```

Frontend: http://localhost:5173
API: http://localhost:3001

### Email configuration (optional)

Add to `docker-compose.yml` environment or create a `.env` file at root:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_gmail_app_password
REPORT_RECIPIENT=you@gmail.com
```

For Gmail, generate an App Password at:
Google Account → Security → 2-Step Verification → App passwords

---

## Folder structure

```
voucher-tracker/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # DB schema — Voucher, Card, AutocompleteEntry
│   │   └── seed.ts             # Sample data seeder
│   ├── src/
│   │   ├── index.ts            # Express server entry point
│   │   ├── middleware/
│   │   │   └── errorHandler.ts # Centralised error handling
│   │   ├── routes/
│   │   │   ├── vouchers.ts     # CRUD + /next endpoint
│   │   │   ├── cards.ts        # Card CRUD
│   │   │   ├── autocomplete.ts # Suggestion API
│   │   │   └── reports.ts      # /analytics + /export/*
│   │   ├── services/
│   │   │   ├── analyticsService.ts  # Chart data builder
│   │   │   ├── autocompleteService.ts
│   │   │   ├── exportService.ts     # Excel + PDF generation
│   │   │   └── emailService.ts      # Nodemailer + PDF attachment
│   │   └── jobs/
│   │       └── monthlyReport.ts    # node-cron scheduler
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts       # Axios API client
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx     # Left nav with dark mode toggle
│   │   │   │   └── Layout.tsx      # Page shell + topbar
│   │   │   ├── ui/
│   │   │   │   ├── SmartInput.tsx  # Autocomplete input (tag-style)
│   │   │   │   ├── Modal.tsx       # Accessible modal portal
│   │   │   │   └── ConfirmDialog.tsx
│   │   │   ├── vouchers/
│   │   │   │   ├── AddVoucherModal.tsx  # Full form with SmartInput fields
│   │   │   │   ├── GetVoucherModal.tsx  # Brand → Voucher two-step flow
│   │   │   │   └── VoucherCard.tsx      # Row with inline actions
│   │   │   └── cards/
│   │   │       └── CardModal.tsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx   # Stats + oldest unredeemed
│   │   │   ├── VouchersPage.tsx    # Full list with filters
│   │   │   ├── CardsPage.tsx       # Card management grouped by bank
│   │   │   ├── AnalyticsPage.tsx   # Recharts — pie, bar, line
│   │   │   ├── ExportPage.tsx      # Download buttons + email trigger
│   │   │   └── SettingsPage.tsx    # Theme switcher
│   │   ├── store/
│   │   │   ├── uiStore.ts          # Zustand — theme, sidebar, active page
│   │   │   ├── voucherStore.ts     # Zustand — voucher CRUD
│   │   │   └── cardStore.ts        # Zustand — card CRUD
│   │   ├── types/
│   │   │   └── index.ts            # Shared TypeScript types
│   │   └── utils/
│   │       └── formatters.ts       # Date, value, status helpers
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
│
├── docs/
│   ├── API.md              # Full API reference
│   └── schema.mermaid      # ERD diagram
│
├── docker-compose.yml
├── package.json            # Root scripts
└── .env.example
```

---

## Database schema

Three tables:

**`Voucher`** — Core entity. `voucherCode` is unique. `dateAdded` is server-generated. Effective status is computed from `status` + `expiryDate`.

**`Card`** — Card master. Grouped by `bank` in the UI. Feeding autocomplete.

**`AutocompleteEntry`** — One row per `(field, value)` pair. `count` tracks usage frequency for ranking suggestions. Fields: `bank`, `accountOwner`, `email`, `mobileNumber`, `brand`, `sourceProgramOrCard`, `voucherType`.

See `docs/schema.mermaid` for the ERD.

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + TypeScript | Type-safe component model |
| Styling | Tailwind CSS | Utility-first, dark mode built-in |
| State | Zustand | Minimal, no boilerplate |
| Charts | Recharts | Composable, responds to theme |
| HTTP | Axios | Interceptors, clean error handling |
| Backend | Node.js + Express + TypeScript | Fast, familiar |
| ORM | Prisma | Type-safe queries, migrations |
| Database | PostgreSQL | Production-grade, ACID |
| Export | ExcelJS + PDFKit | Native Node.js, no headless browser |
| Email | Nodemailer | Industry standard |
| Scheduler | node-cron | Lightweight, IST timezone support |
| Container | Docker + Compose | One-command local + prod setup |

---

## Key business rules

- `dateAdded` is **always server-generated** — never from the frontend
- **Viewing/fetching a voucher never redeems it** — only explicit `PATCH .../redeem`
- `GET /vouchers/next` skips redeemed AND expired vouchers
- Duplicate `voucherCode` is rejected at both frontend (instant) and backend (409)
- `PATCH .../redeem` is **idempotent** — double-click safe
- **Get Voucher flow**: brand selection first → then oldest-first fetch for that brand
- New autocomplete values (brands, banks, emails) are **auto-persisted** on save

---

## Monthly email report

Runs automatically on the last calendar day of each month at 9:00 AM IST.

Contains:
- Summary stats (total, unredeemed, redeemed, expired, values)
- Brand-wise breakdown
- Monthly trend
- PDF report attached

Trigger manually at any time via: `POST /api/export/email`

---

## API quick reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/vouchers` | List all, oldest first |
| `GET` | `/api/vouchers/next?brand=X` | Next eligible unredeemed |
| `GET` | `/api/vouchers/:id` | Single voucher |
| `POST` | `/api/vouchers` | Create voucher |
| `PATCH` | `/api/vouchers/:id/redeem` | Mark redeemed |
| `PATCH` | `/api/vouchers/:id/unredeem` | Mark unredeemed |
| `DELETE` | `/api/vouchers/:id` | Delete voucher |
| `GET` | `/api/cards` | List all cards |
| `POST` | `/api/cards` | Create card |
| `PATCH` | `/api/cards/:id` | Update card |
| `DELETE` | `/api/cards/:id` | Delete card |
| `GET` | `/api/autocomplete?field=bank&q=hd` | Suggestions |
| `GET` | `/api/analytics` | Analytics data |
| `GET` | `/api/export/excel` | Download Excel |
| `GET` | `/api/export/pdf` | Download PDF |
| `POST` | `/api/export/email` | Send email now |

Full docs: `docs/API.md`
