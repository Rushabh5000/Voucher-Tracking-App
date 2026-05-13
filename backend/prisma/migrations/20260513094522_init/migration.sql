-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('UNREDEEMED', 'REDEEMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "voucherCode" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'Uncategorized',
    "sourceProgramOrCard" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "voucherType" TEXT NOT NULL DEFAULT '',
    "value" DOUBLE PRECISION,
    "expiryDate" TIMESTAMP(3),
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "VoucherStatus" NOT NULL DEFAULT 'UNREDEEMED',
    "redeemedAt" TIMESTAMP(3),
    "emailId" TEXT NOT NULL DEFAULT '',
    "cardOwner" TEXT NOT NULL DEFAULT '',
    "cardName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "accountOwner" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "lastFourDigits" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "mobileNumber" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutocompleteEntry" (
    "id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutocompleteEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_voucherCode_key" ON "Voucher"("voucherCode");

-- CreateIndex
CREATE INDEX "Voucher_dateAdded_idx" ON "Voucher"("dateAdded");

-- CreateIndex
CREATE INDEX "Voucher_status_idx" ON "Voucher"("status");

-- CreateIndex
CREATE INDEX "Voucher_brand_idx" ON "Voucher"("brand");

-- CreateIndex
CREATE INDEX "Card_bank_idx" ON "Card"("bank");

-- CreateIndex
CREATE INDEX "Card_accountOwner_idx" ON "Card"("accountOwner");

-- CreateIndex
CREATE INDEX "AutocompleteEntry_field_idx" ON "AutocompleteEntry"("field");

-- CreateIndex
CREATE UNIQUE INDEX "AutocompleteEntry_field_value_key" ON "AutocompleteEntry"("field", "value");
