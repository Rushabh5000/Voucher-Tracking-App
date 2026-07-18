import cron from "node-cron";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync  = promisify(exec);
import { prisma } from "../db";
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
// Strategy 1: host pg_dump (if installed, any version ≥ server).
// Strategy 2: docker run postgres:17-alpine — version-matched, works for Supabase.
// Strategy 3: docker exec vt-postgres — local DB only.
// Strategy 4: Prisma JSON export — universal fallback, no external tools needed.

export async function backupDatabase(): Promise<void> {
  const dir    = backupDir();
  const outDir = path.join(dir, "db");
  const stamp  = datestamp();

  const dbUrl = process.env.DATABASE_URL || "";
  const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) {
    console.warn("[Backup] Cannot parse DATABASE_URL — DB backup skipped");
    return;
  }

  const [, dbUser, dbPass, dbHost, dbPort, dbName] = match;
  const isRemote = dbHost !== "localhost" && dbHost !== "127.0.0.1";
  fs.mkdirSync(outDir, { recursive: true });

  const dumpFile = path.join(outDir, `voucher-tracker-db-${stamp}.dump`);

  // ── Strategy 1: host pg_dump ────────────────────────────────────────────────
  const sslSuffix = isRemote ? "?sslmode=require" : "";
  const connStr   = `postgresql://${dbUser}:${encodeURIComponent(dbPass)}@${dbHost}:${dbPort}/${dbName}${sslSuffix}`;
  const connArgs  = `--dbname="${connStr}" -F c -f "${dumpFile}"`;
  const hostEnv   = { ...process.env, PGPASSWORD: dbPass };

  for (const cmd of [
    `pg_dump ${connArgs}`,
    `"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe" ${connArgs}`,
    `"C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe" ${connArgs}`,
    `"C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe" ${connArgs}`,
    `"C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe" ${connArgs}`,
  ]) {
    try {
      await execAsync(cmd, { env: hostEnv, windowsHide: true });
      console.log(`[Backup] Database (host pg_dump) → ${dumpFile}`);
      return;
    } catch { /* try next */ }
  }

  // ── Strategy 2: docker run postgres:17-alpine (version-matched for remote) ──
  // Pulls the image once if not cached; subsequent runs are instant.
  if (isRemote) {
    // Docker Desktop on Windows accepts forward-slash paths: C:\foo\bar → C:/foo/bar
    const mountPath = outDir.replace(/\\/g, "/");
    const dockerRunCmd = [
      `docker run --rm`,
      `-e PGPASSWORD=${dbPass}`,
      `-e PGSSLMODE=require`,
      `-v "${mountPath}:/backup"`,
      `postgres:17-alpine`,
      `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --no-password`,
      `-F c -f /backup/voucher-tracker-db-${stamp}.dump`,
    ].join(" ");

    try {
      await execAsync(dockerRunCmd, { windowsHide: true, timeout: 120_000 });
      console.log(`[Backup] Database (docker run postgres:17-alpine) → ${dumpFile}`);
      return;
    } catch (err: any) {
      console.warn(`[Backup] docker run strategy failed: ${err.message?.split("\n")[0]}`);
    }
  }

  // ── Strategy 3: docker exec inside running vt-postgres (local DB only) ──────
  if (!isRemote) {
    const container = process.env.DB_CONTAINER_NAME || "vt-postgres";
    const tmpInside = `/tmp/vt-db-backup-${Date.now()}.dump`;
    try {
      await execAsync(
        `docker exec -e PGPASSWORD=${dbPass} ${container} pg_dump -U ${dbUser} -d ${dbName} -F c -f ${tmpInside}`,
        { windowsHide: true }
      );
      await execAsync(`docker cp ${container}:${tmpInside} "${dumpFile}"`, { windowsHide: true });
      await execAsync(`docker exec ${container} rm ${tmpInside}`, { windowsHide: true }).catch(() => {});
      console.log(`[Backup] Database (docker exec local) → ${dumpFile}`);
      return;
    } catch { /* fall through */ }
  }

  // ── Strategy 4: Prisma JSON export ──────────────────────────────────────────
  // No external tools required. Works for any DB, any version, any platform.
  await backupDatabaseAsJson(outDir, stamp);
}

async function backupDatabaseAsJson(outDir: string, stamp: string): Promise<void> {
  try {
    const [vouchers, cards, autocomplete, settings] = await Promise.all([
      prisma.voucher.findMany(),
      prisma.card.findMany(),
      prisma.autocompleteEntry.findMany(),
      prisma.appSetting.findMany(),
    ]);
    // Audit log: last 10k rows only (can be large)
    const auditLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });

    const backup = {
      exportedAt: new Date().toISOString(),
      tables: {
        Voucher:           vouchers,
        Card:              cards,
        AutocompleteEntry: autocomplete,
        AppSetting:        settings,
        AuditLog:          auditLogs,
      },
    };

    const outFile = path.join(outDir, `voucher-tracker-db-${stamp}.json`);
    fs.writeFileSync(outFile, JSON.stringify(backup, null, 2));
    console.log(
      `[Backup] Database (JSON export — ${vouchers.length} vouchers, ${cards.length} cards) → ${outFile}`
    );
  } catch (err: any) {
    console.error(`[Backup] JSON export failed: ${err.message}`);
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
  // These backups target the local machine (OneDrive path, host pg_dump /
  // Docker). On Render there's no Docker, no pg_dump, and the disk is
  // ephemeral (wiped on every redeploy/restart) — running them there just
  // burns through failing strategies on every startup and logs noise for a
  // JSON file nobody will ever read. Real backups happen when running
  // locally via `npm run dev`/`npm start`, where Render is unset.
  if (process.env.RENDER) {
    console.log("[Backup] Running on Render — skipping local-disk backup jobs (source + DB dump)");
    return;
  }

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
