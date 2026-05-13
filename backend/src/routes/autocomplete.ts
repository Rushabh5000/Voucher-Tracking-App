import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { upsertAutocomplete } from "../services/autocompleteService";

const router = Router();
const prisma = new PrismaClient();

// GET /api/autocomplete?field=bank&q=hd
// Returns suggestions for a given field, optionally filtered by prefix
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { field, q } = req.query as { field?: string; q?: string };
    if (!field) {
      res.status(400).json({ error: "field query param required" });
      return;
    }
    const entries = await prisma.autocompleteEntry.findMany({
      where: {
        field,
        value: q ? { contains: q, mode: "insensitive" } : undefined,
      },
      orderBy: [{ count: "desc" }, { value: "asc" }],
      take: 20,
    });
    res.json({ data: entries.map((entry: { value: string }) => entry.value) });
  } catch (err) { next(err); }
});

// POST /api/autocomplete — manually upsert a value
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { field, value } = req.body;
    if (!field || !value) {
      res.status(400).json({ error: "field and value required" });
      return;
    }
    await upsertAutocomplete(field, value);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
