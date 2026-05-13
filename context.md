# Project context

## What this is
Full-stack voucher tracking app for Indian credit/debit card holders.
React + TypeScript + Tailwind + Zustand (frontend)
Node.js + Express + TypeScript + Prisma + PostgreSQL (backend)

## Key decisions made
- Card model has: accountOwner, cardName, bank, lastFourDigits, email, mobileNumber
- Voucher model: brand (mandatory), title (optional), voucherCode, sourceProgramOrCard,
  issueDate, expiryDate (auto +1 month, clearable), emailId, cardOwner, cardName
- voucherType and value removed from add voucher form
- Source card shown as "Bank | XXXX" format
- Get Voucher flow: brand selection first → oldest unredeemed for that brand
- PDF export: landscape A4, no Value column, flushPages() fix for blank pages
- Email: supports Resend API (primary) or Gmail App Password (SMTP)
- AppSetting table stores last email sent timestamp for startup overdue check
- Monthly report auto-sends if >30 days since last send on server start

## Folder structure
vt2/
  backend/   (Express + Prisma)
  frontend/  (React + Vite + Tailwind)
  scripts/setup.js
  docker-compose.yml

## Commands
npm run setup    # first time
npm run dev      # start both services