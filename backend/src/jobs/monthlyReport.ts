import cron from "node-cron";
import { sendMonthlyReport, checkAndSendIfOverdue } from "../services/emailService";

const SCHEDULE = process.env.REPORT_CRON || "30 3 28-31 * *";

export function startMonthlyReportJob(): void {
  // ── Step 1: Startup catch-up check ────────────────────────────────────────
  // Run after a short delay so the DB connection is fully ready
  setTimeout(async () => {
    try {
      await checkAndSendIfOverdue();
    } catch (err) {
      console.error("[Email] Startup overdue check failed:", err);
    }
  }, 5000); // 5 s delay gives Prisma time to connect cleanly

  // ── Step 2: Schedule the regular cron ─────────────────────────────────────
  if (!cron.validate(SCHEDULE)) {
    console.warn(`[Cron] Invalid schedule "${SCHEDULE}" — monthly report cron not started`);
    return;
  }

  cron.schedule(SCHEDULE, async () => {
    // Guard: only fire on the actual last day of the month
    const now      = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    if (tomorrow.getMonth() === now.getMonth()) {
      return; // not the last day yet
    }

    console.log(
      `[Cron] End-of-month trigger for ${now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}…`
    );
    try {
      await sendMonthlyReport();
    } catch (err) {
      console.error("[Cron] Monthly report failed:", err);
    }
  }, { timezone: "Asia/Kolkata" });

  console.log(`[Cron] Monthly report scheduled: "${SCHEDULE}" (IST)`);
}
