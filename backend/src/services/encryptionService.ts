import crypto from "crypto";

// Key must be exactly 64 hex characters (= 32 bytes for AES-256)
function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be set to exactly 64 hex characters in backend/.env");
  }
  return Buffer.from(hex, "hex");
}

// Encrypt → "ivHex:authTagHex:ciphertextHex"
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv  = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

// Decrypt "ivHex:authTagHex:ciphertextHex" → plaintext
// Returns value as-is if it doesn't match the encrypted format (safe during migration)
export function decrypt(value: string): string {
  if (!value) return value;
  const parts = value.split(":");
  if (parts.length !== 3) return value; // plaintext record not yet migrated
  try {
    const key       = getKey();
    const iv        = Buffer.from(parts[0], "hex");
    const tag       = Buffer.from(parts[1], "hex");
    const encrypted = Buffer.from(parts[2], "hex");
    const decipher  = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
  } catch {
    return value; // decryption failed — return raw value safely
  }
}

// Deterministic HMAC-SHA256 used for voucherCode duplicate detection
// (random-IV encryption can't be compared, so we store a hash for lookups)
export function hmac(value: string): string {
  return crypto.createHmac("sha256", getKey()).update(value).digest("hex");
}
