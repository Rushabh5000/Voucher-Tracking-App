import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { upsertAutocomplete } from "../services/autocompleteService";
import { auditWriter } from "../services/auditService";
import { encrypt, decrypt } from "../services/encryptionService";

const router = Router();
const prisma = new PrismaClient();

const ENC_FIELDS = ["accountOwner", "lastFourDigits", "email", "mobileNumber"] as const;

function userWhere(req: Request): { userId: string | null } {
  const u = req.user!;
  return { userId: u.role === "admin" ? null : u.userId };
}

function formatCard(c: any) {
  const d: any = { ...c };
  for (const f of ENC_FIELDS) if (d[f]) d[f] = decrypt(d[f]);
  return d;
}

function encryptCardFields(data: Partial<Record<typeof ENC_FIELDS[number], string>>) {
  const out: any = {};
  for (const f of ENC_FIELDS) if (f in data) out[f] = (data as any)[f] ? encrypt((data as any)[f]) : (data as any)[f];
  return out;
}

function cardDetails(c: { cardName: string; lastFourDigits: string; bank: string }): string {
  return `${c.cardName} ending ${decrypt(c.lastFourDigits)} (${c.bank})`;
}

// GET / — list cards for current user
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cards = await prisma.card.findMany({
      where:   userWhere(req),
      orderBy: { createdAt: "asc" },
    });
    res.json({ data: cards.map(formatCard) });
  } catch (e) { next(e); }
});

// GET /:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const card = await prisma.card.findFirst({ where: { id: req.params.id, ...userWhere(req) } });
    if (!card) throw new AppError(404, "Card not found");
    res.json({ data: formatCard(card) });
  } catch (e) { next(e); }
});

// POST / — create card
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const { accountOwner, cardName, bank, cardType, lastFourDigits, email, mobileNumber } = req.body;
    if (!accountOwner?.trim())   throw new AppError(400, "accountOwner is required");
    if (!cardName?.trim())       throw new AppError(400, "cardName is required");
    if (!bank?.trim())           throw new AppError(400, "bank is required");
    if (!cardType?.trim())       throw new AppError(400, "cardType is required");
    if (!lastFourDigits?.trim()) throw new AppError(400, "lastFourDigits is required");
    if (!/^\d{4}$/.test(lastFourDigits.trim())) {
      throw new AppError(400, "lastFourDigits must be exactly 4 digits");
    }
    if (!email?.trim()) throw new AppError(400, "email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new AppError(400, "Invalid email address");
    }
    if (!mobileNumber?.trim()) throw new AppError(400, "mobileNumber is required");
    if (!/^\d{1,10}$/.test(mobileNumber.trim())) {
      throw new AppError(400, "Mobile number must be up to 10 digits only");
    }

    const card = await prisma.card.create({
      data: {
        ...encryptCardFields({
          accountOwner:   accountOwner.trim(),
          lastFourDigits: lastFourDigits.trim(),
          email:          email.trim(),
          mobileNumber:   mobileNumber.trim(),
        }),
        cardName: cardName.trim(),
        bank:     bank.trim(),
        cardType: cardType.trim(),
        ...userWhere(req),
      },
    });

    const uid = req.user?.userId ?? null;
    await Promise.all([
      upsertAutocomplete("accountOwner", accountOwner.trim(), uid),
      upsertAutocomplete("bank",         bank.trim(),         uid),
      upsertAutocomplete("cardType",     cardType.trim(),     uid),
      email        ? upsertAutocomplete("email",        email.trim(),        uid) : Promise.resolve(),
      mobileNumber ? upsertAutocomplete("mobileNumber", mobileNumber.trim(), uid) : Promise.resolve(),
    ]);

    auditWriter(req, startAt)("Created card", "Card", card.id, cardDetails(card), 201);
    res.status(201).json({ data: formatCard(card) });
  } catch (e) { next(e); }
});

// PATCH /:id — update card
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const existing = await prisma.card.findFirst({ where: { id: req.params.id, ...userWhere(req) } });
    if (!existing) throw new AppError(404, "Card not found");

    const { accountOwner, cardName, bank, cardType, lastFourDigits, email, mobileNumber } = req.body;

    if (lastFourDigits && !/^\d{4}$/.test(lastFourDigits.trim())) {
      throw new AppError(400, "lastFourDigits must be exactly 4 digits");
    }
    if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new AppError(400, "Invalid email address");
    }
    if (mobileNumber?.trim() && !/^\d{1,10}$/.test(mobileNumber.trim())) {
      throw new AppError(400, "Mobile number must be up to 10 digits only");
    }

    const encUpdate: any = {};
    if (accountOwner   !== undefined) encUpdate.accountOwner   = accountOwner.trim()   ? encrypt(accountOwner.trim())   : existing.accountOwner;
    if (lastFourDigits !== undefined) encUpdate.lastFourDigits = lastFourDigits.trim()  ? encrypt(lastFourDigits.trim()) : existing.lastFourDigits;
    if (email          !== undefined) encUpdate.email          = email.trim()           ? encrypt(email.trim())          : existing.email;
    if (mobileNumber   !== undefined) encUpdate.mobileNumber   = mobileNumber.trim()   ? encrypt(mobileNumber.trim())   : existing.mobileNumber;

    const updated = await prisma.card.update({
      where: { id: req.params.id },
      data: {
        ...encUpdate,
        cardName: cardName?.trim() ?? existing.cardName,
        bank:     bank?.trim()     ?? existing.bank,
        cardType: cardType?.trim() ?? existing.cardType,
      },
    });

    auditWriter(req, startAt)("Updated card", "Card", updated.id, cardDetails(updated));
    res.json({ data: formatCard(updated) });
  } catch (e) { next(e); }
});

// DELETE /:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const existing = await prisma.card.findFirst({ where: { id: req.params.id, ...userWhere(req) } });
    if (!existing) throw new AppError(404, "Card not found");
    await prisma.card.delete({ where: { id: req.params.id } });
    auditWriter(req, startAt)("Deleted card", "Card", existing.id, cardDetails(existing));
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
