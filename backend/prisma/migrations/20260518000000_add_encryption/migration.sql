-- Add voucherCodeHash column for HMAC-based duplicate detection
-- (voucherCode is now encrypted with a random IV so the old @unique index is dropped)
ALTER TABLE "Voucher" ADD COLUMN "voucherCodeHash" TEXT;

-- Drop the old unique constraint on the plaintext voucherCode
ALTER TABLE "Voucher" DROP CONSTRAINT IF EXISTS "Voucher_voucherCode_key";

-- Add unique index on the new hash column (NULLs allowed until migration script runs)
CREATE UNIQUE INDEX "Voucher_voucherCodeHash_key" ON "Voucher"("voucherCodeHash");

-- Add encrypted fields to Card table
-- (accountOwner, lastFourDigits, email, mobileNumber will be re-saved encrypted)
-- No schema column changes needed for Card — existing String columns hold the ciphertext.
