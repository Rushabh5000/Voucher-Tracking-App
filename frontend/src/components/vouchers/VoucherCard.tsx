import type { Voucher } from "@/types";
import { fmtDate, fmtVal, isExpiringSoon, STATUS_BADGE, STATUS_LABELS } from "@/utils/formatters";
import { useVoucherStore } from "@/store/voucherStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useState } from "react";

interface VoucherCardProps {
  voucher: Voucher;
  onView?: (id: string) => void;
}

export function VoucherCard({ voucher, onView }: VoucherCardProps) {
  const { redeemVoucher, unredeemVoucher, deleteVoucher } = useVoucherStore();
  const [confirmDel, setConfirmDel] = useState(false);

  const soon    = isExpiringSoon(voucher);
  const expired = voucher.status === "EXPIRED";

  // Primary display: brand is main heading, title is secondary if present
  const displayTitle = voucher.title || voucher.brand;
  const showTitle    = !!voucher.title && voucher.title !== voucher.brand;

  // Source card display: "CardName ending XXXX" or raw sourceProgramOrCard
  const sourceLabel = voucher.sourceProgramOrCard || null;

  return (
    <>
      <div className={`card p-4 transition-opacity ${voucher.status === "REDEEMED" ? "opacity-65" : ""}`}>
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1 min-w-0">

            {/* Brand + badges */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {voucher.brand}
              </span>
              <span className={STATUS_BADGE[voucher.status]}>{STATUS_LABELS[voucher.status]}</span>
              {soon && <span className="badge badge-expired">Expiring soon</span>}
            </div>

            {/* Title (optional) */}
            {showTitle && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1.5">{voucher.title}</div>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500 mt-1">
              <span>
                Code:{" "}
                <span className="font-mono text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                  {voucher.voucherCode}
                </span>
              </span>
              {sourceLabel && <span>Source: {sourceLabel}</span>}
              {voucher.cardOwner && <span>Owner: {voucher.cardOwner}</span>}
              <span className={expired ? "text-red-500" : soon ? "text-amber-500" : ""}>
                Expiry:{" "}
                {voucher.expiryDate ? fmtDate(voucher.expiryDate) : <span className="text-gray-300 dark:text-gray-600">None</span>}
              </span>
            </div>
          </div>

          {/* Date added */}
          <div className="text-xs text-gray-300 dark:text-gray-600 whitespace-nowrap flex-shrink-0">
            {fmtDate(voucher.dateAdded)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          {onView && (
            <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => onView(voucher.id)}>
              Details
            </button>
          )}
          {voucher.status === "UNREDEEMED" && (
            <button className="btn-primary text-xs px-3 py-1.5" onClick={() => redeemVoucher(voucher.id)}>
              Mark redeemed
            </button>
          )}
          {voucher.status === "REDEEMED" && (
            <button className="btn-secondary text-xs px-3 py-1.5" onClick={() => unredeemVoucher(voucher.id)}>
              Mark unredeemed
            </button>
          )}
          <button className="btn-danger text-xs px-3 py-1.5" onClick={() => setConfirmDel(true)}>
            Delete
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Delete voucher?"
        message={`Permanently remove "${voucher.brand}" (${voucher.voucherCode}). This cannot be undone.`}
        confirmLabel="Yes, delete"
        onConfirm={() => { deleteVoucher(voucher.id); setConfirmDel(false); }}
        onCancel={() => setConfirmDel(false)}
      />
    </>
  );
}
