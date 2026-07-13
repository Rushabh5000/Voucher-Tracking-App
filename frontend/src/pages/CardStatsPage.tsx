import { useMemo } from "react";
import { useVoucherStore } from "@/store/voucherStore";
import { useCardStore } from "@/store/cardStore";
import type { Voucher } from "@/types";
import { PERIOD_TYPE_LABEL, periodLabel, comparePeriodKeysDesc } from "@/utils/periods";

// Order in which period frequencies are displayed
const TYPE_ORDER = ["QUARTERLY", "HALF_YEARLY", "YEARLY"];

interface CardInfo { key: string; label: string; owner: string }
// Tracks how many vouchers of a brand a card has claimed this period — pure
// claim count, independent of redemption status (redeeming is a separate
// concern from whether the periodic benefit was claimed at all).
interface Cell { count: number }

// A comparison group = same bank + same card type (e.g. "Bank of Baroda · Rupay Platinum").
// Cards are only ever compared against others in their own group, because different
// card programs offer different voucher catalogues.
interface Group {
  groupKey: string;
  bank: string;
  cardType: string;
  cards: CardInfo[];
  brands: string[];
  cells: Record<string, Cell>;
  pendingCount: number;
}

interface PeriodBlock {
  periodType: string;
  periodKey: string;
  groups: Group[];
  pendingCount: number;
}

const cellKeyOf = (cardKey: string, brand: string) => `${cardKey}|||${brand}`;

// The specific card a voucher belongs to (identity within a group)
function cardIdentity(v: Voucher): CardInfo {
  const label = v.sourceProgramOrCard || v.cardName || "No source card";
  const owner = v.cardOwner || "";
  return { key: `${label}::${owner}`, label, owner };
}

export function CardStatsPage() {
  const { vouchers } = useVoucherStore();
  const { cards } = useCardStore();

  // Map "Bank | last4" → { bank, cardType } so each voucher can find its card program
  const cardMeta = useMemo(() => {
    const m = new Map<string, { bank: string; cardType: string }>();
    for (const c of cards) m.set(`${c.bank} | ${c.lastFourDigits}`, { bank: c.bank, cardType: c.cardType });
    return m;
  }, [cards]);

  const periods = useMemo<PeriodBlock[]>(() => {
    // Only vouchers tagged with a recurring period participate. Older vouchers have
    // an empty periodType and are naturally excluded.
    const periodic = vouchers.filter((v) => v.periodType);

    const pMap = new Map<string, {
      periodType: string;
      periodKey: string;
      groups: Map<string, {
        bank: string;
        cardType: string;
        cards: Map<string, CardInfo>;
        brands: Set<string>;
        cells: Map<string, Cell>;
      }>;
    }>();

    for (const v of periodic) {
      const pk = `${v.periodType}###${v.periodKey}`;
      let p = pMap.get(pk);
      if (!p) { p = { periodType: v.periodType, periodKey: v.periodKey, groups: new Map() }; pMap.set(pk, p); }

      // Resolve the card program (bank + type). Fall back to the label prefix if the
      // source card no longer exists in the user's card list.
      const meta = cardMeta.get(v.sourceProgramOrCard);
      const bank = meta?.bank
        ?? (v.sourceProgramOrCard ? v.sourceProgramOrCard.split("|")[0].trim() : "No source card");
      const cardType = meta?.cardType ?? "Unknown type";
      const gk = `${bank}:::${cardType}`;

      let g = p.groups.get(gk);
      if (!g) { g = { bank, cardType, cards: new Map(), brands: new Set(), cells: new Map() }; p.groups.set(gk, g); }

      const id = cardIdentity(v);
      if (!g.cards.has(id.key)) g.cards.set(id.key, id);

      const brand = v.brand || "Uncategorized";
      g.brands.add(brand);

      const ck = cellKeyOf(id.key, brand);
      const prev = g.cells.get(ck);
      g.cells.set(ck, { count: (prev?.count ?? 0) + 1 });
    }

    const blocks: PeriodBlock[] = [...pMap.values()].map((p) => {
      const groups: Group[] = [...p.groups.entries()].map(([groupKey, g]) => {
        const cards = [...g.cards.values()].sort((a, b) => a.label.localeCompare(b.label));
        const brands = [...g.brands].sort();
        const cells: Record<string, Cell> = {};
        for (const [k, val] of g.cells) cells[k] = val;

        let pendingCount = 0;
        for (const c of cards) for (const b of brands) if (!cells[cellKeyOf(c.key, b)]?.count) pendingCount++;

        return { groupKey, bank: g.bank, cardType: g.cardType, cards, brands, cells, pendingCount };
      }).sort((a, b) => `${a.bank} ${a.cardType}`.localeCompare(`${b.bank} ${b.cardType}`));

      const pendingCount = groups.reduce((s, g) => s + g.pendingCount, 0);
      return { periodType: p.periodType, periodKey: p.periodKey, groups, pendingCount };
    });

    blocks.sort((a, b) => {
      const t = TYPE_ORDER.indexOf(a.periodType) - TYPE_ORDER.indexOf(b.periodType);
      if (t !== 0) return t;
      return comparePeriodKeysDesc(a.periodType, a.periodKey, b.periodKey);
    });

    return blocks;
  }, [vouchers, cardMeta]);

  const totalPending = periods.reduce((s, p) => s + p.pendingCount, 0);

  if (periods.length === 0) {
    return (
      <div className="card p-8 text-center max-w-xl mx-auto mt-6">
        <div className="text-4xl mb-3">📊</div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">No periodic vouchers yet</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          When you add a voucher, set its <strong>Recurring benefit period</strong> (quarterly,
          half-yearly, or yearly) and pick a source card. Cards are compared only within the same
          <strong> bank &amp; card type</strong>, so each Rupay program is tracked on its own.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary banner */}
      <div className="card p-4 flex flex-wrap items-center gap-x-8 gap-y-2">
        <div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{periods.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Tracked periods</div>
        </div>
        <div>
          <div className={`text-2xl font-semibold ${totalPending > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
            {totalPending}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Pending across all cards</div>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 max-w-md">
          Cards are compared only within the same <strong>bank &amp; card type</strong>. A brand is
          “expected” if any card in that group claimed it; cards missing it are marked
          <span className="text-amber-600 dark:text-amber-400 font-medium"> Pending</span>. Tracks
          claims only — redeeming a voucher doesn't change its status here.
        </p>
      </div>

      {periods.map((p) => (
        <div key={`${p.periodType}###${p.periodKey}`} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {periodLabel(p.periodType, p.periodKey)}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              {PERIOD_TYPE_LABEL[p.periodType] ?? p.periodType}
            </span>
            {p.pendingCount > 0
              ? <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-medium">{p.pendingCount} pending</span>
              : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-medium">all claimed ✓</span>}
          </div>

          {p.groups.map((g) => <GroupTable key={g.groupKey} group={g} />)}
        </div>
      ))}
    </div>
  );
}

function GroupTable({ group }: { group: Group }) {
  const { bank, cardType, cards, brands, cells, pendingCount } = group;

  return (
    <div className="card overflow-hidden">
      {/* Group header: bank + card type */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-base">💳</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{bank}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300">
            {cardType}
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
              const missing = brands.filter((b) => !cells[cellKeyOf(c.key, b)]?.count);
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
                        {cell?.count ? (
                          <span
                            title={cell.count > 1 ? `Claimed ${cell.count} times` : "Claimed"}
                            className="inline-flex items-center justify-center gap-0.5 min-w-6 h-6 px-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium"
                          >
                            ✓{cell.count > 1 && <span className="text-[10px]">×{cell.count}</span>}
                          </span>
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
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 mr-1 align-middle" />Claimed (×N if more than once)</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mr-1 align-middle" />Pending</span>
      </div>
    </div>
  );
}
