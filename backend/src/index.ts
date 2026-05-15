import express from "express";
import cors from "cors";
import path from "path";

import vouchersRouter     from "./routes/vouchers";
import cardsRouter        from "./routes/cards";
import autocompleteRouter from "./routes/autocomplete";
import reportsRouter      from "./routes/reports";
import auditRouter        from "./routes/audit";
import { errorHandler }   from "./middleware/errorHandler";
import { startMonthlyReportJob } from "./jobs/monthlyReport";
import { startBackupJobs }       from "./jobs/backup";

const app  = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// ─── Middleware ─────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "2mb" }));

if (process.env.NODE_ENV !== "production") {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ─── Routes ─────────────────────────────────────────────────
app.use("/api/vouchers",     vouchersRouter);
app.use("/api/cards",        cardsRouter);
app.use("/api/autocomplete", autocompleteRouter);
app.use("/api/audit",        auditRouter);
app.use("/api",              reportsRouter);   // /api/analytics, /api/export/*

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", version: "2.0.0", timestamp: new Date().toISOString() });
});

// Serve React build in production
if (process.env.NODE_ENV === "production") {
  const buildPath = path.join(__dirname, "..", "..", "frontend", "dist");
  app.use(express.static(buildPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
}

// ─── Error handler (must be last) ───────────────────────────
app.use(errorHandler);

// ─── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅  Voucher Tracker API v2.0 running on http://localhost:${PORT}`);
  console.log(`    Health: http://localhost:${PORT}/api/health\n`);
  startMonthlyReportJob();
  startBackupJobs().catch(err => console.error("[Backup] Job startup error:", err));
});

export default app;
