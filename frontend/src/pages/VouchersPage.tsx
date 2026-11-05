import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
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

const sel = "w-full text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-accent-500 focus:outline-none";

export function VouchersPage({ onAdd, onGetVoucher, onEdit, onView }: VouchersPageProps) {
  const { vouchers, brands } = useVoucherStore();
  const { cards }            = useCardStore();
  const location             = useLocation();

  const [statusFilter,  setStatusFilter]  = useState("ALL");
  const [brandFilter,   setBrandFilter]   = useState("ALL");
  const [bankFilter,    setBankFilter]    = useState("ALL");
  const [cardFilter,    setCardFilter]    = useState("ALL");
  const [ownerFilter,   setOwnerFilter]   = useState("ALL");
  const [bookingFilter, setBookingFilter] = useState("ALL");
  const [periodFilter,  setPeriodFilter]  = useState("ALL");
  const [expiryFilter,  setExpiryFilter]  = useState("ALL");
  const [query,         setQuery]         = useState("");

  useEffect(() => {
    const id = (location.state as any)?.openVoucherId;
    if (id) { onEdit(id); window.history.replaceState({}, ""); }
  }, [location.state]);

  const selectedCard = useMemo(() => cards.find(c => c.id === cardFilter) ?? null, [cards, cardFilter]);

  const banks = useMemo(() => [...new Set(cards.map(c => c.bank))].sort(), [cards]);
  const owners = useMemo(() => [...new Set(cards.map(c => c.accountOwner).filter(Boolean))].sort(), [cards]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    let vs = [...vouchers];

    if (statusFilter  !== "ALL") vs = vs.filter(v => v.status    === statusFilter);
    if (brandFilter   !== "ALL") vs = vs.filter(v => v.brand     === brandFilter);
    if (bankFilter    !== "ALL") vs = vs.filter(v => v.sourceProgramOrCard?.startsWith(bankFilter + " |") || v.sourceProgramOrCard?.startsWith(bankFilter + "|"));
    if (selectedCard) {
      const label = `${selectedCard.bank} | ${selectedCard.lastFourDigits}`;
      vs = vs.filter(v => v.sourceProgramOrCard === label);
    }
    if (ownerFilter !== "ALL") vs = vs.filter(v => v.cardOwner === ownerFilter);

    if (bookingFilter === "HAS")     vs = vs.filter(v => !!v.bookingId?.trim());
    if (bookingFilter === "MISSING") vs = vs.filter(v => !v.bookingId?.trim());

    if (periodFilter === "NONE") vs = vs.filter(v => !v.periodType);
    else if (periodFilter !== "ALL") vs = vs.filter(v => v.periodType === periodFilter);

    if (expiryFilter === "HAS_EXPIRY")    vs = vs.filter(v => !!v.expiryDate);
    if (expiryFilter === "NO_EXPIRY")     vs = vs.filter(v => !v.expiryDate);
    if (expiryFilter === "EXPIRING_SOON") vs = vs.filter(v =>
      v.expiryDate && v.status === "UNREDEEMED" &&
      new Date(v.expiryDate).getTime() - now <= thirtyDays &&
      new Date(v.expiryDate).getTime() > now
    );

    if (query.trim()) {
      const q = query.toLowerCase();
      vs = vs.filter(v =>
        v.voucherCode.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q) ||
        v.sourceProgramOrCard.toLowerCase().includes(q) ||
        (v.bookingId ?? "").toLowerCase().includes(q) ||
        (v.emailId   ?? "").toLowerCase().includes(q)
      );
    }

    return sortVouchers(vs);
  }, [vouchers, statusFilter, brandFilter, bankFilter, selectedCard, ownerFilter, bookingFilter, periodFilter, expiryFilter, query]);

  const hasFilters =
    statusFilter !== "ALL" || brandFilter !== "ALL" || bankFilter !== "ALL" ||
    cardFilter   !== "ALL" || ownerFilter !== "ALL" || bookingFilter !== "ALL" ||
    periodFilter !== "ALL" || expiryFilter !== "ALL" || !!query.trim();

  function clearAll() {
    setStatusFilter("ALL"); setBrandFilter("ALL"); setBankFilter("ALL");
    setCardFilter("ALL");   setOwnerFilter("ALL"); setBookingFilter("ALL");
    setPeriodFilter("ALL"); setExpiryFilter("ALL"); setQuery("");
  }

  return (
    <div className="space-y-3">
      {/* Filter grid — fixed 4-col layout, never reflows */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <select className={sel} value={statusFilter}  onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All statuses</option>
          <option value="UNREDEEMED">Unredeemed</option>
          <option value="REDEEMED">Redeemed</option>
          <option value="EXPIRED">Expired</option>
        </select>

        <select className={sel} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
          <option value="ALL">All brands</option>
          {brands().map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select className={sel} value={bankFilter} onChange={e => setBankFilter(e.target.value)}>
          <option value="ALL">All banks</option>
          {banks.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select className={sel} value={cardFilter} onChange={e => setCardFilter(e.target.value)}>
          <option value="ALL">All cards</option>
          {cards
            .slice()
            .sort((a, b) => `${a.bank} ${a.lastFourDigits}`.localeCompare(`${b.bank} ${b.lastFourDigits}`))
            .map(c => (
              <option key={c.id} value={c.id}>
                {c.bank} | {c.lastFourDigits} · {c.accountOwner}
              </option>
            ))}
        </select>

        <select className={sel} value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
          <option value="ALL">All owners</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        <select className={sel} value={bookingFilter} onChange={e => setBookingFilter(e.target.value)}>
          <option value="ALL">All — booking ID</option>
          <option value="HAS">Has booking ID</option>
          <option value="MISSING">No booking ID</option>
        </select>

        <select className={sel} value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}>
          <option value="ALL">All periods</option>
          <option value="QUARTERLY">Quarterly</option>
          <option value="HALF_YEARLY">Half-yearly</option>
          <option value="YEARLY">Yearly</option>
          <option value="NONE">One-time (no period)</option>
        </select>

        <select className={sel} value={expiryFilter} onChange={e => setExpiryFilter(e.target.value)}>
          <option value="ALL">All — expiry</option>
          <option value="HAS_EXPIRY">Has expiry date</option>
          <option value="NO_EXPIRY">No expiry date</option>
          <option value="EXPIRING_SOON">Expiring within 30 days</option>
        </select>
      </div>

      {/* Search + actions row */}
      <div className="flex gap-2 items-center">
        <input
          className="flex-1 text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-accent-500 focus:outline-none min-w-0"
          placeholder="Search code, title, brand, booking ID…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
        {hasFilters && <button className="btn-secondary text-sm whitespace-nowrap" onClick={clearAll}>Clear filters</button>}
        <button className="btn-secondary text-sm whitespace-nowrap" onClick={onGetVoucher}>🎫 Get voucher</button>
        <button className="btn-primary text-sm whitespace-nowrap"   onClick={onAdd}>+ Add voucher</button>
      </div>

      {/* Active card filter banner */}
      {selectedCard && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-50 dark:bg-accent-900/20 border border-accent-200 dark:border-accent-800 text-sm">
          <span className="text-accent-600 dark:text-accent-400 font-medium">
            💳 {selectedCard.bank} | {selectedCard.lastFourDigits}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            — {selectedCard.accountOwner} · {selectedCard.cardName}
          </span>
          <button className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" onClick={() => setCardFilter("ALL")}>
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
              ? <button className="text-accent-600 underline" onClick={clearAll}>Clear filters</button>
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
