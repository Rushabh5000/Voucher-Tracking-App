// One-time migration script: clear remote + apply schema + (optionally) dump local → remote
// Usage: REMOTE_DB=<supabase-url> node migrate.js <command>
const { Client } = require('pg');

const REMOTE = process.env.REMOTE_DB;
const LOCAL  = process.env.LOCAL_DB || 'postgresql://voucher_user:voucher_pass@localhost:5432/voucher_tracker';

if (!REMOTE) {
  console.error('Error: REMOTE_DB environment variable is required.');
  console.error('  Example: REMOTE_DB="postgresql://user:pass@host:5432/db" node migrate.js status');
  process.exit(1);
}

async function connect(url, label) {
  const client = new Client({ connectionString: url, ssl: url.includes('supabase') ? { rejectUnauthorized: false } : false });
  await client.connect();
  console.log(`✓ Connected to ${label}`);
  return client;
}

async function listTables(client) {
  const res = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  return res.rows.map(r => r.tablename);
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === 'status') {
    // Just show what's in both databases
    const remote = await connect(REMOTE, 'Supabase (remote)');
    const tables = await listTables(remote);
    console.log('\nRemote tables:', tables);
    for (const t of tables) {
      const r = await remote.query(`SELECT COUNT(*) FROM "${t}"`);
      console.log(`  ${t}: ${r.rows[0].count} rows`);
    }
    await remote.end();
    return;
  }

  if (cmd === 'clear-remote') {
    const remote = await connect(REMOTE, 'Supabase (remote)');
    const tables = await listTables(remote);
    console.log('\nTables found:', tables);

    // Drop all tables and recreate via Prisma push
    console.log('\nDropping all public tables...');
    await remote.query(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
          EXECUTE 'DROP TABLE IF EXISTS "' || r.tablename || '" CASCADE';
        END LOOP;
      END $$;
    `);
    console.log('✓ All tables dropped');
    await remote.end();
    return;
  }

  if (cmd === 'migrate') {
    // Export local → remote
    const local  = await connect(LOCAL, 'local PostgreSQL');
    const remote = await connect(REMOTE, 'Supabase (remote)');

    const tables = await listTables(local);
    console.log('\nLocal tables:', tables);

    // Order matters for FK constraints
    const ORDER = ['User', 'AppSetting', 'AutocompleteEntry', 'AuditLog', 'Card', 'Voucher'];
    const sorted = ORDER.filter(t => tables.includes(t))
      .concat(tables.filter(t => !ORDER.includes(t)));

    for (const table of sorted) {
      const { rows } = await local.query(`SELECT * FROM "${table}"`);
      if (rows.length === 0) { console.log(`  ${table}: 0 rows — skip`); continue; }

      // Build INSERT
      const cols = Object.keys(rows[0]).map(c => `"${c}"`).join(', ');
      let inserted = 0;
      for (const row of rows) {
        const vals = Object.values(row).map((v, i) => `$${i + 1}`).join(', ');
        const params = Object.values(row);
        try {
          await remote.query(`INSERT INTO "${table}" (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING`, params);
          inserted++;
        } catch (e) {
          console.warn(`  ✗ ${table} row skipped: ${e.message.slice(0, 80)}`);
        }
      }
      console.log(`  ✓ ${table}: ${inserted}/${rows.length} rows copied`);
    }

    await local.end();
    await remote.end();
    console.log('\n✓ Migration complete');
    return;
  }

  console.log(`
Usage:
  node migrate.js status        — show row counts on remote
  node migrate.js clear-remote  — drop all tables on remote (Prisma push will recreate)
  node migrate.js migrate       — copy all data from local → remote (run AFTER clear-remote + prisma db push)
  `);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
