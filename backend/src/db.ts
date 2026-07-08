import { PrismaClient } from "@prisma/client";

// Single shared PrismaClient for the whole server process.
//
// Supabase's connection pooler (session mode) caps concurrent clients at
// pool_size: 15. Each `new PrismaClient()` opens its own connection pool, so
// having one per route/service/job file (as this app used to) can exhaust
// that cap under normal load — every route + cron job ends up holding its own
// set of connections open at once. Import this singleton everywhere instead
// of instantiating PrismaClient directly.
export const prisma = new PrismaClient();
