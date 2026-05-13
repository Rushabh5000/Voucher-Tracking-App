import type { Voucher } from "@/types";

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtVal(v: number | null | undefined): string {
  if (v == null) return "—";
  return "₹" + Number(v).toLocaleString("en-IN");
}

export function isExpiringSoon(v: Voucher): boolean {
  if (!v.expiryDate || v.status !== "UNREDEEMED") return false;
  const diff = new Date(v.expiryDate).getTime() - Date.now();
  return diff > 0 && diff < 7 * 86400000;
}

export function isExpiredFrontend(v: Voucher): boolean {
  return v.status === "EXPIRED";
}

export const STATUS_LABELS: Record<string, string> = {
  UNREDEEMED: "Unredeemed",
  REDEEMED:   "Redeemed",
  EXPIRED:    "Expired",
};

export const STATUS_BADGE: Record<string, string> = {
  UNREDEEMED: "badge badge-unredeemed",
  REDEEMED:   "badge badge-redeemed",
  EXPIRED:    "badge badge-expired",
};
