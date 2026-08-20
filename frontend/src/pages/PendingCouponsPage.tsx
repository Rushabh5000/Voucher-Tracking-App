import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useVoucherStore } from "@/store/voucherStore";
import { cvvUsageApi, type CvvUsageLog } from "@/api/client";
import { fmtDateTime, copyToClipboard } from "@/utils/formatters";

interface PendingCouponsPageProps {
  onAddVoucher: (bookingId: string) => void;
}

// Cross-references Card Vault's CVV usage log against vouchers: a booking ID
// that was noted when a CVV was copied, but has no voucher with that same
// booking ID yet, means the purchase happened but the resulting voucher was
// never added here.
export function PendingCouponsPage({ onAddVoucher }: PendingCouponsPageProps) {
  const { vouchers } = useVoucherStore();
  const [logs, setLogs] = useState<CvvUsageLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cvvUsageApi.list()
      .then(setLogs)
      .catch(() => toast.error("Couldn't load the CVV usage log"))
      .finally(() => setLoading(false));
  }, []);

  async function handleCopy(bookingId: string) {
    const ok = await copyToClipboard(bookingId);
    toast[ok ? "success" : "error"](ok ? "Booking ID copied" : "Couldn't copy");
  }

  if (loading) {
    return <div className="card p-10 text-center text-sm text-gray-400">Loading…</div>;
  }

  const voucherBookingIds = new Set(
    vouchers.map((v) => v.bookingId.trim().toLowerCase()).filter(Boolean)
  );
  const pending = logs
    .filter((l) => l.bookingId.trim() && !voucherBookingIds.has(l.bookingId.trim().toLowerCase()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (pending.length === 0) {
    return (
      <div className="card p-8 text-center max-w-xl mx-auto mt-6">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">No pending coupons</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Every booking ID logged in Card Vault's CVV usage log already has a matching voucher.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Booking IDs noted in Card Vault's CVV usage log with no matching voucher yet — a purchase you
          made but haven't added the resulting voucher for. <strong>{pending.length}</strong> pending.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="px-4 py-2 font-medium">Card</th>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">Booking ID</th>
                <th className="px-3 py-2 font-medium">Logged</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {pending.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                  <td className="px-4 py-2.5 whitespace-nowrap text-gray-700 dark:text-gray-300">{l.cardLabel}</td>
                  <td className="px-3 py-2.5">
                    {l.brand || <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono whitespace-nowrap">{l.bookingId}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-3">
                      <button className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" onClick={() => handleCopy(l.bookingId)}>
                        Copy ID
                      </button>
                      <button className="text-xs text-accent-600 dark:text-accent-400 font-medium hover:underline" onClick={() => onAddVoucher(l.bookingId)}>
                        + Add voucher
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
