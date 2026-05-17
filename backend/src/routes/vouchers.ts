import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { upsertAutocomplete } from "../services/autocompleteService";
import { auditWriter } from "../services/auditService";
import { encrypt, decrypt, hmac } from "../services/encryptionService";

const router = Router();
const prisma = new PrismaClient();

// Fields encrypted at rest — decrypt before sending to client
const ENC_FIELDS = ["voucherCode", "brand", "title", "sourceProgramOrCard", "description", "emailId", "cardOwner", "cardName"] as const;

function effectiveStatus(v: { status: string; expiryDate: Date | null | undefined }): string {
  if (v.status === "REDEEMED") return "REDEEMED";
  if (v.expiryDate && v.expiryDate < new Date()) return "EXPIRED";
  return "UNREDEEMED";
}

function formatVoucher(v: any) {
  const d: any = { ...v };
  for (const f of ENC_FIELDS) if (d[f]) d[f] = decrypt(d[f]);
  d.status = effectiveStatus(d);
  return d;
}

function encryptFields(data: Partial<Record<typeof ENC_FIELDS[number], string>>) {
  const out: any = {};
  for (const f of ENC_FIELDS) if (f in data) out[f] = (data as any)[f] ? encrypt((data as any)[f]) : (data as any)[f];
  return out;
}

function voucherLabel(v: { brand: string; voucherCode: string }): string {
  return `${decrypt(v.brand)} | ${decrypt(v.voucherCode)}`;
}

// GET / — list all
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const vouchers = await prisma.voucher.findMany({ orderBy: { dateAdded: "asc" } });
    res.json({ data: vouchers.map(formatVoucher) });
  } catch (e) { next(e); }
});

// GET /next — next eligible (optionally by brand, optionally excluding IDs) — must be before /:id
router.get("/next", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { brand, exclude } = req.query as { brand?: string; exclude?: string };
    const excludeIds = exclude ? exclude.split(",").filter(Boolean) : [];

    // Fetch all unredeemed non-expired vouchers; filter brand in memory (brand is encrypted)
    const candidates = await prisma.voucher.findMany({
      where: {
        status: "UNREDEEMED",
        OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
      },
      orderBy: { dateAdded: "asc" },
    });

    const filtered = (brand && brand !== "ALL")
      ? candidates.filter(v => decrypt(v.brand) === brand)
      : candidates;

    res.json({ data: filtered[0] ? formatVoucher(filtered[0]) : null });
  } catch (e) { next(e); }
});

// GET /:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const voucher = await prisma.voucher.findUnique({ where: { id: req.params.id } });
    if (!voucher) throw new AppError(404, "Voucher not found");
    res.json({ data: formatVoucher(voucher) });
  } catch (e) { next(e); }
});

// POST / — create
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const {
      title, voucherCode, brand, sourceProgramOrCard, description,
      expiryDate, issueDate, emailId, cardOwner, cardName,
    } = req.body;

    if (!voucherCode?.trim()) throw new AppError(400, "voucherCode is required");
    if (!brand?.trim())       throw new AppError(400, "brand is required");

    const normalizedCode = voucherCode.trim().toLowerCase();
    const codeHash = hmac(normalizedCode);

    const dup = await prisma.voucher.findUnique({ where: { voucherCodeHash: codeHash } });
    if (dup) throw new AppError(409, "A voucher with this code already exists");

    const voucher = await prisma.voucher.create({
      data: {
        ...encryptFields({
          title:               (title || "").trim(),
          voucherCode:         normalizedCode,
          brand:               brand.trim(),
          sourceProgramOrCard: (sourceProgramOrCard || "").trim(),
          description:         (description || "").trim(),
          emailId:             (emailId || "").trim(),
          cardOwner:           (cardOwner || "").trim(),
          cardName:            (cardName || "").trim(),
        }),
        voucherCodeHash: codeHash,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        issueDate:  issueDate  ? new Date(issueDate)  : new Date(),
      },
    });

    // Autocomplete stores plaintext (suggestion hints only, not sensitive on their own)
    const acFields: Array<[string, string]> = [
      ["brand",               brand.trim()],
      ["title",               (title || "").trim()],
      ["sourceProgramOrCard", (sourceProgramOrCard || "").trim()],
    ];
    await Promise.all(
      acFields.filter(([, v]) => v.trim()).map(([field, value]) => upsertAutocomplete(field, value))
    );

    auditWriter(req, startAt)(
      "Created voucher", "Voucher", voucher.id, `${brand.trim()} | ${normalizedCode}`, 201
    );

    res.status(201).json({ data: formatVoucher(voucher) });
  } catch (e) { next(e); }
});

// PATCH /:id — update voucher fields
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const {
      title, brand, sourceProgramOrCard, description,
      expiryDate, issueDate, emailId, cardOwner, cardName,
    } = req.body;

    const existing = await prisma.voucher.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Voucher not found");
    if (!brand?.trim()) throw new AppError(400, "brand is required");

    const updated = await prisma.voucher.update({
      where: { id: req.params.id },
      data: {
        ...encryptFields({
          title:               (title || "").trim(),
          brand:               brand.trim(),
          sourceProgramOrCard: (sourceProgramOrCard || "").trim(),
          description:         (description || "").trim(),
          emailId:             (emailId || "").trim(),
          cardOwner:           (cardOwner || "").trim(),
          cardName:            (cardName || "").trim(),
        }),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        issueDate:  issueDate  ? new Date(issueDate)  : existing.issueDate,
      },
    });

    const acFields: Array<[string, string]> = [
      ["brand",               brand.trim()],
      ["title",               (title || "").trim()],
      ["sourceProgramOrCard", (sourceProgramOrCard || "").trim()],
    ];
    await Promise.all(
      acFields.filter(([, v]) => v.trim()).map(([field, value]) => upsertAutocomplete(field, value))
    );

    auditWriter(req, startAt)(
      "Updated voucher", "Voucher", updated.id, voucherLabel(updated)
    );

    res.json({ data: formatVoucher(updated) });
  } catch (e) { next(e); }
});

// PATCH /:id/redeem
router.patch("/:id/redeem", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const existing = await prisma.voucher.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Voucher not found");
    if (existing.status === "REDEEMED") { res.json({ data: formatVoucher(existing) }); return; }
    const updated = await prisma.voucher.update({
      where: { id: req.params.id },
      data: { status: "REDEEMED", redeemedAt: new Date() },
    });
    auditWriter(req, startAt)("Redeemed voucher", "Voucher", updated.id, voucherLabel(updated));
    res.json({ data: formatVoucher(updated) });
  } catch (e) { next(e); }
});

// PATCH /:id/unredeem
router.patch("/:id/unredeem", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const existing = await prisma.voucher.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Voucher not found");
    const updated = await prisma.voucher.update({
      where: { id: req.params.id },
      data: { status: "UNREDEEMED", redeemedAt: null },
    });
    auditWriter(req, startAt)("Unredeemed voucher", "Voucher", updated.id, voucherLabel(updated));
    res.json({ data: formatVoucher(updated) });
  } catch (e) { next(e); }
});

// DELETE /:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const existing = await prisma.voucher.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Voucher not found");
    await prisma.voucher.delete({ where: { id: req.params.id } });
    auditWriter(req, startAt)("Deleted voucher", "Voucher", existing.id, voucherLabel(existing));
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
