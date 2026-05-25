import { useState, useMemo } from "react";
import { useCardStore } from "@/store/cardStore";
import { useVoucherStore } from "@/store/voucherStore";
import { CardModal } from "@/components/cards/CardModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { VoucherCard } from "@/components/vouchers/VoucherCard";
import type { Card } from "@/types";
import { fmtDate } from "@/utils/formatters";

// ─── Card Analytics ───────────────────────────────────────────────────────────

function BreakdownBar({
  label, count, max, total,
}: { label: string; count: number; max: number; total: number }) {
  const pct    = max > 0 ? Math.round((count / max) * 100) : 0;
  const ofTotal = Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-sm text-gray-700 dark:text-gray-300 truncate flex-shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-400 dark:bg-accent-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 w-20 text-right flex-shrink-0">
        {count} card{count !== 1 ? "s" : ""} · {ofTotal}%
      </div>
    </div>
  );
}

function CardAnalytics({ cards }: { cards: Card[] }) {
  const total = cards.length;

  const byBank = Object.entries(
    cards.reduce((acc, c) => { acc[c.bank] = (acc[c.bank] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a);
  const maxBankCount = byBank[0]?.[1] ?? 1;

  const byCardType = Object.entries(
    cards.reduce((acc, c) => { acc[c.cardType] = (acc[c.cardType] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a);
  const maxCardTypeCount = byCardType[0]?.[1] ?? 1;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
          Cards by bank
        </h3>
        <div className="space-y-2.5">
          {byBank.map(([bank, count]) => (
            <BreakdownBar key={bank} label={bank} count={count} max={maxBankCount} total={total} />
          ))}
        </div>
      </div>
      <div className="card p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
          Cards by type
        </h3>
        <div className="space-y-2.5">
          {byCardType.map(([cardType, count]) => (
            <BreakdownBar key={cardType} label={cardType} count={count} max={maxCardTypeCount} total={total} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CardsPage({ onEditVoucher }: { onEditVoucher: (id: string) => void }) {
  const { cards, deleteCard } = useCardStore();
  const { vouchers }          = useVoucherStore();

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<Card | null>(null);
  const [delTarget,    setDelTarget]    = useState<Card | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [search,       setSearch]       = useState("");

  // Vouchers for whichever card is currently expanded
  const cardVouchers = useMemo(() => {
    if (!selectedCard) return [];
    return vouchers
      .filter(v => v.cardName === selectedCard.cardName && v.cardOwner === selectedCard.accountOwner)
      .sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime());
  }, [vouchers, selectedCard]);

  // Voucher count badge per card
  const voucherCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of vouchers) {
      const key = `${v.cardName}|||${v.cardOwner}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [vouchers]);

  const getCount = (card: Card) =>
    voucherCounts.get(`${card.cardName}|||${card.accountOwner}`) ?? 0;

  // Search filter — matches name, bank, owner, last 4, card type
  const filteredCards = useMemo(() => {
    if (!search.trim()) return cards;
    const q = search.toLowerCase().trim();
    return cards.filter(c =>
      c.cardName.toLowerCase().includes(q) ||
      c.bank.toLowerCase().includes(q) ||
      c.accountOwner.toLowerCase().includes(q) ||
      c.lastFourDigits.includes(q) ||
      c.cardType.toLowerCase().includes(q)
    );
  }, [cards, search]);

  // Group filtered cards by bank
  const byBank = filteredCards.reduce((acc, c) => {
    if (!acc[c.bank]) acc[c.bank] = [];
    acc[c.bank].push(c);
    return acc;
  }, {} as Record<string, Card[]>);

  const inp =
    "text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 " +
    "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 " +
    "focus:ring-2 focus:ring-accent-500 focus:outline-none";

  return (
    <div className="space-y-6">
      {/* ── Toolbar ── */}
      <div className="flex gap-2 items-center flex-wrap">
        {cards.length > 0 && (
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
              🔍
            </span>
            <input
              className={`${inp} w-full pl-8 pr-8`}
              placeholder="Search by name, bank, owner, last 4…"
              value={search}
              onChange={e => { setSearch(e.target.value); setSelectedCard(null); }}
              autoComplete="off"
            />
            {search && (
              <button
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => setSearch("")}
              >
                ✕
              </button>
            )}
          </div>
        )}
        <button
          className="btn-primary ml-auto"
          onClick={() => { setEditing(null); setModalOpen(true); }}
        >
          + Add card
        </button>
      </div>

      {/* Search result count */}
      {search && (
        <div className="text-xs text-gray-400">
          {filteredCards.length} card{filteredCards.length !== 1 ? "s" : ""} matching &ldquo;{search}&rdquo;
        </div>
      )}

      {/* ── Empty states ── */}
      {cards.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-3">💳</div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">No cards yet</div>
          <div className="text-sm text-gray-400 mb-4">
            Add your credit and debit cards. Source card details will auto-fill the voucher form.
          </div>
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            + Add your first card
          </button>
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-2xl mb-2">🔍</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            No cards match &ldquo;{search}&rdquo;
          </div>
          <button className="text-xs text-accent-600 dark:text-accent-400 underline" onClick={() => setSearch("")}>
            Clear search
          </button>
        </div>
      ) : (
        <>
          {/* ── Analytics (always uses full card list, not filtered) ── */}
          <CardAnalytics cards={cards} />

          {/* ── Cards grouped by bank ── */}
          {Object.entries(byBank)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([bank, bankCards]) => (
              <div key={bank}>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {bank}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bankCards.map((card) => {
                    const count      = getCount(card);
                    const isSelected = selectedCard?.id === card.id;

                    return (
                      <div
                        key={card.id}
                        className={`card p-4 cursor-pointer transition-all duration-200
                          ${isSelected
                            ? "md:col-span-2 ring-2 ring-accent-500 dark:ring-accent-400 bg-accent-50/30 dark:bg-accent-900/10"
                            : "hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-600"
                          }`}
                        onClick={() => setSelectedCard(isSelected ? null : card)}
                      >
                        {/* ── Card header ── */}
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                {card.cardName}
                              </span>
                              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                                •••• {card.lastFourDigits}
                              </span>
                              <span className="badge badge-unredeemed text-xs">{card.bank}</span>
                              <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-medium">
                                {card.cardType}
                              </span>
                              {count > 0 && (
                                <span className="text-xs bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300 px-2 py-0.5 rounded-full font-medium">
                                  🎫 {count} voucher{count !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>

                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                              {card.accountOwner}
                            </div>

                            <div className="space-y-0.5 text-xs text-gray-400">
                              {card.email        && <div>✉ {card.email}</div>}
                              {card.mobileNumber && <div>📱 {card.mobileNumber}</div>}
                            </div>
                          </div>

                          <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                            <button
                              className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700
                                hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                              onClick={() => { setEditing(card); setModalOpen(true); }}
                            >
                              Edit
                            </button>
                            <button
                              className="text-xs px-2 py-1 rounded border border-red-200 dark:border-red-800
                                text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              onClick={() => setDelTarget(card)}
                            >
                              Del
                            </button>
                          </div>
                        </div>

                        {/* ── Footer ── */}
                        <div className="text-xs text-gray-300 dark:text-gray-600 mt-2 pt-2 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                          <span>Added {fmtDate(card.createdAt)}</span>
                          {!isSelected && count > 0 && (
                            <span className="text-gray-400">Click to view vouchers ▼</span>
                          )}
                          {isSelected && (
                            <span className="text-accent-500 dark:text-accent-400 font-medium">▲ Click to collapse</span>
                          )}
                        </div>

                        {/* ── Inline voucher panel (only when this card is selected) ── */}
                        {isSelected && (
                          <div
                            className="mt-4 pt-4 border-t border-accent-200 dark:border-accent-800"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Vouchers linked to this card
                                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium
                                  ${cardVouchers.length > 0
                                    ? "bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300"
                                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                  }`}>
                                  {cardVouchers.length}
                                </span>
                              </span>
                              <button
                                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                onClick={() => setSelectedCard(null)}
                              >
                                ✕ Close
                              </button>
                            </div>

                            {cardVouchers.length === 0 ? (
                              <div className="py-8 text-center">
                                <div className="text-xl mb-1">🎫</div>
                                <div className="text-sm text-gray-400">No vouchers linked to this card yet</div>
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                                {cardVouchers.map(v => (
                                  <VoucherCard key={v.id} voucher={v} onEdit={onEditVoucher} />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </>
      )}

      <CardModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        existing={editing}
      />

      <ConfirmDialog
        open={!!delTarget}
        title="Delete card?"
        message={`Remove "${delTarget?.cardName} ending ${delTarget?.lastFourDigits}" from your cards list? This won't affect existing vouchers.`}
        confirmLabel="Delete"
        onConfirm={() => { if (delTarget) deleteCard(delTarget.id); setDelTarget(null); }}
        onCancel={() => setDelTarget(null)}
      />
    </div>
  );
}
