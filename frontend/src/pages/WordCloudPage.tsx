import { useState, useMemo } from "react";
import { useVoucherStore } from "@/store/voucherStore";
import { VoucherCard } from "@/components/vouchers/VoucherCard";
import { sortVouchers } from "@/utils/formatters";
import type { VoucherStatus } from "@/types";

const WORD_COLORS = [
  "text-blue-500 dark:text-blue-400",
  "text-purple-500 dark:text-purple-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-orange-500 dark:text-orange-400",
  "text-rose-500 dark:text-rose-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-amber-600 dark:text-amber-500",
  "text-indigo-500 dark:text-indigo-400",
  "text-teal-600 dark:text-teal-400",
  "text-pink-500 dark:text-pink-400",
];

interface BrandStat {
  brand: string;
  total: number;       // all vouchers (for detail section)
  active: number;      // unredeemed + expired (drives cloud sizing)
  unredeemed: number;
  redeemed: number;
  expired: number;
}

interface Props {
  onEdit: (id: string) => void;
}

export function WordCloudPage({ onEdit }: Props) {
  const { vouchers } = useVoucherStore();
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | "ALL">("ALL");

  const brandStats = useMemo<BrandStat[]>(() => {
    const map = new Map<string, BrandStat>();
    for (const v of vouchers) {
      if (!map.has(v.brand)) {
        map.set(v.brand, { brand: v.brand, total: 0, active: 0, unredeemed: 0, redeemed: 0, expired: 0 });
      }
      const s = map.get(v.brand)!;
      s.total++;
      if (v.status === "UNREDEEMED") { s.unredeemed++; s.active++; }
      else if (v.status === "REDEEMED") s.redeemed++;
      else { s.expired++; s.active++; }
    }
    // Only show brands that have at least one unredeemed or expired voucher
    return [...map.values()]
      .filter((b) => b.active > 0)
      .sort((a, b) => b.active - a.active);
  }, [vouchers]);

  const maxCount = brandStats.length > 0 ? Math.max(...brandStats.map((b) => b.active)) : 1;
  const minCount = brandStats.length > 0 ? Math.min(...brandStats.map((b) => b.active)) : 1;

  const getFontSize = (active: number) => {
    if (maxCount === minCount) return 24;
    const ratio = (active - minCount) / (maxCount - minCount);
    return Math.round(15 + ratio * 33); // 15px–48px
  };

  const filteredVouchers = useMemo(() => {
    if (!selectedBrand) return [];
    let vs = vouchers.filter((v) => v.brand === selectedBrand);
    if (statusFilter !== "ALL") vs = vs.filter((v) => v.status === statusFilter);
    return sortVouchers(vs);
  }, [vouchers, selectedBrand, statusFilter]);

  const selectedStat = selectedBrand ? brandStats.find((b) => b.brand === selectedBrand) : null;

  const sel =
    "text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-accent-500 focus:outline-none";

  return (
    <div className="space-y-6">
      {/* Word Cloud card */}
      <div className="card p-6">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-lg">☁</span>
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">Brand Cloud</h2>
          {brandStats.length > 0 && (
            <span className="ml-auto text-xs text-gray-400">
              {brandStats.length} brand{brandStats.length !== 1 ? "s" : ""} · {brandStats.reduce((s, b) => s + b.active, 0)} unredeemed/expired · tap a brand to explore
            </span>
          )}
        </div>

        {brandStats.length === 0 ? (
          <div className="text-center py-14 text-gray-400">
            <div className="text-4xl mb-3">☁</div>
            <div className="text-sm">No unredeemed or expired vouchers yet. Add some to see your brand cloud.</div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-4 justify-center items-center min-h-[120px] py-4 px-2">
            {brandStats.map((stat, i) => {
              const size = getFontSize(stat.active);
              const colorClass = WORD_COLORS[i % WORD_COLORS.length];
              const isSelected = selectedBrand === stat.brand;
              return (
                <button
                  key={stat.brand}
                  onClick={() => {
                    setSelectedBrand(isSelected ? null : stat.brand);
                    setStatusFilter("ALL");
                  }}
                  style={{ fontSize: `${size}px`, lineHeight: 1.25 }}
                  className={`
                    relative font-semibold transition-all duration-150 rounded
                    hover:scale-110 active:scale-95 focus:outline-none
                    ${colorClass}
                    ${isSelected
                      ? "underline decoration-2 underline-offset-2 scale-110 drop-shadow-md"
                      : "opacity-75 hover:opacity-100"
                    }
                  `}
                  title={`${stat.brand}: ${stat.unredeemed} unredeemed, ${stat.expired} expired`}
                >
                  {stat.brand}
                  <span
                    className="absolute -top-1.5 -right-3 text-[9px] font-bold leading-tight
                      bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400
                      rounded-full px-1 py-px"
                  >
                    {stat.active}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected brand section */}
      {selectedBrand && selectedStat ? (
        <div className="space-y-4">
          {/* Brand header row */}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              {selectedBrand}
            </h3>

            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {selectedStat.total} total ({selectedStat.redeemed} redeemed)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                {selectedStat.unredeemed} unredeemed
              </span>
              {selectedStat.redeemed > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {selectedStat.redeemed} redeemed
                </span>
              )}
              {selectedStat.expired > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                  {selectedStat.expired} expired
                </span>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <select
                className={sel}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as VoucherStatus | "ALL")}
              >
                <option value="ALL">All statuses</option>
                <option value="UNREDEEMED">Unredeemed</option>
                <option value="REDEEMED">Redeemed</option>
                <option value="EXPIRED">Expired</option>
              </select>
              <button
                className="btn-secondary text-sm"
                onClick={() => setSelectedBrand(null)}
              >
                ✕ Clear
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-400">
            {filteredVouchers.length} voucher{filteredVouchers.length !== 1 ? "s" : ""} — unredeemed first · earliest expiry first · redeemed last
          </div>

          {filteredVouchers.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="text-2xl mb-2">🎫</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                No vouchers match the current filter
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredVouchers.map((v) => (
                <VoucherCard key={v.id} voucher={v} onEdit={onEdit} />
              ))}
            </div>
          )}
        </div>
      ) : (
        brandStats.length > 0 && (
          <div className="card p-10 text-center text-gray-400">
            <div className="text-3xl mb-2">👆</div>
            <div className="text-sm">Tap any brand above to see its vouchers</div>
          </div>
        )
      )}
    </div>
  );
}
