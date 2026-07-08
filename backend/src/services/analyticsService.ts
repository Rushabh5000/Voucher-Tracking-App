import { decrypt } from "./encryptionService";
import { prisma } from "../db";

type VRow = {
  id: string; title: string; voucherCode: string; brand: string;
  sourceProgramOrCard: string; description: string; voucherType: string;
  value: number | null; expiryDate: Date | null; issueDate: Date;
  dateAdded: Date; status: string; redeemedAt: Date | null; emailId: string;
  createdAt: Date; updatedAt: Date;
};

export interface AnalyticsData {
  summary: {
    total: number;
    unredeemed: number;
    redeemed: number;
    expired: number;
    totalValue: number;
    redeemedValue: number;
  };
  brandBreakdown: Array<{ brand: string; total: number; unredeemed: number; redeemed: number; expired: number }>;
  monthlyTrend: Array<{ month: string; added: number; redeemed: number }>;
  statusPie: Array<{ name: string; value: number }>;
  expiringIn7Days: number;
  expiringIn30Days: number;
}

function isExpired(v: { status: string; expiryDate: Date | null }): boolean {
  return v.status !== "REDEEMED" && !!v.expiryDate && v.expiryDate < new Date();
}

function effStatus(v: { status: string; expiryDate: Date | null }): string {
  if (v.status === "REDEEMED") return "REDEEMED";
  if (isExpired(v)) return "EXPIRED";
  return "UNREDEEMED";
}

export async function buildAnalytics(): Promise<AnalyticsData> {
  const vouchers = await prisma.voucher.findMany({ orderBy: { dateAdded: "asc" } });
  const now = new Date();

  const withStatus: Array<VRow & { effStatus: string }> = (vouchers as VRow[]).map((v: VRow) => ({
    ...v,
    brand:     decrypt(v.brand),     // decrypt before groupBy
    effStatus: effStatus(v),
  }));

  const total = withStatus.length;
  const unredeemed = withStatus.filter((v: VRow & { effStatus: string }) => v.effStatus === "UNREDEEMED").length;
  const redeemed   = withStatus.filter((v: VRow & { effStatus: string }) => v.effStatus === "REDEEMED").length;
  const expired    = withStatus.filter((v: VRow & { effStatus: string }) => v.effStatus === "EXPIRED").length;
  const totalValue    = withStatus.reduce((s: number, v: VRow) => s + (v.value ?? 0), 0);
  const redeemedValue = withStatus.filter((v: VRow & { effStatus: string }) => v.effStatus === "REDEEMED").reduce((s: number, v: VRow) => s + (v.value ?? 0), 0);

  // Brand breakdown
  const brandMap = new Map<string, { total: number; unredeemed: number; redeemed: number; expired: number }>();
  for (const v of withStatus as Array<VRow & { effStatus: string }>) {
    if (!brandMap.has(v.brand)) brandMap.set(v.brand, { total: 0, unredeemed: 0, redeemed: 0, expired: 0 });
    const b = brandMap.get(v.brand)!;
    b.total++;
    if (v.effStatus === "UNREDEEMED") b.unredeemed++;
    else if (v.effStatus === "REDEEMED") b.redeemed++;
    else b.expired++;
  }
  const brandBreakdown = Array.from(brandMap.entries())
    .map(([brand, counts]) => ({ brand, ...counts }))
    .sort((a, b) => b.total - a.total);

  // Monthly trend — last 12 months
  const monthlyTrend: Array<{ month: string; added: number; redeemed: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    const added    = withStatus.filter((v: VRow) => v.dateAdded >= d && v.dateAdded < next).length;
    const redeemed = withStatus.filter((v: VRow) => v.redeemedAt && v.redeemedAt >= d && v.redeemedAt < next).length;
    monthlyTrend.push({ month: label, added, redeemed });
  }

  // Expiring soon
  const in7  = withStatus.filter((v: VRow & { effStatus: string }) => v.effStatus === "UNREDEEMED" && v.expiryDate && v.expiryDate > now && +v.expiryDate - +now < 7 * 86400000).length;
  const in30 = withStatus.filter((v: VRow & { effStatus: string }) => v.effStatus === "UNREDEEMED" && v.expiryDate && v.expiryDate > now && +v.expiryDate - +now < 30 * 86400000).length;

  return {
    summary: { total, unredeemed, redeemed, expired, totalValue, redeemedValue },
    brandBreakdown,
    monthlyTrend,
    statusPie: [
      { name: "Unredeemed", value: unredeemed },
      { name: "Redeemed",   value: redeemed },
      { name: "Expired",    value: expired },
    ],
    expiringIn7Days: in7,
    expiringIn30Days: in30,
  };
}
