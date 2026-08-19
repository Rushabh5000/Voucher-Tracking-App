// Guardrail against the exact gap that let CvvUsageLog ship without RLS:
// `prisma db push` only diffs the schema model (tables/columns/indexes) and
// silently ignores any raw SQL — including ENABLE ROW LEVEL SECURITY —
// written in a migration file. Since this project has no real migration
// history (db push is the deploy path), a new table's RLS statement is easy
// to write and never actually run. Run this after every db push:
//   npm run db:check-rls
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
  );

  const withoutRls = rows.filter((r) => !r.rowsecurity);

  console.log("Public tables:");
  for (const r of rows) {
    console.log(`  ${r.rowsecurity ? "✅" : "❌"} ${r.tablename}`);
  }

  if (withoutRls.length > 0) {
    console.error(
      `\n${withoutRls.length} table(s) missing RLS: ${withoutRls.map((r) => r.tablename).join(", ")}\n` +
      `Fix with: ALTER TABLE "TableName" ENABLE ROW LEVEL SECURITY;`
    );
    process.exitCode = 1;
  } else {
    console.log("\nAll public tables have RLS enabled.");
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
