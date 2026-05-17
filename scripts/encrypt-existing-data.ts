/**
 * One-time migration script — run ONCE after adding ENCRYPTION_KEY to .env
 * and applying the Prisma migration (which added the voucherCodeHash column).
 *
 * Usage:
 *   cd backend
 *   npx ts-node ../scripts/encrypt-existing-data.ts
 *
 * Safe to re-run — skips records that are already encrypted.
 */

import * as dotenv from "dotenv";
import * as path   from "path";
dotenv.config({ path: path.join(__dirname, "../backend/.env") });

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

// ── Inline encrypt / hmac (mirrors encryptionService.ts) ─────────────────────

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error("ENCRYPTION_KEY must be 64 hex chars in backend/.env");
  return Buffer.from(hex, "hex");
}

function isAlreadyEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 3 && parts[0].length === 24; // 12-byte IV = 24 hex chars
}

function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

function hmac(value: string): string {
  return crypto.createHmac("sha256", getKey()).update(value).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

const VOUCHER_FIELDS = ["voucherCode", "brand", "title", "sourceProgramOrCard", "description", "emailId", "cardOwner", "cardName"] as const;
const CARD_FIELDS    = ["accountOwner", "lastFourDigits", "email", "mobileNumber"] as const;

async function migrateVouchers() {
  const vouchers = await prisma.voucher.findMany();
  let migrated = 0;

  for (const v of vouchers) {
    const update: any = {};
    let needsUpdate = false;

    for (const f of VOUCHER_FIELDS) {
      const val = (v as any)[f] as string;
      if (val && !isAlreadyEncrypted(val)) {
        update[f] = encrypt(val);
        needsUpdate = true;
      }
    }

    // Set voucherCodeHash if missing
    if (!v.voucherCodeHash) {
      const rawCode = isAlreadyEncrypted(v.voucherCode) ? v.voucherCode : v.voucherCode.toLowerCase();
      update.voucherCodeHash = hmac(rawCode.toLowerCase());
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.voucher.update({ where: { id: v.id }, data: update });
      migrated++;
    }
  }

  console.log(`Vouchers: ${migrated} of ${vouchers.length} migrated.`);
}

async function migrateCards() {
  const cards = await prisma.card.findMany();
  let migrated = 0;

  for (const c of cards) {
    const update: any = {};
    let needsUpdate = false;

    for (const f of CARD_FIELDS) {
      const val = (c as any)[f] as string;
      if (val && !isAlreadyEncrypted(val)) {
        update[f] = encrypt(val);
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await prisma.card.update({ where: { id: c.id }, data: update });
      migrated++;
    }
  }

  console.log(`Cards: ${migrated} of ${cards.length} migrated.`);
}

async function main() {
  console.log("Starting encryption migration…\n");
  await migrateVouchers();
  await migrateCards();
  console.log("\nDone. All existing records are now encrypted.");
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
