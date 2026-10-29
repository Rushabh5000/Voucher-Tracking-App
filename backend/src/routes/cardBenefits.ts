import { Router, Request, Response, NextFunction } from "express";
import { AppError } from "../middleware/errorHandler";
import { prisma } from "../db";

const router = Router();

const VALID_PERIOD_TYPES = ["QUARTERLY", "HALF_YEARLY", "YEARLY"];

function userWhere(req: Request): { userId: string | null } {
  const u = req.user!;
  return { userId: u.role === "admin" ? null : u.userId };
}

// GET / — list all card benefits for the current user
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const benefits = await prisma.cardBenefit.findMany({
      where:   userWhere(req),
      orderBy: [{ bank: "asc" }, { cardType: "asc" }, { brand: "asc" }],
    });
    res.json({ data: benefits });
  } catch (e) { next(e); }
});

// POST / — create a card benefit
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bank, cardType, brand, periodType } = req.body;
    if (!bank?.trim())       throw new AppError(400, "bank is required");
    if (!cardType?.trim())   throw new AppError(400, "cardType is required");
    if (!brand?.trim())      throw new AppError(400, "brand is required");
    if (!periodType?.trim()) throw new AppError(400, "periodType is required");
    if (!VALID_PERIOD_TYPES.includes(periodType)) {
      throw new AppError(400, "periodType must be QUARTERLY, HALF_YEARLY, or YEARLY");
    }

    const u = req.user!;
    const userId = u.role === "admin" ? null : u.userId;

    const existing = await prisma.cardBenefit.findFirst({
      where: { bank: bank.trim(), cardType: cardType.trim(), brand: brand.trim(), userId },
    });
    if (existing) throw new AppError(409, "This benefit is already defined for this card type");

    const benefit = await prisma.cardBenefit.create({
      data: { bank: bank.trim(), cardType: cardType.trim(), brand: brand.trim(), periodType, userId },
    });
    res.status(201).json({ data: benefit });
  } catch (e) { next(e); }
});

// DELETE /:id — remove a card benefit
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.cardBenefit.findFirst({
      where: { id: req.params.id, ...userWhere(req) },
    });
    if (!existing) throw new AppError(404, "Benefit not found");
    await prisma.cardBenefit.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
