import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { SmartInput } from "@/components/ui/SmartInput";
import { cvvUsageApi } from "@/api/client";

interface CvvUsageModalProps {
  open: boolean;
  onClose: () => void;
  cardLabel: string;
  anchorRect: DOMRect | null; // the row's bounding rect — panel opens just below it
}

const GAP = 6;

// Opened the moment a CVV is copied (the copy itself already happened —
// this never blocks it). Renders as a floating panel anchored just below the
// row that was clicked, rather than a full-screen modal, so the rest of the
// table stays visible/scrollable behind it. Booking ID is usually generated
// only after the transaction completes, so this stays open at the user's own
// pace: fill in brand/booking ID whenever they're known, or just close it
// without saving anything. Only cardLabel/brand/bookingId are ever sent —
// never the CVV or card number.
export function CvvUsageModal({ open, onClose, cardLabel, anchorRect }: CvvUsageModalProps) {
  const [brand, setBrand]         = useState("");
  const [bookingId, setBookingId] = useState("");
  const [error, setError]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) { setBrand(""); setBookingId(""); setError(""); }
  }, [open, cardLabel]);

  const updatePosition = useCallback(() => {
    if (!anchorRect) { setPos(null); return; }
    const width = Math.max(320, Math.min(360, window.innerWidth - 24));
    let left = anchorRect.left;
    if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12);
    setPos({ top: anchorRect.bottom + GAP, left, width });
  }, [anchorRect]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      await cvvUsageApi.create({ cardLabel, brand: brand.trim(), bookingId: bookingId.trim() });
      toast.success("Logged");
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || "Couldn't save the log entry";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
      className="z-[90] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">CVV copied</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          ✕
        </button>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>{cardLabel}</strong> — copied to clipboard. Note what it's for now, or come back
          and fill in the booking ID once it's generated. Both fields are optional.
        </p>
        <SmartInput
          field="brand"
          value={brand}
          onChange={setBrand}
          label="Brand"
          placeholder="e.g. Amazon"
        />
        <div>
          <label className="label">Booking ID</label>
          <input
            className="input"
            value={bookingId}
            onChange={(e) => { setBookingId(e.target.value); setError(""); }}
            placeholder="e.g. order/booking reference"
            autoComplete="off"
          />
        </div>
        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
        <button className="btn-secondary" onClick={onClose}>Close</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>,
    document.body
  );
}
