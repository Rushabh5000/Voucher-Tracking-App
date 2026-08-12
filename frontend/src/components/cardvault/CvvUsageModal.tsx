import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { SmartInput } from "@/components/ui/SmartInput";
import { cvvUsageApi } from "@/api/client";

interface CvvUsageModalProps {
  open: boolean;
  onClose: () => void;
  cardLabel: string;
}

// Opened the moment a CVV is copied (the copy itself already happened —
// this never blocks it). Booking ID is usually generated only after the
// transaction completes, so this stays open at the user's own pace: fill in
// brand/booking ID whenever they're known, or just close it without saving
// anything at all. Only cardLabel/brand/bookingId are ever sent — never the
// CVV or card number.
export function CvvUsageModal({ open, onClose, cardLabel }: CvvUsageModalProps) {
  const [brand, setBrand]         = useState("");
  const [bookingId, setBookingId] = useState("");
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (open) { setBrand(""); setBookingId(""); }
  }, [open, cardLabel]);

  async function handleSave() {
    setSaving(true);
    try {
      await cvvUsageApi.create({ cardLabel, brand: brand.trim(), bookingId: bookingId.trim() });
      toast.success("Logged");
      onClose();
    } catch {
      toast.error("Couldn't save the log entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="CVV copied"
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>{cardLabel}</strong> — CVV copied to clipboard. Note what it's for now, or come back
          and fill in the booking ID once it's generated. Both fields are optional.
        </p>
        <SmartInput
          field="brand"
          value={brand}
          onChange={setBrand}
          label="Brand"
          placeholder="e.g. Amazon"
        />
        <SmartInput
          field="bookingId"
          value={bookingId}
          onChange={setBookingId}
          label="Booking ID"
          placeholder="e.g. order/booking reference"
          dropUp
        />
      </div>
    </Modal>
  );
}
