import { useState } from "react";
import { useCardStore } from "@/store/cardStore";
import { CardModal } from "@/components/cards/CardModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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

  // Bank breakdown — sorted by count desc
  const byBank = Object.entries(
    cards.reduce((acc, c) => { acc[c.bank] = (acc[c.bank] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a);

  const maxBankCount = byBank[0]?.[1] ?? 1;

  // Card type breakdown — sorted by count desc
  const byCardType = Object.entries(
    cards.reduce((acc, c) => { acc[c.cardType] = (acc[c.cardType] ?? 0) + 1; return acc; }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => b - a);

  const maxCardTypeCount = byCardType[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      {/* ── Breakdowns ── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Bank breakdown */}
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

        {/* Card type breakdown */}
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
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CardsPage() {
  const { cards, deleteCard } = useCardStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<Card | null>(null);
  const [delTarget, setDelTarget] = useState<Card | null>(null);

  // Group by bank for the card list
  const byBank = cards.reduce((acc, c) => {
    if (!acc[c.bank]) acc[c.bank] = [];
    acc[c.bank].push(c);
    return acc;
  }, {} as Record<string, Card[]>);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          className="btn-primary"
          onClick={() => { setEditing(null); setModalOpen(true); }}
        >
          + Add card
        </button>
      </div>

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
      ) : (
        <>
          {/* ── Analytics ── */}
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
                  {bankCards.map((card) => (
                    <div key={card.id} className="card p-4">
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
                          </div>

                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {card.accountOwner}
                          </div>

                          <div className="space-y-0.5 text-xs text-gray-400">
                            {card.email        && <div>✉ {card.email}</div>}
                            {card.mobileNumber && <div>📱 {card.mobileNumber}</div>}
                          </div>
                        </div>

                        <div className="flex gap-1.5 flex-shrink-0">
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

                      <div className="text-xs text-gray-300 dark:text-gray-600 mt-2 pt-2 border-t border-gray-50 dark:border-gray-800">
                        Added {fmtDate(card.createdAt)}
                      </div>
                    </div>
                  ))}
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
