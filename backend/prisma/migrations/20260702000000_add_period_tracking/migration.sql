-- Add periodic voucher tracking fields for Rupay quarterly/half-yearly/annual comparison
ALTER TABLE "Voucher" ADD COLUMN "periodType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Voucher" ADD COLUMN "periodKey"  TEXT NOT NULL DEFAULT '';
