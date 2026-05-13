#!/usr/bin/env node
/**
 * Voucher Tracker — First-time setup script
 * Run: npm run setup
 */

const fs   = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW= "\x1b[33m";
const CYAN  = "\x1b[36m";
const RED   = "\x1b[31m";
const BOLD  = "\x1b[1m";

const log    = (m) => console.log(`${GREEN}✔${RESET}  ${m}`);
const info   = (m) => console.log(`${CYAN}ℹ${RESET}  ${m}`);
const warn   = (m) => console.log(`${YELLOW}⚠${RESET}  ${m}`);
const fail   = (m) => { console.log(`${RED}✖${RESET}  ${m}`); process.exit(1); };
const header = (m) => console.log(`\n${BOLD}${CYAN}${m}${RESET}\n`);

function run(cmd, cwd) {
  const r = spawnSync(cmd, { shell: true, stdio: "inherit", cwd: cwd || process.cwd() });
  if (r.status !== 0) fail(`Command failed: ${cmd}`);
}

const ROOT       = __dirname.replace(/[/\\]scripts$/, "");
const backendDir = path.join(ROOT, "backend");
const envPath    = path.join(backendDir, ".env");
const envExample = path.join(backendDir, ".env.example");

// ─── 1. Node version ─────────────────────────────────────────────
header("🎫  Voucher Tracker — Setup");
const [major] = process.versions.node.split(".").map(Number);
if (major < 18) fail(`Node.js 18+ required. You have v${process.versions.node}`);
log(`Node.js v${process.versions.node}`);

// ─── 2. Create .env if missing ───────────────────────────────────
if (!fs.existsSync(envPath)) {
  fs.copyFileSync(envExample, envPath);
  log("Created backend/.env (using docker-compose defaults)");
} else {
  log("backend/.env already exists");
}

// ─── 3. Confirm DATABASE_URL is present ──────────────────────────
const envContent = fs.readFileSync(envPath, "utf-8");
const match = envContent.match(/^DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?/m);
if (!match || !match[1].trim().startsWith("postgresql")) {
  fail(
    "DATABASE_URL not found or invalid in backend/.env\n" +
    "   Expected: postgresql://voucher_user:voucher_pass@localhost:5432/voucher_tracker"
  );
}
log(`DATABASE_URL: ${match[1].trim().replace(/:([^:@]+)@/, ":****@")}`);

// ─── 4. Install dependencies ─────────────────────────────────────
header("📦  Installing dependencies…");
info("Root"); run("npm install", ROOT);
info("Backend"); run("npm install", backendDir);
info("Frontend"); run("npm install", path.join(ROOT, "frontend"));
log("All packages installed");

// ─── 5. Push DB schema ───────────────────────────────────────────
header("🗄️   Pushing database schema…");
run("npx prisma db push", backendDir);
log("Schema ready");

// ─── 6. Seed ─────────────────────────────────────────────────────
header("🌱  Seeding sample data…");
run("npx ts-node prisma/seed.ts", backendDir);
log("Sample data seeded");

// ─── Done ─────────────────────────────────────────────────────────
console.log(`
${BOLD}${GREEN}✅  Setup complete!${RESET}

  Start the app:   ${BOLD}npm run dev${RESET}

  Frontend:        ${CYAN}http://localhost:5173${RESET}
  API:             ${CYAN}http://localhost:3001${RESET}
  Prisma Studio:   ${BOLD}npm run db:studio${RESET}
`);
