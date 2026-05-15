import cron from "node-cron";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const execAsync  = promisify(exec);
const prisma     = new PrismaClient();
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");

const SETTING = {
  SOURCE_LAST_RUN: "backup_source_last_run",
  AUDIT_LAST_RUN:  "audit_cleanup_last_run",
} as const;

function backupDir(): string {
  return process.env.BACKUP_DIR || "C:\\Users\\rusha\\OneDrive\\Backup-Vocuher-Tracking-Application";
}

function datestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
}

// ─── AppSetting helpers ───────────────────────────────────────────────────────

async function getLastRun(key: string): Promise<Date | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row ? new Date(row.value) : null;
}

async function setLastRun(key: string): Promise<void> {
  const value = new Date().toISOString();
  await prisma.appSetting.upsert({
    where:  { key },
    update: { value },
    create: { key, value },
  });
}

function daysSince(date: Date | null): number {
  if (!date) return Infinity;
  return (Date.now() - date.getTime()) / 86_400_000;
}

function pastDueReason(date: Date | null, threshold: number): string | null {
  const days = daysSince(date);
  if (days <= threshold) return null;
  return date
    ? `last ran ${Math.floor(days)} day${Math.floor(days) !== 1 ? "s" : ""} ago`
    : "never run before";
}

// ─── Source Code Backup ───────────────────────────────────────────────────────
// Scheduled: 2 AM IST on 1st and 16th of each month (~every 15 days)
// Also runs on startup if past due

export async function backupSourceCode(): Promise<void> {
  const dir     = backupDir();
  const outDir  = path.join(dir, "source");
  const stamp   = new Date().toISOString().split("T")[0];
  const outFile = path.join(outDir, `voucher-tracker-source-${stamp}.zip`);
  const tmpDir  = path.join(outDir, `.tmp-${Date.now()}`);

  fs.mkdirSync(outDir, { recursive: true });

  const ps = [
    `robocopy "${PROJECT_ROOT}" "${tmpDir}" /E /XD node_modules .git dist build .next /XF "*.log" "*.zip" /NFL /NDL /NJH /NJS /nc /ns /np`,
    `powershell -NoProfile -Command "Compress-Archive -Path '${tmpDir}' -DestinationPath '${outFile}' -Force"`,
    `powershell -NoProfile -Command "Remove-Item -Recurse -Force '${tmpDir}'"`,
  ];

  try {
    await execAsync(ps[0], { windowsHide: true }).catch((e: any) => {
      if (e.code > 7) throw e;
    });
    await execAsync(ps[1], { windowsHide: true });
    await setLastRun(SETTING.SOURCE_LAST_RUN);
    console.log(`[Backup] Source code → ${outFile}`);
  } catch (err) {
    console.error("[Backup] Source backup failed:", err);
  } finally {
    await execAsync(ps[2], { windowsHide: true }).catch(() => {});
  }
}

// ─── Database Backup ─────────────────────────────────────────────────────────
// Always runs on server startup.
// Strategy 1: pg_dump on the host (if installed).
// Strategy 2: pg_dump inside the Docker container via docker exec + docker cp.

export async function backupDatabase(): Promise<void> {
  const dir     = backupDir();
  const outDir  = path.join(dir, "db");
  const outFile = path.join(outDir, `voucher-tracker-db-${datestamp()}.dump`);

  const dbUrl = process.env.DATABASE_URL || "";
  const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) {
    console.warn("[Backup] Cannot parse DATABASE_URL — DB backup skipped");
    return;
  }

  const [, user, password, , , dbname] = match;
  fs.mkdirSync(outDir, { recursive: true });

  // ── Strategy 1: host pg_dump ────────────────────────────────────────────────
  const hostArgs = `-U ${user} -d ${dbname} -F c -f "${outFile}"`;
  const hostEnv  = { ...process.env, PGPASSWORD: password };

  const hostCandidates = [
    `pg_dump ${hostArgs}`,
    `"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe" ${hostArgs}`,
    `"C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe" ${hostArgs}`,
    `"C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe" ${hostArgs}`,
    `"C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe" ${hostArgs}`,
  ];

  for (const cmd of hostCandidates) {
    try {
      await execAsync(cmd, { env: hostEnv, windowsHide: true });
      console.log(`[Backup] Database (host pg_dump) → ${outFile}`);
      return;
    } catch {
      // try next candidate
    }
  }

  // ── Strategy 2: pg_dump inside the Docker container ────────────────────────
  const container  = process.env.DB_CONTAINER_NAME || "vt-postgres";
  const tmpInside  = `/tmp/vt-db-backup-${Date.now()}.dump`;

  try {
    // Run pg_dump inside the container (pg_dump is bundled with the postgres image)
    await execAsync(
      `docker exec -e PGPASSWORD=${password} ${container} pg_dump -U ${user} -d ${dbname} -F c -f ${tmpInside}`,
      { windowsHide: true }
    );
    // Copy the dump file from the container to the host backup directory
    await execAsync(`docker cp ${container}:${tmpInside} "${outFile}"`, { windowsHide: true });
    // Remove the temp file from the container
    await execAsync(`docker exec ${container} rm ${tmpInside}`, { windowsHide: true }).catch(() => {});

    console.log(`[Backup] Database (docker exec) → ${outFile}`);
  } catch (dockerErr: any) {
    console.warn(
      `[Backup] DB backup failed — neither host pg_dump nor docker exec worked.\n` +
      `         Container tried: "${container}" (set DB_CONTAINER_NAME in .env to override)\n` +
      `         Docker error: ${dockerErr.message?.split("\n")[0] ?? dockerErr}`
    );
  }
}

// ─── Audit Log Cleanup ────────────────────────────────────────────────────────
// Scheduled: 3 AM IST on 1st of each month
// Also runs on startup if past due (>30 days)

async function pruneAuditLogs(): Promise<void> {
  const months = parseInt(process.env.AUDIT_RETENTION_MONTHS || "12", 10);
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  await setLastRun(SETTING.AUDIT_LAST_RUN);
  if (count > 0) {
    console.log(`[Audit] Pruned ${count} records older than ${months} months`);
  } else {
    console.log(`[Audit] Cleanup ran — no records older than ${months} months found`);
  }
}

// ─── Job Registration ─────────────────────────────────────────────────────────

export async function startBackupJobs(): Promise<void> {

  // ── 1. Always: DB backup on startup ────────────────────────────────────────
  backupDatabase().catch(err => console.error("[Backup] DB backup error:", err));

  // ── 2. Past-due: source code backup if >15 days since last run ─────────────
  const sourceDue = pastDueReason(await getLastRun(SETTING.SOURCE_LAST_RUN), 15);
  if (sourceDue) {
    console.log(`[Backup] Source backup past due (${sourceDue}) — running now…`);
    backupSourceCode().catch(err => console.error("[Backup] Startup source backup error:", err));
  }

  // ── 3. Past-due: audit cleanup if >30 days since last run ──────────────────
  const auditDue = pastDueReason(await getLastRun(SETTING.AUDIT_LAST_RUN), 30);
  if (auditDue) {
    console.log(`[Audit] Cleanup past due (${auditDue}) — running now…`);
    pruneAuditLogs().catch(err => console.error("[Audit] Startup cleanup error:", err));
  }

  // ── 4. Register cron schedules ──────────────────────────────────────────────

  cron.schedule("0 2 1,16 * *", () => {
    backupSourceCode().catch(err => console.error("[Backup] Source cron error:", err));
  }, { timezone: "Asia/Kolkata" });
  console.log("[Cron] Source backup:   1st & 16th of each month at 2 AM IST");

  cron.schedule("0 3 1 * *", () => {
    pruneAuditLogs().catch(err => console.error("[Audit] Cleanup cron error:", err));
  }, { timezone: "Asia/Kolkata" });
  console.log("[Cron] Audit cleanup:   1st of each month at 3 AM IST");
}
