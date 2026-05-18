import cron from "node-cron";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function startGuestCleanupJob(): void {
  // Run every 30 minutes — delete guests whose session has expired.
  // Cascade on User → Voucher/Card handles removing their data automatically.
  cron.schedule("*/30 * * * *", async () => {
    try {
      const result = await prisma.user.deleteMany({
        where: { role: "guest", expiresAt: { lt: new Date() } },
      });
      if (result.count > 0) {
        console.log(`[GuestCleanup] Removed ${result.count} expired guest session(s)`);
      }
    } catch (err) {
      console.error("[GuestCleanup] Error:", err);
    }
  });
  console.log("[GuestCleanup] Job started (every 30 min)");
}
