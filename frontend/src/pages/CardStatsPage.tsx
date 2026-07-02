import { useMemo } from "react";
import { useVoucherStore } from "@/store/voucherStore";
import type { Voucher } from "@/types";
import { PERIOD_TYPE_LABEL, periodLabel, comparePeriodKeysDesc } from "@/utils/periods";

// Order in which period frequencies are displayed
const TYPE_ORDER = ["QUARTERLY", "HALF_YEARLY", "YEARLY"];

interface CardInfo { key: string; label: string; owner: string }
interface Cell { has: boolean; redeemed: boolean }

interface PeriodGroup {
  periodType: string;
  periodKey: string;
  cards: CardInfo[];
  brands: string[];
  cells: Record<string, Cell>; // `${cardKey}|||${brand}`
  pendingCount: number;
}

// A "card" for comparison is identified by its source card label + owner
function cardIdentity(v: Voucher): CardInfo {
  const label = v.sourceProgramOrCard || v.cardName || "No source card";
  const owner = v.cardOwner || "";
  return { key: `${label}::${owner}`, label, owner };
}

const cellKeyOf = (cardKey: string, brand: string) => `${cardKey}|||${brand}`;

export function CardStatsPage() {
  const { vouchers } = useVoucherStore();

  const groups = useMemo<PeriodGroup[]>(() => {
    // Only vouchers tagged with a recurring period participate in the comparison.
    // Older vouchers have an empty periodType and are naturally excluded.
    const periodic = vouchers.filter((v) => v.periodType);

    const map = new Map<string, {
      periodType: string;
      periodKey: string;
      cards: Map<string, CardInfo>;
      brands: Set<string>;
      cells: Map<string, Cell>;
    }>();

    for (const v of periodic) {
      const gk = `${v.periodType}###${v.periodKey}`;
      let g = map.get(gk);
      if (!g) {
        g = { periodType: v.periodType, periodKey: v.periodKey, cards: new Map(), brands: new Set(), cells: new Map() };
        map.set(gk, g);
      }
      const id = cardIdentity(v);
      if (!g.cards.has(id.key)) g.cards.set(id.key, id);

      const brand = v.brand || "Uncategorized";
      g.brands.add(brand);

      const ck = cellKeyOf(id.key, brand);
      const prev = g.cells.get(ck);
      g.cells.set(ck, { has: true, redeemed: (prev?.redeemed ?? false) || v.status === "REDEEMED" });
    }

    const arr: PeriodGroup[] = [...map.values()].map((g) => {
      const cards = [...g.cards.values()].sort((a, b) => a.label.localeCompare(b.label));
      const brands = [...g.brands].sort();
      const cells: Record<string, Cell> = {};
      for (const [k, val] of g.cells) cells[k] = val;

      let pendingCount = 0;
      for (const c of cards) for (const b of brands) if (!cells[cellKeyOf(c.key, b)]?.has) pendingCount++;

      return { periodType: g.periodType, periodKey: g.periodKey, cards, brands, cells, pendingCount };
    });

    arr.sort((a, b) => {
      const t = TYPE_ORDER.indexOf(a.periodType) - TYPE_ORDER.indexOf(b.periodType);
      if (t !== 0) return t;
      return comparePeriodKeysDesc(a.periodType, a.periodKey, b.periodKey);
    });

    return arr;
  }, [vouchers]);

  const totalPending = groups.reduce((s, g) => s + g.pendingCount, 0);

  if (groups.length === 0) {
    return (
      <div className="card p-8 text-center max-w-xl mx-auto mt-6">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">No periodic vouchers yet</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          When you add a voucher, set its <strong>Recurring benefit period</strong> (quarterly,
          half-yearly, or yearly) and pick a source card. This page then compares your cards
          side-by-side for each period and flags any brand you forgot to claim.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary banner */}
      <div className="card p-4 flex flex-wrap items-center gap-x-8 gap-y-2">
        <div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{groups.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Tracked periods</div>
        </div>
        <div>
          <div className={`text-2xl font-semibold ${totalPending > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {totalPending}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Pending across all cards</div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-md">
          A brand is “expected” for a period if <em>any</em> card claimed it. Cards missing that
          brand are marked <span className="text-amber-600 dark:text-amber-400 font-medium">Pending</span>.
        </p>
      </div>

      {groups.map((g) => (
        <PeriodTable key={`${g.periodType}###${g.periodKey}`} group={g} />
      ))}
    </div>
  );
}

function PeriodTable({ group }: { group: PeriodGroup }) {
  const { periodType, periodKey, cards, brands, cells, pendingCount } = group;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {periodLabel(periodType, periodKey)}
          </span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {PERIOD_TYPE_LABEL[periodType] ?? periodType}
          </span>
        </div>
        {pendingCount > 0 ? (
          <span className="text-xs px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-medium">
            {pendingCount} pending
          </span>
        ) : (
          <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-medium">
            All claimed ✓
          </span>
        )}
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th className="px-4 py-2 font-medium sticky left-0 bg-white dark:bg-gray-900 z-10">Card</th>
              {brands.map((b) => (
                <th key={b} className="px-3 py-2 font-medium text-center whitespace-nowrap">{b}</th>
              ))}
              <th className="px-4 py-2 font-medium">Pending for this card</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const missing = brands.filter((b) => !cells[cellKeyOf(c.key, b)]?.has);
              return (
                <tr key={c.key} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                  <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-gray-900 z-10">
                    <div className="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{c.label}</div>
                    {c.owner && <div className="text-xs text-gray-400">{c.owner}</div>}
                  </td>
                  {brands.map((b) => {
                    const cell = cells[cellKeyOf(c.key, b)];
                    return (
                      <td key={b} className="px-3 py-2.5 text-center">
                        {cell?.has ? (
                          cell.redeemed ? (
                            <span title="Claimed & redeemed" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs">✓</span>
                          ) : (
                            <span title="Claimed (not yet redeemed)" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 text-xs">✓</span>
                          )
                        ) : (
                          <span title="Pending — not claimed" className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs">✕</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5">
                    {missing.length === 0 ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400">None 🎉</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {missing.map((b) => (
                          <span key={b} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 px-4 py-2 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400 mr-1 align-middle" />Claimed</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 mr-1 align-middle" />Claimed &amp; redeemed</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mr-1 align-middle" />Pending</span>
      </div>
    </div>
  );
}
