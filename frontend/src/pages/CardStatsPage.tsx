import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useVoucherStore } from "@/store/voucherStore";
import { useCardStore } from "@/store/cardStore";
import { useCardBenefitsStore } from "@/store/cardBenefitsStore";
import type { Voucher } from "@/types";
import type { CardBenefit } from "@/api/client";
import { comparePeriodKeysDesc, makePeriodKey, parsePeriodKey, PERIOD_TYPE_LABEL, type PeriodType } from "@/utils/periods";

// Order in which period frequencies are displayed within a column set
const TYPE_ORDER = ["QUARTERLY", "HALF_YEARLY", "YEARLY"];

// Compact tag for a column header, e.g. "Q1", "H2", "Yearly"
function shortPeriodTag(periodType: string, periodKey: string): string {
  if (periodType === "YEARLY") return "Yearly";
  const { sub } = parsePeriodKey(periodType as PeriodType, periodKey);
  return periodType === "QUARTERLY" ? `Q${sub}` : `H${sub}`;
}

interface CardInfo { key: string; label: string; owner: string }
// Tracks how many vouchers of a brand+period a card has claimed — pure
// claim count, independent of redemption status (redeeming is a separate
// concern from whether the periodic benefit was claimed at all).
interface Cell { count: number }

// One column = a specific brand within a specific period (e.g. "Amazon · Q1"
// and "Amazon · Q2" are different columns) — quarterly, half-yearly, and
// yearly benefits are all independent, so claiming one never counts toward
// another even though they now share a table.
interface Column { key: string; brand: string; periodType: string; periodKey: string; tag: string }

// A comparison group = same bank + same card type (e.g. "Bank of Baroda · Rupay Platinum").
// Cards are only ever compared against others in their own group, because different
// card programs offer different voucher catalogues. One table per group covers the
// whole selected year, with a column per brand+period combo that occurred in it.
interface Group {
  groupKey: string;
  bank: string;
  cardType: string;
  cards: CardInfo[];
  columns: Column[];
  cells: Record<string, Cell>;
  pendingCount: number;
}

const cellKeyOf = (cardKey: string, colKey: string) => `${cardKey}|||${colKey}`;

// The specific card a voucher belongs to (identity within a group).
// Key is label-only (no owner) so a stale cardOwner snapshot on an old
// voucher never breaks the match — the displayed owner always comes from
// the live card store via the backfill below.
function cardIdentity(v: Voucher): CardInfo {
  const label = v.sourceProgramOrCard || v.cardName || "No source card";
  return { key: label, label, owner: "" };
}

function currentQuarter(): number {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

// Which half-year contains a given quarter (Q1,Q2 → H1; Q3,Q4 → H2)
function halfForQuarter(q: number): number { return q <= 2 ? 1 : 2; }

// All period keys that apply for a given type within the selected year+quarter filter
function synthesizePeriodKeys(periodType: string, year: number, quarter: number | null): string[] {
  if (periodType === "QUARTERLY") {
    if (quarter !== null) return [makePeriodKey("QUARTERLY", year, quarter)];
    return [1, 2, 3, 4].map((q) => makePeriodKey("QUARTERLY", year, q));
  }
  if (periodType === "HALF_YEARLY") {
    if (quarter !== null) return [makePeriodKey("HALF_YEARLY", year, halfForQuarter(quarter))];
    return [1, 2].map((h) => makePeriodKey("HALF_YEARLY", year, h));
  }
  if (periodType === "YEARLY") return [makePeriodKey("YEARLY", year, 1)];
  return [];
}

export function CardStatsPage() {
  const { vouchers } = useVoucherStore();
  const { cards } = useCardStore();
  const { benefits, addBenefit, removeBenefit } = useCardBenefitsStore();
  const [year, setYear] = useState(() => new Date().getFullYear());
  // null = show all quarters; number = filter to that quarter
  const [quarter, setQuarter] = useState<number | null>(() => currentQuarter());
  const LS_KEY = "vt-cardstats-collapse";

  // Tracks manually-set collapse overrides; absent = use default (pending===0 → collapsed).
  // Persisted to localStorage so the state survives page refresh.
  const [collapseOverrides, setCollapseOverrides] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; }
  });

  function saveOverrides(next: Record<string, boolean>) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
    setCollapseOverrides(next);
  }

  function getCollapsed(groupKey: string, pendingCount: number): boolean {
    return groupKey in collapseOverrides ? collapseOverrides[groupKey] : pendingCount === 0;
  }
  function toggleGroup(groupKey: string, pendingCount: number) {
    const current = groupKey in collapseOverrides ? collapseOverrides[groupKey] : pendingCount === 0;
    saveOverrides({ ...collapseOverrides, [groupKey]: !current });
  }
  function expandAll() {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[g.groupKey] = false;
    saveOverrides(next);
  }
  function collapseAll() {
    const next: Record<string, boolean> = {};
    for (const g of groups) next[g.groupKey] = true;
    saveOverrides(next);
  }
  function resetCollapse() { saveOverrides({}); }

  // Map "Bank | last4" → { bank, cardType } so each voucher can find its card program
  const cardMeta = useMemo(() => {
    const m = new Map<string, { bank: string; cardType: string }>();
    for (const c of cards) m.set(`${c.bank} | ${c.lastFourDigits}`, { bank: c.bank, cardType: c.cardType });
    return m;
  }, [cards]);

  // All years with at least one tracked period, plus the current year even if
  // it has none yet, so the dropdown always has somewhere sensible to land.
  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const v of vouchers) {
      if (!v.periodType) continue;
      set.add(parsePeriodKey(v.periodType as PeriodType, v.periodKey).year);
    }
    return [...set].sort((a, b) => b - a);
  }, [vouchers]);

  const hasAnyPeriodic = useMemo(() => vouchers.some((v) => v.periodType) || benefits.length > 0, [vouchers, benefits]);

  const groups = useMemo<Group[]>(() => {
    // Only vouchers tagged with a recurring period, within the selected year (and quarter
    // if one is selected), participate.
    const periodic = vouchers.filter((v) => {
      if (!v.periodType) return false;
      const parsed = parsePeriodKey(v.periodType as PeriodType, v.periodKey);
      if (parsed.year !== year) return false;
      if (quarter !== null) {
        if (v.periodType === "QUARTERLY" && parsed.sub !== quarter) return false;
        if (v.periodType === "HALF_YEARLY" && parsed.sub !== halfForQuarter(quarter)) return false;
        // YEARLY: always include
      }
      return true;
    });

    const gMap = new Map<string, {
      bank: string;
      cardType: string;
      cards: Map<string, CardInfo>;
      columns: Map<string, Column>;
      cells: Map<string, Cell>;
    }>();

    for (const v of periodic) {
      // Resolve the card program (bank + type). Fall back to the label prefix if the
      // source card no longer exists in the user's card list.
      const meta = cardMeta.get(v.sourceProgramOrCard);
      const bank = meta?.bank
        ?? (v.sourceProgramOrCard ? v.sourceProgramOrCard.split("|")[0].trim() : "No source card");
      const cardType = meta?.cardType ?? "Unknown type";
      const gk = `${bank}:::${cardType}`;

      let g = gMap.get(gk);
      if (!g) { g = { bank, cardType, cards: new Map(), columns: new Map(), cells: new Map() }; gMap.set(gk, g); }

      const id = cardIdentity(v);
      if (!g.cards.has(id.key)) g.cards.set(id.key, id);

      const brand = v.brand || "Uncategorized";
      const colKey = `${v.periodType}###${v.periodKey}###${brand}`;
      if (!g.columns.has(colKey)) {
        g.columns.set(colKey, { key: colKey, brand, periodType: v.periodType, periodKey: v.periodKey, tag: shortPeriodTag(v.periodType, v.periodKey) });
      }

      const ck = cellKeyOf(id.key, colKey);
      const prev = g.cells.get(ck);
      g.cells.set(ck, { count: (prev?.count ?? 0) + 1 });
    }

    // Synthesize columns from defined benefits (bank+cardType → brand+periodType).
    // This ensures groups and columns appear even before any voucher is claimed.
    for (const benefit of benefits) {
      const periodKeys = synthesizePeriodKeys(benefit.periodType, year, quarter);
      if (periodKeys.length === 0) continue;

      const gk = `${benefit.bank}:::${benefit.cardType}`;
      let g = gMap.get(gk);
      if (!g) {
        g = { bank: benefit.bank, cardType: benefit.cardType, cards: new Map(), columns: new Map(), cells: new Map() };
        gMap.set(gk, g);
      }

      for (const pk of periodKeys) {
        const colKey = `${benefit.periodType}###${pk}###${benefit.brand}`;
        if (!g.columns.has(colKey)) {
          g.columns.set(colKey, {
            key: colKey,
            brand: benefit.brand,
            periodType: benefit.periodType,
            periodKey: pk,
            tag: shortPeriodTag(benefit.periodType, pk),
          });
        }
      }
    }

    // A card with zero claims all year never appears in the loop above (it has
    // no voucher to iterate), so it would silently vanish instead of showing
    // up fully pending. Backfill every card from Cards Summary that matches a
    // group's bank+cardType, even if it claimed nothing this year.
    for (const g of gMap.values()) {
      for (const c of cards) {
        if (c.bank !== g.bank || c.cardType !== g.cardType) continue;
        const label = `${c.bank} | ${c.lastFourDigits}`;
        const owner = c.accountOwner || "";
        // Always overwrite: backfill uses the live card store so the displayed
        // owner is always current, even if a voucher's cardOwner snapshot is stale.
        g.cards.set(label, { key: label, label, owner });
      }
    }

    const result: Group[] = [...gMap.entries()].map(([groupKey, g]) => {
      const groupCards = [...g.cards.values()].sort((a, b) => a.label.localeCompare(b.label));
      const columns = [...g.columns.values()].sort((a, b) => {
        const t = TYPE_ORDER.indexOf(a.periodType) - TYPE_ORDER.indexOf(b.periodType);
        if (t !== 0) return t;
        const p = comparePeriodKeysDesc(a.periodType, a.periodKey, b.periodKey);
        if (p !== 0) return p;
        return a.brand.localeCompare(b.brand);
      });
      const cells: Record<string, Cell> = {};
      for (const [k, val] of g.cells) cells[k] = val;

      let pendingCount = 0;
      for (const c of groupCards) for (const col of columns) if (!cells[cellKeyOf(c.key, col.key)]?.count) pendingCount++;

      return { groupKey, bank: g.bank, cardType: g.cardType, cards: groupCards, columns, cells, pendingCount };
    }).sort((a, b) => `${a.bank} ${a.cardType}`.localeCompare(`${b.bank} ${b.cardType}`));

    return result;
  }, [vouchers, cardMeta, cards, benefits, year, quarter]);

  const totalPending = groups.reduce((s, g) => s + g.pendingCount, 0);

  const selectors = (
    <div className="flex items-center gap-3 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-gray-500 dark:text-gray-400">Quarter</span>
        <select
          className="input py-1.5 w-auto"
          value={quarter ?? "all"}
          onChange={(e) => setQuarter(e.target.value === "all" ? null : Number(e.target.value))}
        >
          <option value="all">All</option>
          <option value={1}>Q1 (Jan–Mar)</option>
          <option value={2}>Q2 (Apr–Jun)</option>
          <option value={3}>Q3 (Jul–Sep)</option>
          <option value={4}>Q4 (Oct–Dec)</option>
        </select>
      </label>
      <label className="flex items-center gap-2">
        <span className="text-gray-500 dark:text-gray-400">Year</span>
        <select
          className="input py-1.5 w-auto"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
    </div>
  );

  if (!hasAnyPeriodic) {
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
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60">
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{groups.length}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">Card<br/>programs</span>
            </div>
            <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg ${totalPending > 0 ? "bg-amber-50 dark:bg-amber-900/20" : "bg-emerald-50 dark:bg-emerald-900/20"}`}>
              <span className={`text-lg font-bold ${totalPending > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>{totalPending}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400 leading-tight">Pending<br/>benefits</span>
            </div>
          </div>

          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 shrink-0 hidden sm:block" />

          {/* Selectors */}
          {selectors}

          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700 shrink-0 hidden sm:block" />

          {/* Group controls */}
          <div className="flex items-center gap-1.5">
            <button onClick={expandAll}    className="btn-secondary text-xs py-1 px-2.5">Expand all</button>
            <button onClick={collapseAll}  className="btn-secondary text-xs py-1 px-2.5">Collapse all</button>
            <button onClick={resetCollapse} className="btn-secondary text-xs py-1 px-2.5">Reset</button>
          </div>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="card p-8 text-center max-w-xl mx-auto">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
            No periods tracked for {quarter !== null ? `Q${quarter} ` : ""}{year}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Try a different quarter or year from the dropdowns above.</p>
        </div>
      )}

      {groups.map((g) => (
        <GroupTable
          key={g.groupKey}
          group={g}
          collapsed={getCollapsed(g.groupKey, g.pendingCount)}
          onToggle={() => toggleGroup(g.groupKey, g.pendingCount)}
          benefits={benefits.filter((b) => b.bank === g.bank && b.cardType === g.cardType)}
          onAddBenefit={(brand, periodType) => addBenefit(g.bank, g.cardType, brand, periodType)}
          onRemoveBenefit={removeBenefit}
        />
      ))}
    </div>
  );
}

function GroupTable({
  group, collapsed, onToggle, benefits, onAddBenefit, onRemoveBenefit,
}: {
  group: Group;
  collapsed: boolean;
  onToggle: () => void;
  benefits: CardBenefit[];
  onAddBenefit: (brand: string, periodType: string) => Promise<void>;
  onRemoveBenefit: (id: string) => Promise<void>;
}) {
  const { bank, cardType, cards, columns, cells, pendingCount } = group;
  const [showBenefits, setShowBenefits] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [newPeriodType, setNewPeriodType] = useState("QUARTERLY");
  const [saving, setSaving] = useState(false);

  async function handleAddBenefit() {
    if (!newBrand.trim()) return;
    setSaving(true);
    try {
      await onAddBenefit(newBrand.trim(), newPeriodType);
      setNewBrand("");
      toast.success("Benefit added");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? err?.message ?? "Failed to add benefit");
    }
    setSaving(false);
  }

  // A column where every card in the group has claimed it adds nothing but
  // clutter as more brands/periods pile up — pull those out of the matrix
  // and summarize them in one line instead.
  const clearedCols = columns.filter((col) => cards.every((c) => cells[cellKeyOf(c.key, col.key)]?.count));
  const clearedKeys = new Set(clearedCols.map((c) => c.key));
  const visibleCols = columns.filter((col) => !clearedKeys.has(col.key));

  return (
    <div className="card overflow-hidden">
      {/* Group header: bank + card type — click to expand/collapse */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs text-gray-400 transition-transform ${collapsed ? "-rotate-90" : ""}`}>▾</span>
          <span className="text-base">💳</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{bank}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300">
            {cardType}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 font-medium">
              {pendingCount} pending
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-medium">
              All claimed ✓
            </span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowBenefits((s) => !s); }}
            className={`text-xs px-2 py-1 rounded-full border transition-colors ${showBenefits ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"}`}
            title="Manage defined benefits for this card type"
          >
            ⚙ Benefits{benefits.length > 0 && ` (${benefits.length})`}
          </button>
        </div>
      </button>

      {showBenefits && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-indigo-50/40 dark:bg-indigo-900/10 space-y-2">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Defined benefits for <span className="text-gray-800 dark:text-gray-200">{bank} · {cardType}</span>
            <span className="ml-1.5 font-normal text-gray-400">— columns appear even before any voucher is claimed</span>
          </div>
          {benefits.length === 0 && (
            <div className="text-xs text-gray-400 italic">No benefits defined yet.</div>
          )}
          {benefits.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-xs">
              <span className="font-medium text-gray-700 dark:text-gray-300">{b.brand}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500 dark:text-gray-400">{PERIOD_TYPE_LABEL[b.periodType] ?? b.periodType}</span>
              <button
                type="button"
                onClick={() => onRemoveBenefit(b.id).then(() => toast.success("Benefit removed")).catch((err: any) => toast.error(err?.response?.data?.error ?? "Failed to remove"))}
                className="ml-auto text-red-400 hover:text-red-600 dark:hover:text-red-300"
                title="Remove benefit"
              >✕</button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <input
              className="input text-xs py-1 flex-1"
              placeholder="Brand (e.g. Amazon)"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddBenefit(); }}
            />
            <select
              className="input text-xs py-1 w-auto"
              value={newPeriodType}
              onChange={(e) => setNewPeriodType(e.target.value)}
            >
              <option value="QUARTERLY">Quarterly</option>
              <option value="HALF_YEARLY">Half-yearly</option>
              <option value="YEARLY">Yearly</option>
            </select>
            <button
              type="button"
              onClick={handleAddBenefit}
              disabled={saving || !newBrand.trim()}
              className="btn-primary text-xs py-1 px-3"
            >{saving ? "…" : "+ Add"}</button>
          </div>
        </div>
      )}

      {collapsed ? null : (
        <>
      {clearedCols.length > 0 && (
        <div className="px-4 py-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/15 border-b border-gray-100 dark:border-gray-800">
          <span className="font-medium">✓ All cards clear:</span> {clearedCols.map((c) => `${c.brand} (${c.tag})`).join(", ")}
        </div>
      )}

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th className="px-4 py-2 font-medium sticky left-0 bg-white dark:bg-gray-900 z-10">Card</th>
              {visibleCols.map((col) => (
                <th key={col.key} className="px-3 py-2 font-medium text-center whitespace-nowrap">
                  <div>{col.brand}</div>
                  <div className="text-[10px] text-gray-400 font-normal">{col.tag}</div>
                </th>
              ))}
              <th className="px-4 py-2 font-medium">Pending for this card</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const missing = columns.filter((col) => !cells[cellKeyOf(c.key, col.key)]?.count);
              return (
                <tr key={c.key} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                  <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-gray-900 z-10">
                    <div className="font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{c.label}</div>
                    {c.owner && <div className="text-xs text-gray-400">{c.owner}</div>}
                  </td>
                  {visibleCols.map((col) => {
                    const cell = cells[cellKeyOf(c.key, col.key)];
                    return (
                      <td key={col.key} className="px-3 py-2.5 text-center">
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
                        {missing.map((col) => (
                          <span key={col.key} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                            {col.brand} ({col.tag})
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
        </>
      )}
    </div>
  );
}
