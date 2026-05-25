import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { upsertAutocomplete, renameValue, deleteEntry } from "../services/autocompleteService";
import { auditWriter } from "../services/auditService";

const router = Router();
const prisma = new PrismaClient();

// GET /all — all entries grouped by field, scoped to the requesting user (for Settings manager)
router.get("/all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId ?? null;
    const entries = await prisma.autocompleteEntry.findMany({
      where: { userId },
      orderBy: [{ field: "asc" }, { count: "desc" }, { value: "asc" }],
    });
    const grouped: Record<string, string[]> = {};
    for (const e of entries) {
      if (!grouped[e.field]) grouped[e.field] = [];
      grouped[e.field].push(e.value);
    }
    res.json({ data: grouped });
  } catch (err) { next(err); }
});

// GET /?field=bank&q=hd — suggestions scoped to the requesting user
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId ?? null;
    const { field, q, contextField, contextValue } = req.query as {
      field?: string; q?: string; contextField?: string; contextValue?: string;
    };
    if (!field) {
      res.status(400).json({ error: "field query param required" });
      return;
    }

    let contextFilter: Record<string, any> | undefined;
    if (contextField && contextValue && field === "title" && contextField === "brand") {
      contextFilter = { brand: contextValue, userId };
    }

    let entries = await prisma.autocompleteEntry.findMany({
      where: {
        field,
        userId,
        value: q ? { contains: q, mode: "insensitive" } : undefined,
      },
      orderBy: [{ count: "desc" }, { value: "asc" }],
      take: 100,
    });

    if (contextFilter) {
      const vouchersWithContext = await prisma.voucher.findMany({
        where: contextFilter,
        select: { title: true },
        distinct: ["title"],
      });
      const validTitles = new Set(vouchersWithContext.map(v => v.title).filter(t => t));
      entries = entries.filter(e => validTitles.has(e.value));
    }

    entries = entries.slice(0, 20);
    res.json({ data: entries.map((e: { value: string }) => e.value) });
  } catch (err) { next(err); }
});

// POST / — manually upsert a value for this user
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { field, value } = req.body;
    if (!field || !value) {
      res.status(400).json({ error: "field and value required" });
      return;
    }
    const userId = req.user?.userId ?? null;
    await upsertAutocomplete(field, value, userId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH / — rename a value and cascade to this user's records
router.patch("/", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const { field, oldValue, newValue } = req.body;
    if (!field || !oldValue || !newValue) {
      res.status(400).json({ error: "field, oldValue, newValue required" });
      return;
    }
    const userId = req.user?.userId ?? null;
    await renameValue(field, oldValue, newValue, userId);

    auditWriter(req, startAt)(
      "Renamed field value", "AutocompleteEntry", null,
      `${field}: "${oldValue}" → "${newValue.trim()}"`
    );

    res.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes("already exists") || err.message?.includes("cannot be empty")) {
      res.status(409).json({ error: err.message });
    } else {
      next(err);
    }
  }
});

// DELETE / — remove an autocomplete entry for this user
router.delete("/", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const { field, value } = req.body;
    if (!field || !value) {
      res.status(400).json({ error: "field and value required" });
      return;
    }
    const userId = req.user?.userId ?? null;
    await deleteEntry(field, value, userId);

    auditWriter(req, startAt)(
      "Removed field suggestion", "AutocompleteEntry", null,
      `${field}: "${value}"`
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
