import { Router, Request, Response, NextFunction } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../db";

const router = Router();

function buildWhere(q: Record<string, string>) {
  const where: Record<string, unknown> = {};
  if (q.entity) where.entity = q.entity;
  if (q.action) where.action = { contains: q.action, mode: "insensitive" };
  if (q.from || q.to) {
    where.createdAt = {
      ...(q.from ? { gte: new Date(q.from) }                        : {}),
      ...(q.to   ? { lte: new Date(q.to + "T23:59:59.999Z") }      : {}),
    };
  }
  return where;
}

// GET /api/audit — paginated list with filters
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q     = req.query as Record<string, string>;
    const page  = Math.max(1, parseInt(q.page  || "1",  10));
    const limit = Math.min(200, Math.max(1, parseInt(q.limit || "50", 10)));
    const where = buildWhere(q);

    const [total, data] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
    ]);

    res.json({ data, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/audit/export — download as Excel
router.get("/export", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where = buildWhere(req.query as Record<string, string>);

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50000,
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = "Voucher Tracker";
    wb.created = new Date();

    const ws = wb.addWorksheet("Audit Log");
    const headerRow = ws.addRow([
      "Timestamp (IST)", "Action", "Entity", "Details", "Status", "Duration (ms)", "IP Address", "Path",
    ]);
    headerRow.eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A6B4A" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    });
    headerRow.height = 24;
    [22, 26, 18, 40, 10, 16, 18, 36].forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    for (const log of logs) {
      const row = ws.addRow([
        new Date(log.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        log.action,
        log.entity,
        log.details  ?? "",
        log.statusCode,
        log.durationMs,
        log.ipAddress ?? "",
        log.path,
      ]);
      row.height = 18;
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="audit-log-${new Date().toISOString().split("T")[0]}.xlsx"`);
    await wb.xlsx.write(res);
  } catch (err) { next(err); }
});

export default router;
