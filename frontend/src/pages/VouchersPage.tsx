import { useState, useMemo } from "react";
import { useVoucherStore } from "@/store/voucherStore";
import { VoucherCard } from "@/components/vouchers/VoucherCard";

interface VouchersPageProps {
  onAdd: () => void;
  onGetVoucher: () => void;
}

export function VouchersPage({ onAdd, onGetVoucher }: VouchersPageProps) {
  const { vouchers, brands } = useVoucherStore();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [brandFilter,  setBrandFilter]  = useState("ALL");
  const [query,        setQuery]        = useState("");

  const filtered = useMemo(() => {
    let vs = [...vouchers];
    if (statusFilter !== "ALL") vs = vs.filter(v => v.status === statusFilter);
    if (brandFilter  !== "ALL") vs = vs.filter(v => v.brand  === brandFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      vs = vs.filter(v =>
        v.voucherCode.toLowerCase().includes(q) ||
        v.title.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q) ||
        v.sourceProgramOrCard.toLowerCase().includes(q)
      );
    }
    return vs.sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime());
  }, [vouchers, statusFilter, brandFilter, query]);

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

        <input
          className={`${sel} flex-1 min-w-[180px]`}
          placeholder="Search code, title, brand, source…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        {(statusFilter !== "ALL" || brandFilter !== "ALL" || query) && (
          <button className="btn-secondary text-sm" onClick={() => { setStatusFilter("ALL"); setBrandFilter("ALL"); setQuery(""); }}>
            Clear filters
          </button>
        )}

        <div className="ml-auto flex gap-2">
          <button className="btn-secondary text-sm" onClick={onGetVoucher}>🎫 Get voucher</button>
          <button className="btn-primary text-sm"   onClick={onAdd}>+ Add voucher</button>
        </div>
      </div>

      {/* Count */}
      <div className="text-xs text-gray-400">
        {filtered.length} voucher{filtered.length !== 1 ? "s" : ""} — sorted oldest first
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-3xl mb-3">🎫</div>
          <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">No vouchers found</div>
          <div className="text-sm text-gray-400">
            {query || statusFilter !== "ALL" || brandFilter !== "ALL"
              ? "Try clearing filters"
              : <button className="text-accent-600 underline" onClick={onAdd}>Add your first voucher</button>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(v => <VoucherCard key={v.id} voucher={v} />)}
        </div>
      )}
    </div>
  );
}
