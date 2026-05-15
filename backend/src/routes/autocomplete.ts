import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { upsertAutocomplete, renameValue, deleteEntry } from "../services/autocompleteService";
import { auditWriter } from "../services/auditService";

const router = Router();
const prisma = new PrismaClient();

// GET /all — all entries grouped by field, for the settings manager
router.get("/all", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await prisma.autocompleteEntry.findMany({
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

// GET /?field=bank&q=hd&contextField=brand&contextValue=Amazon — suggestions for a field, optionally filtered by prefix and context
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { field, q, contextField, contextValue } = req.query as { field?: string; q?: string; contextField?: string; contextValue?: string };
    if (!field) {
      res.status(400).json({ error: "field query param required" });
      return;
    }

    // Build context filter for specific field combinations (e.g., title filtered by brand)
    let contextFilter: Record<string, any> | undefined;
    if (contextField && contextValue && field === "title" && contextField === "brand") {
      // Filter title suggestions by the selected brand from vouchers
      contextFilter = {
        brand: contextValue,
      };
    }

    // Get all matching autocomplete entries for the field
    let entries = await prisma.autocompleteEntry.findMany({
      where: {
        field,
        value: q ? { contains: q, mode: "insensitive" } : undefined,
      },
      orderBy: [{ count: "desc" }, { value: "asc" }],
      take: 100, // Get more entries for filtering
    });

    // If context filter is defined, apply it by checking which values exist in vouchers
    if (contextFilter) {
      const vouchersWithContext = await prisma.voucher.findMany({
        where: contextFilter,
        select: { title: true },
        distinct: ["title"],
      });
      const validTitles = new Set(vouchersWithContext.map(v => v.title).filter(t => t));
      entries = entries.filter(e => validTitles.has(e.value));
    }

    // Limit to 20 results
    entries = entries.slice(0, 20);

    res.json({ data: entries.map((e: { value: string }) => e.value) });
  } catch (err) { next(err); }
});

// POST / — manually upsert a value
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

// PATCH / — rename a value and cascade to all related records
router.patch("/", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const { field, oldValue, newValue } = req.body;
    if (!field || !oldValue || !newValue) {
      res.status(400).json({ error: "field, oldValue, newValue required" });
      return;
    }
    await renameValue(field, oldValue, newValue);

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

// DELETE / — remove an autocomplete entry (does not cascade to vouchers/cards)
router.delete("/", async (req: Request, res: Response, next: NextFunction) => {
  const startAt = Date.now();
  try {
    const { field, value } = req.body;
    if (!field || !value) {
      res.status(400).json({ error: "field and value required" });
      return;
    }
    await deleteEntry(field, value);

    auditWriter(req, startAt)(
      "Removed field suggestion", "AutocompleteEntry", null,
      `${field}: "${value}"`
    );

    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
