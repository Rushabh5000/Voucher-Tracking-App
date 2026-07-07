import type { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { useVoucherStore } from "@/store/voucherStore";
import { fmtDate, fmtDateTime, copyToClipboard, STATUS_BADGE, STATUS_LABELS } from "@/utils/formatters";
import { PERIOD_TYPE_LABEL, periodLabel } from "@/utils/periods";
import toast from "react-hot-toast";

interface VoucherDetailModalProps {
  open: boolean;
  onClose: () => void;
  voucherId?: string;
  onEdit?: (id: string) => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</span>
      <span className="font-medium text-gray-800 dark:text-gray-200 text-right break-words">{children}</span>
    </div>
  );
}

export function VoucherDetailModal({ open, onClose, voucherId, onEdit }: VoucherDetailModalProps) {
  const { vouchers } = useVoucherStore();
  const voucher = voucherId ? vouchers.find((v) => v.id === voucherId) : null;

  if (!voucher) return null;

  async function handleCopy() {
    const ok = await copyToClipboard(voucher!.voucherCode);
    if (ok) toast.success("Code copied to clipboard");
    else toast.error("Couldn't copy code");
  }

  const none = <span className="text-gray-400 dark:text-gray-600">—</span>;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Voucher details"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          {onEdit && (
            <button className="btn-primary" onClick={() => { onEdit(voucher.id); onClose(); }}>Edit</button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Header: brand + status */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">{voucher.brand}</div>
            {voucher.title && voucher.title !== voucher.brand && (
              <div className="text-sm text-gray-500 dark:text-gray-400">{voucher.title}</div>
            )}
          </div>
          <span className={STATUS_BADGE[voucher.status]}>{STATUS_LABELS[voucher.status]}</span>
        </div>

        {/* Code — click to copy */}
        <button
          type="button"
          onClick={handleCopy}
          title="Click to copy"
          className="w-full bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors cursor-pointer group"
        >
          <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">
            Voucher code <span className="text-accent-500 group-hover:underline">— tap to copy ⧉</span>
          </div>
          <div className="font-mono font-bold text-lg text-gray-900 dark:text-gray-100 break-all">
            {voucher.voucherCode}
          </div>
        </button>

        {/* Details */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <Row label="Source card">{voucher.sourceProgramOrCard || none}</Row>
          <Row label="Card owner">{voucher.cardOwner || none}</Row>
          <Row label="Card name">{voucher.cardName || none}</Row>
          <Row label="Email">{voucher.emailId || none}</Row>
          <Row label="Recurring period">
            {voucher.periodType
              ? `${PERIOD_TYPE_LABEL[voucher.periodType] ?? voucher.periodType} · ${periodLabel(voucher.periodType, voucher.periodKey)}`
              : <span className="text-gray-400 dark:text-gray-600">One-time</span>}
          </Row>
          <Row label="Issue date">{voucher.issueDate ? fmtDate(voucher.issueDate) : none}</Row>
          <Row label="Expiry date">{voucher.expiryDate ? fmtDate(voucher.expiryDate) : <span className="text-gray-400 dark:text-gray-600">No expiry</span>}</Row>
          <Row label="Added on">{fmtDate(voucher.dateAdded)}</Row>
          {voucher.status === "REDEEMED" && voucher.redeemedAt && (
            <Row label="Redeemed on">{fmtDateTime(voucher.redeemedAt)}</Row>
          )}
        </div>

        {/* Notes */}
        {voucher.description && (
          <div className="text-sm">
            <div className="text-gray-500 dark:text-gray-400 mb-1">Notes</div>
            <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{voucher.description}</div>
          </div>
        )}
      </div>
    </Modal>
  );
}
