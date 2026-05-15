import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { upsertAutocomplete } from "../services/autocompleteService";
import { auditWriter } from "../services/auditService";

const router = Router();
const prisma = new PrismaClient();

function cardDetails(c: { cardName: string; lastFourDigits: string; bank: string }): string {
  return `${c.cardName} ending ${c.lastFourDigits} (${c.bank})`;
}

// GET / — list all cards
router.get("/", async (_req, res: Response, next: NextFunction) => {
  try {
    const cards = await prisma.card.findMany({ orderBy: { createdAt: "asc" } });
    res.json({ data: cards });
  } catch (e) { next(e); }
});

// GET /:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const card = await prisma.card.findUnique({ where: { id: req.params.id } });
    if (!card) throw new AppError(404, "Card not found");
    res.json({ data: card });
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
    if (!email?.trim())        throw new AppError(400, "email is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new AppError(400, "Invalid email address");
    }
    if (!mobileNumber?.trim()) throw new AppError(400, "mobileNumber is required");
    if (!/^\d{1,10}$/.test(mobileNumber.trim())) {
      throw new AppError(400, "Mobile number must be up to 10 digits only");
    }

    const card = await prisma.card.create({
      data: {
        accountOwner:   accountOwner.trim(),
        cardName:       cardName.trim(),
        bank:           bank.trim(),
        cardType:       cardType.trim(),
        lastFourDigits: lastFourDigits.trim(),
        email:          (email || "").trim(),
        mobileNumber:   (mobileNumber || "").trim(),
      },
    });

    await Promise.all([
      upsertAutocomplete("accountOwner", card.accountOwner),
      upsertAutocomplete("bank",         card.bank),
      upsertAutocomplete("cardType",     card.cardType),
      card.email        ? upsertAutocomplete("email",        card.email)        : Promise.resolve(),
      card.mobileNumber ? upsertAutocomplete("mobileNumber", card.mobileNumber) : Promise.resolve(),
    ]);

    auditWriter(req, startAt)(
      "Created card", "Card", card.id, cardDetails(card), 201
    );

    res.status(201).json({ data: card });
  } catch (e) { next(e); }
});

// PATCH /:id — update card
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const existing = await prisma.card.findUnique({ where: { id: req.params.id } });
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

    const updated = await prisma.card.update({
      where: { id: req.params.id },
      data: {
        accountOwner:   accountOwner?.trim()   ?? existing.accountOwner,
        cardName:       cardName?.trim()       ?? existing.cardName,
        bank:           bank?.trim()           ?? existing.bank,
        cardType:       cardType?.trim()       ?? existing.cardType,
        lastFourDigits: lastFourDigits?.trim() ?? existing.lastFourDigits,
        email:          email?.trim()          ?? existing.email,
        mobileNumber:   mobileNumber?.trim()   ?? existing.mobileNumber,
      },
    });

    auditWriter(req, startAt)(
      "Updated card", "Card", updated.id, cardDetails(updated)
    );

    res.json({ data: updated });
  } catch (e) { next(e); }
});

// DELETE /:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const existing = await prisma.card.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Card not found");
    await prisma.card.delete({ where: { id: req.params.id } });

    auditWriter(req, startAt)(
      "Deleted card", "Card", existing.id, cardDetails(existing)
    );

    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
