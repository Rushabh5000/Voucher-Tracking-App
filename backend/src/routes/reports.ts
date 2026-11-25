import { Router, Request, Response, NextFunction } from "express";
import { generateExcel, generatePDF, generateMasterExcel } from "../services/exportService";
import { buildAnalytics } from "../services/analyticsService";
import { sendMonthlyReport } from "../services/emailService";

const router = Router();

function userId(req: Request): string | null {
  const u = req.user!;
  return u.role === "admin" ? null : u.userId;
}

// GET /api/analytics — structured analytics data for charts
router.get("/analytics", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await buildAnalytics(userId(req));
    res.json({ data });
  } catch (e) { next(e); }
});

// GET /api/export/excel
router.get("/export/excel", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await generateExcel(res, userId(req));
  } catch (e) { next(e); }
});

// GET /api/export/pdf
router.get("/export/pdf", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await generatePDF(res, userId(req));
  } catch (e) { next(e); }
});

// GET /api/export/excel/master — full DB dump
router.get("/export/excel/master", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await generateMasterExcel(res, userId(req));
  } catch (e) { next(e); }
});

// POST /api/export/email — trigger monthly report email manually
router.post("/export/email", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await sendMonthlyReport();
    res.json({ success: true, message: "Monthly report email sent" });
  } catch (e) { next(e); }
});

export default router;
