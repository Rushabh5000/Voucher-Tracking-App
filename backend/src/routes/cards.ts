import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../middleware/errorHandler";
import { upsertAutocomplete } from "../services/autocompleteService";

const router = Router();
const prisma = new PrismaClient();

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
  try {
    const { accountOwner, cardName, bank, lastFourDigits, email, mobileNumber } = req.body;
    if (!accountOwner?.trim())   throw new AppError(400, "accountOwner is required");
    if (!cardName?.trim())       throw new AppError(400, "cardName is required");
    if (!bank?.trim())           throw new AppError(400, "bank is required");
    if (!lastFourDigits?.trim()) throw new AppError(400, "lastFourDigits is required");
    if (!/^\d{4}$/.test(lastFourDigits.trim())) {
      throw new AppError(400, "lastFourDigits must be exactly 4 digits");
    }

    const card = await prisma.card.create({
      data: {
        accountOwner:   accountOwner.trim(),
        cardName:       cardName.trim(),
        bank:           bank.trim(),
        lastFourDigits: lastFourDigits.trim(),
        email:          (email || "").trim(),
        mobileNumber:   (mobileNumber || "").trim(),
      },
    });

    // Persist autocomplete suggestions
    await Promise.all([
      upsertAutocomplete("accountOwner", card.accountOwner),
      upsertAutocomplete("bank",         card.bank),
      card.email        ? upsertAutocomplete("email",        card.email)        : Promise.resolve(),
      card.mobileNumber ? upsertAutocomplete("mobileNumber", card.mobileNumber) : Promise.resolve(),
    ]);

    res.status(201).json({ data: card });
  } catch (e) { next(e); }
});

// PATCH /:id — update card
router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.card.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Card not found");

    const { accountOwner, cardName, bank, lastFourDigits, email, mobileNumber } = req.body;

    if (lastFourDigits && !/^\d{4}$/.test(lastFourDigits.trim())) {
      throw new AppError(400, "lastFourDigits must be exactly 4 digits");
    }

    const updated = await prisma.card.update({
      where: { id: req.params.id },
      data: {
        accountOwner:   accountOwner?.trim()   ?? existing.accountOwner,
        cardName:       cardName?.trim()       ?? existing.cardName,
        bank:           bank?.trim()           ?? existing.bank,
        lastFourDigits: lastFourDigits?.trim() ?? existing.lastFourDigits,
        email:          email?.trim()          ?? existing.email,
        mobileNumber:   mobileNumber?.trim()   ?? existing.mobileNumber,
      },
    });
    res.json({ data: updated });
  } catch (e) { next(e); }
});

// DELETE /:id
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.card.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, "Card not found");
    await prisma.card.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
