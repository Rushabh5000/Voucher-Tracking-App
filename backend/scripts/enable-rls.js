// Enable RLS on a table. Usage: node scripts/enable-rls.js TableName
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const table = process.argv[2];
if (!table) { console.error("Usage: node enable-rls.js TableName"); process.exit(1); }
prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
  .then(() => console.log(`RLS enabled on "${table}"`))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
