import type { Voucher } from "@/types";

/**
 * Universal voucher sort:
 *   1. Non-redeemed (UNREDEEMED + EXPIRED) — earliest expiry first, no-expiry last
 *   2. Redeemed — most recently redeemed first
 */
export function sortVouchers(vouchers: Voucher[]): Voucher[] {
  return [...vouchers].sort((a, b) => {
    const aRedeemed = a.status === "REDEEMED" ? 1 : 0;
    const bRedeemed = b.status === "REDEEMED" ? 1 : 0;

    // Redeemed always sinks to the bottom
    if (aRedeemed !== bRedeemed) return aRedeemed - bRedeemed;

    // Both redeemed → most recently redeemed first
    if (aRedeemed === 1) {
      const aT = a.redeemedAt ? new Date(a.redeemedAt).getTime() : new Date(a.dateAdded).getTime();
      const bT = b.redeemedAt ? new Date(b.redeemedAt).getTime() : new Date(b.dateAdded).getTime();
      return bT - aT;
    }

    // Both non-redeemed → earliest expiry first; no-expiry vouchers go last
    const aExp = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
    const bExp = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
    if (aExp !== bExp) return aExp - bExp;

    // Tie-break: older voucher first
    return new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
  });
}

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

/** Copy text to the clipboard, with a graceful fallback for insecure contexts. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy path */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export const STATUS_BADGE: Record<string, string> = {
  UNREDEEMED: "badge badge-unredeemed",
  REDEEMED:   "badge badge-redeemed",
  EXPIRED:    "badge badge-expired",
};
