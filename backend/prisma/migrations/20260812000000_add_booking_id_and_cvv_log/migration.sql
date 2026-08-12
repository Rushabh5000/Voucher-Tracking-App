-- Add optional bookingId to Voucher, and a new CvvUsageLog table that records
-- when a Card Vault CVV was copied (never the CVV/card number itself).

ALTER TABLE "Voucher" ADD COLUMN "bookingId" TEXT NOT NULL DEFAULT '';

CREATE TABLE "CvvUsageLog" (
    "id" TEXT NOT NULL,
    "cardLabel" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "bookingId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvvUsageLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CvvUsageLog_userId_idx" ON "CvvUsageLog"("userId");
CREATE INDEX "CvvUsageLog_createdAt_idx" ON "CvvUsageLog"("createdAt");

ALTER TABLE "CvvUsageLog" ADD CONSTRAINT "CvvUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CvvUsageLog" ENABLE ROW LEVEL SECURITY;
