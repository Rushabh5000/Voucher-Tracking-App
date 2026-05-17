/**
 * One-time migration — encrypts all existing plaintext voucher and card records.
 *
 * Run from inside backend/:
 *   npx ts-node src/migrate-encrypt.ts
 *
 * Safe to re-run — skips records that are already encrypted.
 */

// Load .env manually — no dotenv dependency needed
import fs from "fs";
import path from "path";
const envPath = path.join(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) throw new Error("ENCRYPTION_KEY must be 64 hex chars in .env");
  return Buffer.from(hex, "hex");
}

function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 3 && parts[0].length === 24;
}

function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct  = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

function makeHmac(value: string): string {
  return crypto.createHmac("sha256", getKey()).update(value).digest("hex");
}

const prisma = new PrismaClient();

const V_FIELDS = ["voucherCode", "brand", "title", "sourceProgramOrCard", "description", "emailId", "cardOwner", "cardName"] as const;
const C_FIELDS = ["accountOwner", "lastFourDigits", "email", "mobileNumber"] as const;

async function run() {
  console.log("Starting encryption migration…\n");

  // ── Vouchers ──────────────────────────────────────────────────────────────
  const vouchers = await prisma.voucher.findMany();
  let vMigrated = 0;
  for (const v of vouchers) {
    const update: any = {};
    for (const f of V_FIELDS) {
      const val = (v as any)[f] as string;
      if (val && !isEncrypted(val)) update[f] = encrypt(val);
    }
    if (!v.voucherCodeHash) {
      update.voucherCodeHash = makeHmac(v.voucherCode.toLowerCase());
    }
    if (Object.keys(update).length) {
      await prisma.voucher.update({ where: { id: v.id }, data: update });
      vMigrated++;
    }
  }
  console.log(`Vouchers: ${vMigrated} / ${vouchers.length} migrated`);

  // ── Cards ─────────────────────────────────────────────────────────────────
  const cards = await prisma.card.findMany();
  let cMigrated = 0;
  for (const c of cards) {
    const update: any = {};
    for (const f of C_FIELDS) {
      const val = (c as any)[f] as string;
      if (val && !isEncrypted(val)) update[f] = encrypt(val);
    }
    if (Object.keys(update).length) {
      await prisma.card.update({ where: { id: c.id }, data: update });
      cMigrated++;
    }
  }
  console.log(`Cards:    ${cMigrated} / ${cards.length} migrated`);

  console.log("\nDone.");
  await prisma.$disconnect();
}

run().catch(err => { console.error(err.message); process.exit(1); });
