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

// bookingId is encrypted non-deterministically, so uniqueness can't be
// enforced with a DB constraint — decrypt and compare in app code, same
// approach as the Card duplicate check.
async function findDuplicateBookingId(bookingId: string, userId: string | null, excludeId?: string): Promise<boolean> {
  const target = bookingId.trim().toLowerCase();
  if (!target) return false;
  const logs = await prisma.cvvUsageLog.findMany({ where: { userId, bookingId: { not: "" } } });
  return logs.some((l) => l.id !== excludeId && decrypt(l.bookingId).trim().toLowerCase() === target);
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

    const uid = req.user?.userId ?? null;
    if (bookingId?.trim() && await findDuplicateBookingId(bookingId, uid)) {
      throw new AppError(409, "This booking ID is already logged against another entry");
    }

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
    if (brand?.trim()) await upsertAutocomplete("brand", brand.trim(), uid);

    auditWriter(req, startAt)("Copied CVV", "CvvUsageLog", log.id, cardLabel.trim(), 201);
    res.status(201).json({ data: formatLog(log) });
  } catch (e) { next(e); }
});

// PATCH /:id — correct a logged entry's brand/booking ID after the fact.
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const existing = await prisma.cvvUsageLog.findFirst({ where: { id: req.params.id, ...userWhere(req) } });
    if (!existing) throw new AppError(404, "Log entry not found");

    const { brand, bookingId } = req.body;
    const uid = req.user?.userId ?? null;
    if (bookingId?.trim() && await findDuplicateBookingId(bookingId, uid, existing.id)) {
      throw new AppError(409, "This booking ID is already logged against another entry");
    }

    const updated = await prisma.cvvUsageLog.update({
      where: { id: req.params.id },
      data: {
        brand:     brand     !== undefined ? (brand.trim()     ? encrypt(brand.trim())     : "") : existing.brand,
        bookingId: bookingId !== undefined ? (bookingId.trim() ? encrypt(bookingId.trim()) : "") : existing.bookingId,
      },
    });

    if (brand?.trim()) await upsertAutocomplete("brand", brand.trim(), uid);

    auditWriter(req, startAt)("Updated CVV usage log", "CvvUsageLog", updated.id, decrypt(updated.cardLabel));
    res.json({ data: formatLog(updated) });
  } catch (e) { next(e); }
});

// GET / — list this user's logged entries, newest first. Powers both the
// Booking ID picker on Add Voucher (which filters to entries that have a
// booking ID) and the CVV log view/edit screen (which shows everything,
// including entries still missing a booking ID).
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await prisma.cvvUsageLog.findMany({
      where:   userWhere(req),
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ data: logs.map(formatLog) });
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
