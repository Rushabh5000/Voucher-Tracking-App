import { useState, useMemo } from "react";
import { useVoucherStore } from "@/store/voucherStore";
import { VoucherCard } from "@/components/vouchers/VoucherCard";

interface DashboardPageProps {
  onAddVoucher: () => void;
  onGetVoucher: () => void;
  onEditVoucher: (id: string) => void;
}

function StatCard({
  label, value, color, active, onClick,
}: {
  label: string; value: number | string; color?: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card p-5 text-left w-full transition-all duration-150 focus:outline-none
        ${onClick ? "cursor-pointer hover:ring-2 hover:ring-accent-400/60 hover:shadow-md active:scale-[0.98]" : ""}
        ${active ? "ring-2 ring-accent-500 bg-accent-50/40 dark:bg-accent-900/20" : ""}
      `}
    >
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-bold tracking-tight ${color || "text-gray-900 dark:text-gray-100"}`}>
        {value}
      </div>
    </button>
  );
}

export function DashboardPage({ onAddVoucher, onGetVoucher, onEditVoucher }: DashboardPageProps) {
  const { vouchers, brands } = useVoucherStore();

  type StatusFilter = "UNREDEEMED" | "REDEEMED" | "EXPIRED" | "EXPIRING_SOON" | "ALL";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("UNREDEEMED");
  const [brandFilter,  setBrandFilter]  = useState("ALL");

  const now = Date.now();
  const total       = vouchers.length;
  const unredeemed  = vouchers.filter(v => v.status === "UNREDEEMED").length;
  const redeemed    = vouchers.filter(v => v.status === "REDEEMED").length;
  const expired     = vouchers.filter(v => v.status === "EXPIRED").length;
  const expiringIn7 = vouchers.filter(v =>
    v.status === "UNREDEEMED" && v.expiryDate &&
    new Date(v.expiryDate).getTime() - now < 7 * 86400000 &&
    new Date(v.expiryDate).getTime() > now
  ).length;

  // Filtered "oldest first" list
  const filtered = useMemo(() => {
    let vs = [...vouchers];
    switch (statusFilter) {
      case "UNREDEEMED":    vs = vs.filter(v => v.status === "UNREDEEMED"); break;
      case "REDEEMED":      vs = vs.filter(v => v.status === "REDEEMED"); break;
      case "EXPIRED":       vs = vs.filter(v => v.status === "EXPIRED"); break;
      case "EXPIRING_SOON": vs = vs.filter(v =>
        v.status === "UNREDEEMED" && v.expiryDate &&
        new Date(v.expiryDate).getTime() - now < 7 * 86400000 &&
        new Date(v.expiryDate).getTime() > now
      ); break;
      // "ALL": no status filter
    }
    if (brandFilter !== "ALL") vs = vs.filter(v => v.brand === brandFilter);
    return vs.sort((a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime());
  }, [vouchers, statusFilter, brandFilter, now]);

  const hasFilters   = statusFilter !== "UNREDEEMED" || brandFilter !== "ALL";
  const displayCount = filtered.length;

  const sel = "text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-accent-500 focus:outline-none";

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <button className="btn-primary"   onClick={onAddVoucher}>+ Add voucher</button>
        <button className="btn-secondary" onClick={onGetVoucher}>🎫 Get voucher</button>
      </div>

      {/* Stats — clickable to filter */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total"   value={total}
          active={statusFilter === "ALL"}
          onClick={() => setStatusFilter("ALL")}
        />
        <StatCard label="Unredeemed" value={unredeemed} color="text-accent-600 dark:text-accent-400"
          active={statusFilter === "UNREDEEMED"}
          onClick={() => setStatusFilter("UNREDEEMED")}
        />
        <StatCard label="Redeemed" value={redeemed} color="text-gray-400"
          active={statusFilter === "REDEEMED"}
          onClick={() => setStatusFilter("REDEEMED")}
        />
        <StatCard label="Expired" value={expired} color="text-amber-600 dark:text-amber-400"
          active={statusFilter === "EXPIRED"}
          onClick={() => setStatusFilter("EXPIRED")}
        />
        <StatCard
          label="Expiring in 7 days"
          value={expiringIn7}
          color={expiringIn7 > 0 ? "text-red-500" : "text-gray-900 dark:text-gray-100"}
          active={statusFilter === "EXPIRING_SOON"}
          onClick={() => setStatusFilter("EXPIRING_SOON")}
        />
      </div>

      {/* Expiry warning banner */}
      {expiringIn7 > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-3">
          <span className="text-amber-500 text-xl flex-shrink-0">⚠</span>
          <div>
            <div className="font-medium text-amber-800 dark:text-amber-200 text-sm">
              {expiringIn7} voucher{expiringIn7 > 1 ? "s" : ""} expiring within 7 days — use them soon!
            </div>
          </div>
        </div>
      )}

      {/* Voucher list with filters */}
      <div>
        {/* Section header + filters */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Vouchers
          </h2>

          {/* Status filter */}
          <select className={sel} value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="ALL">All</option>
            <option value="UNREDEEMED">Unredeemed</option>
            <option value="REDEEMED">Redeemed</option>
            <option value="EXPIRED">Expired</option>
            <option value="EXPIRING_SOON">Expiring in 7 days</option>
          </select>

          {/* Brand filter */}
          <select className={sel} value={brandFilter} onChange={e => setBrandFilter(e.target.value)}>
            <option value="ALL">All brands</option>
            {brands().map(b => <option key={b} value={b}>{b}</option>)}
          </select>

          {hasFilters && (
            <button
              className="text-xs text-accent-600 dark:text-accent-400 underline"
              onClick={() => { setStatusFilter("UNREDEEMED"); setBrandFilter("ALL"); }}
            >
              Reset
            </button>
          )}

          <span className="text-xs text-gray-400 ml-auto">
            {displayCount} voucher{displayCount !== 1 ? "s" : ""} — oldest first
          </span>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-3xl mb-2">✓</div>
            <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
              {statusFilter === "EXPIRING_SOON" ? "No vouchers expiring in 7 days"
                : hasFilters ? "No vouchers match these filters"
                : "No unredeemed vouchers"}
            </div>
            {!hasFilters && (
              <button className="btn-primary mt-3 text-sm" onClick={onAddVoucher}>
                + Add voucher
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(v => <VoucherCard key={v.id} voucher={v} onEdit={onEditVoucher} />)}
          </div>
        )}
      </div>
    </div>
  );
}
