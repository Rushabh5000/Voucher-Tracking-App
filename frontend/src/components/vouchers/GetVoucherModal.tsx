import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { useVoucherStore } from "@/store/voucherStore";
import type { Voucher } from "@/types";
import { fmtDate, fmtVal, isExpiringSoon, STATUS_BADGE, STATUS_LABELS } from "@/utils/formatters";

interface GetVoucherModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "select-brand" | "show-voucher";

export function GetVoucherModal({ open, onClose }: GetVoucherModalProps) {
  const { brands, getNext, redeemVoucher } = useVoucherStore();

  const [step,     setStep]     = useState<Step>("select-brand");
  const [brand,    setBrand]    = useState<string>("ALL");
  const [voucher,  setVoucher]  = useState<Voucher | null | undefined>(undefined); // undefined=loading, null=none
  const [loading,  setLoading]  = useState(false);
  const [redeeming,setRedeeming] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) { setStep("select-brand"); setBrand("ALL"); setVoucher(undefined); }
  }, [open]);

  async function fetchNext() {
    setLoading(true);
    try {
      const v = await getNext(brand === "ALL" ? undefined : brand);
      setVoucher(v);
    } finally {
      setLoading(false);
      setStep("show-voucher");
    }
  }

  async function handleRedeem() {
    if (!voucher) return;
    setRedeeming(true);
    try {
      await redeemVoucher(voucher.id);
      onClose();
    } finally {
      setRedeeming(false);
    }
  }

  const brandList = ["ALL", ...brands()];
  const soon = voucher ? isExpiringSoon(voucher) : false;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === "select-brand" ? "Get voucher — select brand" : "Next available voucher"}
      size="md"
      footer={
        step === "select-brand" ? (
          <>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={fetchNext} disabled={loading}>
              {loading ? "Fetching…" : "Get voucher →"}
            </button>
          </>
        ) : voucher ? (
          <>
            <button className="btn-secondary" onClick={onClose}>Close — keep unredeemed</button>
            <button className="btn-primary" onClick={handleRedeem} disabled={redeeming}>
              {redeeming ? "Redeeming…" : "Redeem now"}
            </button>
          </>
        ) : (
          <button className="btn-secondary" onClick={onClose}>Close</button>
        )
      }
    >
      {/* Step 1: Brand selection */}
      {step === "select-brand" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose a brand to fetch the oldest unredeemed voucher, or select <strong>All brands</strong>.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {brandList.map((b) => (
              <button
                key={b}
                onClick={() => setBrand(b)}
                className={`px-3 py-2.5 text-sm rounded-lg border text-left transition-colors
                  ${brand === b
                    ? "bg-accent-50 dark:bg-accent-900/30 border-accent-300 dark:border-accent-700 text-accent-700 dark:text-accent-300 font-medium"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
              >
                {b === "ALL" ? "✦ All brands" : b}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Show voucher */}
      {step === "show-voucher" && (
        <div>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && voucher === null && (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">🎫</div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">No vouchers available</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {brand === "ALL"
                  ? "All vouchers have been redeemed, expired, or deleted."
                  : `No unredeemed vouchers for ${brand}.`}
              </p>
              <button
                className="mt-4 text-sm text-accent-600 dark:text-accent-400 underline"
                onClick={() => setStep("select-brand")}
              >
                Try a different brand
              </button>
            </div>
          )}

          {!loading && voucher && (
            <div className="space-y-4">
              {/* Safety notice */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <span className="text-amber-500 flex-shrink-0">⚠</span>
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  Viewing this voucher does <strong>not</strong> mark it as redeemed.
                  Only click <strong>"Redeem now"</strong> after you have actually used it.
                </p>
              </div>

              {/* Voucher header */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-lg text-gray-900 dark:text-gray-100">{voucher.brand}</div>
                  {voucher.title && voucher.title !== voucher.brand && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">{voucher.title}</div>
                  )}
                </div>
                <span className={STATUS_BADGE[voucher.status]}>{STATUS_LABELS[voucher.status]}</span>
              </div>

              {/* Code display */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center">
                <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Voucher code</div>
                <div className="font-mono font-bold text-xl text-gray-900 dark:text-gray-100 break-all">
                  {voucher.voucherCode}
                </div>
              </div>

              {/* Details */}
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {voucher.sourceProgramOrCard && (
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-500">Source</span>
                    <span className="font-medium">{voucher.sourceProgramOrCard}</span>
                  </div>
                )}
                {voucher.value != null && (
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-500">Value</span>
                    <span className="font-medium">{fmtVal(voucher.value)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-gray-500">Expiry</span>
                  <span className={`font-medium ${soon ? "text-amber-600 dark:text-amber-400" : ""}`}>
                    {voucher.expiryDate ? fmtDate(voucher.expiryDate) : <span className="text-gray-400">No expiry</span>}
                    {soon && " ⚠"}
                  </span>
                </div>
                <div className="flex justify-between py-2 text-sm">
                  <span className="text-gray-500">Added on</span>
                  <span className="font-medium">{fmtDate(voucher.dateAdded)}</span>
                </div>
                {voucher.cardOwner && (
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-500">Card owner</span>
                    <span className="font-medium">{voucher.cardOwner}</span>
                  </div>
                )}
                {voucher.emailId && (
                  <div className="flex justify-between py-2 text-sm">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium">{voucher.emailId}</span>
                  </div>
                )}
                {voucher.description && (
                  <div className="py-2 text-sm">
                    <div className="text-gray-500 mb-1">Notes</div>
                    <div className="text-gray-700 dark:text-gray-300">{voucher.description}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
