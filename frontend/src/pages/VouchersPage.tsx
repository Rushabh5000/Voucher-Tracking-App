import { useState, useMemo } from "react";
import { useVoucherStore } from "@/store/voucherStore";
import { useCardStore } from "@/store/cardStore";
import { VoucherCard } from "@/components/vouchers/VoucherCard";
import { sortVouchers } from "@/utils/formatters";

interface VouchersPageProps {
  onAdd: () => void;
  onGetVoucher: () => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
}

export function VouchersPage({ onAdd, onGetVoucher, onEdit, onView }: VouchersPageProps) {
  const { vouchers, brands } = useVoucherStore();
  const { cards }            = useCardStore();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [brandFilter,  setBrandFilter]  = useState("ALL");
  const [cardFilter,   setCardFilter]   = useState("ALL");
  const [query,        setQuery]        = useState("");

  // Find the selected card object for matching
  const selectedCard = useMemo(
    () => cards.find(c => c.id === cardFilter) ?? null,
    [cards, cardFilter]
  );

  const filtered = useMemo(() => {
    let vs = [...vouchers];
    if (statusFilter !== "ALL") vs = vs.filter(v => v.status === statusFilter);
    if (brandFilter  !== "ALL") vs = vs.filter(v => v.brand  === brandFilter);
    if (selectedCard) {
      vs = vs.filter(v =>
        v.cardName  === selectedCard.cardName &&
        v.cardOwner === selectedCard.accountOwner
      );
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      vs = vs.filter(v =>
        v.voucherCode.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q) ||
        v.sourceProgramOrCard.toLowerCase().includes(q)
      );
    }
    return sortVouchers(vs);
  }, [vouchers, statusFilter, brandFilter, selectedCard, query]);

  const hasFilters = statusFilter !== "ALL" || brandFilter !== "ALL" || cardFilter !== "ALL" || !!query.trim();

  const sel = "text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-accent-500 focus:outline-none";

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap items-center">
        <select className={sel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="UNREDEEMED">Unredeemed</option>
          <option value="REDEEMED">Redeemed</option>
          <option value="EXPIRED">Expired</option>
        </select>

        <select className={sel} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
          <option value="ALL">All brands</option>
          {brands().map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        {cards.length > 0 && (
          <select className={sel} value={cardFilter} onChange={e => setCardFilter(e.target.value)}>
            <option value="ALL">All cards</option>
            {cards
              .slice()
              .sort((a, b) => a.cardName.localeCompare(b.cardName))
              .map(c => (
                <option key={c.id} value={c.id}>
                  {c.cardName} ···· {c.lastFourDigits} ({c.accountOwner})
                </option>
              ))}
          </select>
        )}

        <input
          className={`${sel} flex-1 min-w-[180px]`}
          placeholder="Search code, title, brand, source…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />

        {hasFilters && (
          <button
            className="btn-secondary text-sm"
            onClick={() => { setStatusFilter("ALL"); setBrandFilter("ALL"); setCardFilter("ALL"); setQuery(""); }}
          >
            Clear filters
          </button>
        )}

        <div className="ml-auto flex gap-2">
          <button className="btn-secondary text-sm" onClick={onGetVoucher}>🎫 Get voucher</button>
          <button className="btn-primary text-sm"   onClick={onAdd}>+ Add voucher</button>
        </div>
      </div>

      {/* Active card filter banner */}
      {selectedCard && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 text-sm">
          <span className="text-accent-600 dark:text-accent-400 font-medium">💳 {selectedCard.cardName} ···· {selectedCard.lastFourDigits}</span>
          <span className="text-gray-500 dark:text-gray-400">— {selectedCard.accountOwner} · {selectedCard.bank}</span>
          <button
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={() => setCardFilter("ALL")}
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Count */}
      <div className="text-xs text-gray-400">
        {filtered.length} voucher{filtered.length !== 1 ? "s" : ""} — unredeemed first · earliest expiry first · redeemed last
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-3">🎫</div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">No vouchers found</div>
          <div className="text-sm text-gray-400">
            {hasFilters
              ? "Try clearing filters"
              : <button className="text-accent-600 underline" onClick={onAdd}>Add your first voucher</button>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(v => <VoucherCard key={v.id} voucher={v} onView={onView} onEdit={onEdit} />)}
        </div>
      )}
    </div>
  );
}
