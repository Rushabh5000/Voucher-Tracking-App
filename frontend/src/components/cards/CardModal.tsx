import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { SmartInput } from "@/components/ui/SmartInput";
import { useCardStore } from "@/store/cardStore";
import type { Card, CardFormData } from "@/types";

interface CardModalProps {
  open: boolean;
  onClose: () => void;
  existing?: Card | null;
}

const blank: CardFormData = {
  accountOwner: "",
  cardName: "",
  bank: "",
  cardType: "",
  lastFourDigits: "",
  email: "",
  mobileNumber: "",
};

export function CardModal({ open, onClose, existing }: CardModalProps) {
  const { addCard, updateCard } = useCardStore();
  const [form,   setForm]   = useState<CardFormData>(blank);
  const [saving, setSaving] = useState(false);
  const [error,  setErrorState] = useState("");
  // Every validation/API error also surfaces as a toast (top-right) — the
  // inline box alone was easy to miss since it sits at the bottom of the form.
  function setError(msg: string) {
    setErrorState(msg);
    if (msg) toast.error(msg);
  }

  useEffect(() => {
    if (open) {
      setForm(
        existing
          ? {
              accountOwner:   existing.accountOwner,
              cardName:       existing.cardName,
              bank:           existing.bank,
              cardType:       existing.cardType ?? "",
              lastFourDigits: existing.lastFourDigits,
              email:          existing.email,
              mobileNumber:   existing.mobileNumber,
            }
          : blank
      );
      setError("");
    }
  }, [open, existing]);

  const upd  = (k: keyof CardFormData) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const updE = (k: keyof CardFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit() {
    setError("");
    if (!form.accountOwner.trim())   { setError("Account owner is required."); return; }
    if (!form.cardName.trim())       { setError("Card name is required."); return; }
    if (!form.bank.trim())           { setError("Bank is required."); return; }
    if (!form.cardType.trim())       { setError("Card type is required."); return; }
    if (!form.lastFourDigits.trim()) { setError("Last 4 digits are required."); return; }
    if (!/^\d{4}$/.test(form.lastFourDigits.trim())) {
      setError("Last 4 digits must be exactly 4 numeric digits."); return;
    }
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Enter a valid email address."); return;
    }
    if (!form.mobileNumber.trim()) { setError("Mobile number is required."); return; }
    if (!/^\d{1,10}$/.test(form.mobileNumber.trim())) {
      setError("Mobile number must be up to 10 digits only."); return;
    }

    setSaving(true);
    try {
      if (existing) { await updateCard(existing.id, form); }
      else          { await addCard(form); }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? "Edit card" : "Add card"}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : existing ? "Save changes" : "Add card"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Row 1: Account owner + Bank */}
        <div className="grid grid-cols-2 gap-4">
          <SmartInput
            field="accountOwner"
            value={form.accountOwner}
            onChange={upd("accountOwner")}
            label="Account owner"
            placeholder="e.g. Rushabh Shah"
            required
          />
          <SmartInput
            field="bank"
            value={form.bank}
            onChange={upd("bank")}
            label="Bank"
            placeholder="e.g. HDFC Bank"
            required
          />
        </div>

        {/* Row 1b: Card type */}
        <SmartInput
          field="cardType"
          value={form.cardType}
          onChange={upd("cardType")}
          label="Card type"
          placeholder="e.g. Rupay Select, Visa Infinite"
          required
        />

        {/* Row 2: Card name + Last 4 digits */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">
              Card name <span className="text-red-500">*</span>
            </label>
            <input
              className="input"
              value={form.cardName}
              onChange={updE("cardName")}
              placeholder="e.g. HDFC Millennia"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label">
              Last 4 digits <span className="text-red-500">*</span>
            </label>
            <input
              className="input font-mono tracking-widest"
              value={form.lastFourDigits}
              onChange={updE("lastFourDigits")}
              placeholder="e.g. 4532"
              maxLength={4}
              inputMode="numeric"
              pattern="\d{4}"
              autoComplete="off"
            />
          </div>
        </div>

        {/* Row 3: Email + Mobile */}
        <div className="grid grid-cols-2 gap-4">
          <SmartInput
            field="email"
            value={form.email}
            onChange={upd("email")}
            label="Email"
            placeholder="your@email.com"
            type="email"
            required
          />
          <SmartInput
            field="mobileNumber"
            value={form.mobileNumber}
            onChange={upd("mobileNumber")}
            label="Mobile number"
            placeholder="9876543210"
            type="tel"
            required
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
