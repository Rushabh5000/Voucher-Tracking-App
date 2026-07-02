// Helpers for Rupay periodic voucher tracking (quarterly / half-yearly / yearly).

export type PeriodType = "" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";

export const PERIOD_TYPES: { value: PeriodType; label: string; short: string }[] = [
  { value: "",            label: "One-time (not periodic)", short: "One-time" },
  { value: "QUARTERLY",   label: "Quarterly",              short: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-yearly",            short: "Half-yearly" },
  { value: "YEARLY",      label: "Yearly",                 short: "Yearly" },
];

export const PERIOD_TYPE_LABEL: Record<string, string> = {
  QUARTERLY:   "Quarterly",
  HALF_YEARLY: "Half-yearly",
  YEARLY:      "Yearly",
};

// Sub-period choices for a given period type (empty for yearly / one-time)
export function subPeriodOptions(type: PeriodType): { value: number; label: string }[] {
  if (type === "QUARTERLY") {
    return [
      { value: 1, label: "Q1 (Jan–Mar)" },
      { value: 2, label: "Q2 (Apr–Jun)" },
      { value: 3, label: "Q3 (Jul–Sep)" },
      { value: 4, label: "Q4 (Oct–Dec)" },
    ];
  }
  if (type === "HALF_YEARLY") {
    return [
      { value: 1, label: "H1 (Jan–Jun)" },
      { value: 2, label: "H2 (Jul–Dec)" },
    ];
  }
  return [];
}

// Build a periodKey from type + year + sub-period index
export function makePeriodKey(type: PeriodType, year: number, sub: number): string {
  if (type === "QUARTERLY")   return `${year}-Q${sub}`;
  if (type === "HALF_YEARLY") return `${year}-H${sub}`;
  if (type === "YEARLY")      return `${year}`;
  return "";
}

// Parse a periodKey back into { year, sub }
export function parsePeriodKey(type: PeriodType, key: string): { year: number; sub: number } {
  const curYear = new Date().getFullYear();
  if (key) {
    const q = key.match(/^(\d{4})-Q(\d)$/);
    if (q) return { year: +q[1], sub: +q[2] };
    const h = key.match(/^(\d{4})-H(\d)$/);
    if (h) return { year: +h[1], sub: +h[2] };
    const y = key.match(/^(\d{4})$/);
    if (y) return { year: +y[1], sub: 1 };
  }
  return { year: curYear, sub: 1 };
}

// Detect the current period key for a type (used as the default when a type is chosen)
export function currentPeriodKey(type: PeriodType): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11
  if (type === "QUARTERLY")   return `${y}-Q${Math.floor(m / 3) + 1}`;
  if (type === "HALF_YEARLY") return `${y}-H${m < 6 ? 1 : 2}`;
  if (type === "YEARLY")      return `${y}`;
  return "";
}

// Human-readable label for a periodKey, e.g. "Q1 2026", "H2 2026", "2026"
export function periodLabel(type: string, key: string): string {
  if (!key) return "—";
  const p = parsePeriodKey(type as PeriodType, key);
  if (type === "QUARTERLY")   return `Q${p.sub} ${p.year}`;
  if (type === "HALF_YEARLY") return `H${p.sub} ${p.year}`;
  if (type === "YEARLY")      return `${p.year}`;
  return key;
}

// Sort comparator for periodKeys within the same type — most recent first
export function comparePeriodKeysDesc(type: string, a: string, b: string): number {
  const pa = parsePeriodKey(type as PeriodType, a);
  const pb = parsePeriodKey(type as PeriodType, b);
  if (pa.year !== pb.year) return pb.year - pa.year;
  return pb.sub - pa.sub;
}
