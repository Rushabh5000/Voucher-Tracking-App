import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import type { VaultRow } from "@/utils/cardVaultExcel";

type FormState = Omit<VaultRow, "id">;

interface CardVaultRowModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: FormState) => void;
  existing?: VaultRow | null;
}

const blank: FormState = {
  type: "", cardType: "", accOwner: "", cardName: "", bank: "",
  email: "", number: "", cardNumber: "", expiry: "", cvv: "",
};

// Every field here is a plain input — never SmartInput, which calls the
// backend autocomplete API. This vault must make zero network requests.
export function CardVaultRowModal({ open, onClose, onSave, existing }: CardVaultRowModalProps) {
  const [form, setForm]   = useState<FormState>(blank);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(existing ? { ...existing } : blank);
      setError("");
    }
  }, [open, existing]);

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit() {
    if (!form.cardName.trim() && !form.cardNumber.trim()) {
      setError("Enter at least a card name or card number.");
      return;
    }
    setError("");
    onSave(form);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? "Edit card" : "Add card"}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit}>{existing ? "Save changes" : "Add card"}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Type</label>
            <input className="input" value={form.type} onChange={upd("type")} placeholder="Credit / Debit" autoComplete="off" />
          </div>
          <div>
            <label className="label">Card type</label>
            <input className="input" value={form.cardType} onChange={upd("cardType")} placeholder="e.g. Rupay Select" autoComplete="off" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Account owner</label>
            <input className="input" value={form.accOwner} onChange={upd("accOwner")} placeholder="e.g. Rushabh Shah" autoComplete="off" />
          </div>
          <div>
            <label className="label">Card name</label>
            <input className="input" value={form.cardName} onChange={upd("cardName")} placeholder="e.g. HDFC Millennia" autoComplete="off" />
          </div>
        </div>

        <div>
          <label className="label">Bank</label>
          <input className="input" value={form.bank} onChange={upd("bank")} placeholder="e.g. HDFC Bank" autoComplete="off" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Email</label>
            <input className="input" value={form.email} onChange={upd("email")} placeholder="your@email.com" autoComplete="off" />
          </div>
          <div>
            <label className="label">Number (mobile)</label>
            <input className="input" value={form.number} onChange={upd("number")} placeholder="9876543210" autoComplete="off" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="label">Card number</label>
            <input
              className="input font-mono tracking-wider"
              value={form.cardNumber}
              onChange={upd("cardNumber")}
              placeholder="XXXX XXXX XXXX XXXX"
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">Expiry</label>
            <input className="input font-mono" value={form.expiry} onChange={upd("expiry")} placeholder="MM/YY" autoComplete="off" />
          </div>
        </div>

        <div className="w-32">
          <label className="label">CVV</label>
          <input
            className="input font-mono"
            value={form.cvv}
            onChange={upd("cvv")}
            placeholder="123"
            inputMode="numeric"
            maxLength={4}
            autoComplete="off"
          />
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
