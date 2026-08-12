import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import { upsertAutocomplete } from "../services/autocompleteService";
import { auditWriter } from "../services/auditService";
import { encrypt, decrypt } from "../services/encryptionService";
import { prisma } from "../db";

const router = Router();

const ENC_FIELDS = ["cardLabel", "brand", "bookingId"] as const;

function userWhere(req: Request): { userId: string | null } {
  const u = req.user!;
  return { userId: u.role === "admin" ? null : u.userId };
}

function formatLog(l: any) {
  const d: any = { ...l };
  for (const f of ENC_FIELDS) if (d[f]) d[f] = decrypt(d[f]);
  return d;
}

// POST / — record that a Card Vault CVV was copied for a transaction.
// Never receives or stores the CVV or card number itself — only a label
// identifying which card, plus optional brand/booking ID for reconciling
// with the purchase afterward.
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const { cardLabel, brand, bookingId } = req.body;
    if (!cardLabel?.trim()) throw new AppError(400, "cardLabel is required");

    const log = await prisma.cvvUsageLog.create({
      data: {
        cardLabel: encrypt(cardLabel.trim()),
        brand:     brand?.trim()     ? encrypt(brand.trim())     : "",
        bookingId: bookingId?.trim() ? encrypt(bookingId.trim()) : "",
        ...userWhere(req),
      },
    });

    // Booking IDs are always unique per transaction, so there's no value in
    // an autocomplete list for them — only brand gets one.
    if (brand?.trim()) await upsertAutocomplete("brand", brand.trim(), req.user?.userId ?? null);

    auditWriter(req, startAt)("Copied CVV", "CvvUsageLog", log.id, cardLabel.trim(), 201);
    res.status(201).json({ data: formatLog(log) });
  } catch (e) { next(e); }
});

// GET /lookup?bookingId=... — find the CVV usage entry for a booking ID, so
// Add Voucher can auto-fill brand/source card from it. bookingId is
// encrypted non-deterministically, so this decrypts and compares in app
// code rather than filtering in the DB query.
router.get("/lookup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId } = req.query as { bookingId?: string };
    if (!bookingId?.trim()) { res.json({ data: null }); return; }

    const target = bookingId.trim().toLowerCase();
    const logs = await prisma.cvvUsageLog.findMany({
      where:   userWhere(req),
      orderBy: { createdAt: "desc" },
    });
    const match = logs.find((l) => l.bookingId && decrypt(l.bookingId).trim().toLowerCase() === target);
    res.json({ data: match ? formatLog(match) : null });
  } catch (e) { next(e); }
});

export default router;
