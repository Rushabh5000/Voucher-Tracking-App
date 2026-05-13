import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { upsertAutocomplete } from "../services/autocompleteService";

const router = Router();
const prisma = new PrismaClient();

function effectiveStatus(v: { status: string; expiryDate: Date | null | undefined }): string {
  if (v.status === "REDEEMED") return "REDEEMED";
  if (v.expiryDate && v.expiryDate < new Date()) return "EXPIRED";
  return "UNREDEEMED";
}

function formatVoucher(v: any) {
  return { ...v, status: effectiveStatus(v) };
}

// GET / — list all
router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const vouchers = await prisma.voucher.findMany({ orderBy: { dateAdded: "asc" } });
    res.json({ data: vouchers.map(formatVoucher) });
  } catch (e) { next(e); }
});

// GET /next — next eligible (optionally by brand) — must be before /:id
router.get("/next", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { brand } = req.query;
    const where: any = {
      status: "UNREDEEMED",
      OR: [{ expiryDate: null }, { expiryDate: { gte: new Date() } }],
    };
    if (brand && brand !== "ALL") where.brand = brand;

    const voucher = await prisma.voucher.findFirst({ where, orderBy: { dateAdded: "asc" } });
    res.json({ data: voucher ? formatVoucher(voucher) : null });
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
  try {
    const {
      title, voucherCode, brand, sourceProgramOrCard, description,
      expiryDate, issueDate, emailId, cardOwner, cardName,
    } = req.body;

    if (!voucherCode?.trim()) throw new AppError(400, "voucherCode is required");
    if (!brand?.trim())       throw new AppError(400, "brand is required");

    const dup = await prisma.voucher.findUnique({ where: { voucherCode: voucherCode.trim() } });
    if (dup) throw new AppError(409, "A voucher with this code already exists");

    const voucher = await prisma.voucher.create({
      data: {
        title:               (title || "").trim(),
        voucherCode:         voucherCode.trim(),
        brand:               brand.trim(),
        sourceProgramOrCard: (sourceProgramOrCard || "").trim(),
        description:         (description || "").trim(),
        expiryDate:          expiryDate ? new Date(expiryDate) : null,
        issueDate:           issueDate ? new Date(issueDate) : new Date(),
        emailId:             (emailId || "").trim(),
        cardOwner:           (cardOwner || "").trim(),
        cardName:            (cardName || "").trim(),
      },
    });

    // Persist autocomplete
    const acFields: Array<[string, string]> = [
      ["brand", voucher.brand],
      ["sourceProgramOrCard", voucher.sourceProgramOrCard],
    ];
    await Promise.all(
      acFields.filter(([, v]) => v.trim()).map(([field, value]) => upsertAutocomplete(field, value))
    );

    res.status(201).json({ data: formatVoucher(voucher) });
  } catch (e) { next(e); }
});

// PATCH /:id/redeem
router.patch("/:id/redeem", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.voucher.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Voucher not found");
    if (existing.status === "REDEEMED") { res.json({ data: formatVoucher(existing) }); return; }
    const updated = await prisma.voucher.update({
      where: { id: req.params.id },
      data: { status: "REDEEMED", redeemedAt: new Date() },
    });
    res.json({ data: formatVoucher(updated) });
  } catch (e) { next(e); }
});

// PATCH /:id/unredeem
router.patch("/:id/unredeem", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.voucher.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Voucher not found");
    const updated = await prisma.voucher.update({
      where: { id: req.params.id },
      data: { status: "UNREDEEMED", redeemedAt: null },
    });
    res.json({ data: formatVoucher(updated) });
  } catch (e) { next(e); }
});

// DELETE /:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.voucher.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Voucher not found");
    await prisma.voucher.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
