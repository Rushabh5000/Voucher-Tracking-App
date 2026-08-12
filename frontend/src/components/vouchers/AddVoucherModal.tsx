import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { SmartInput } from "@/components/ui/SmartInput";
import { useVoucherStore } from "@/store/voucherStore";
import { CardSelectInput } from "./CardSelectInput";
import { PeriodSelector } from "./PeriodSelector";
import { currentPeriodKey } from "@/utils/periods";
import { useCardStore } from "@/store/cardStore";
import { cvvUsageApi } from "@/api/client";
import type { Card } from "@/types";

// Pulls "bank" and "last 4 digits" back out of a Card Vault row label like
// "Bank Of Baroda | Rushabh •••• 3657" (see rowLabel in CardVaultPage.tsx),
// so a Booking ID looked up from the CVV usage log can be matched back to a
// real source card here.
function parseCardLabel(label: string): { bank: string; last4: string } {
  const last4Match = label.match(/(\d{4})\s*$/);
  return { bank: label.split("|")[0].trim(), last4: last4Match ? last4Match[1] : "" };
}

interface AddVoucherModalProps {
  open: boolean;
  onClose: () => void;
}

// Returns today's date as YYYY-MM-DD
function today(): string {
  return new Date().toISOString().split("T")[0];
}


interface FormState {
  voucherCode: string;
  brand: string;
  title: string;
  sourceProgramOrCard: string;   // the display label "CardName ending XXXX"
  sourceCardId: string;          // internal ID of selected card
  description: string;
  issueDate: string;
  expiryDate: string;
  hasExpiry: boolean;
  // Rupay periodic tracking
  periodType: string;
  periodKey: string;
  bookingId: string;
  // disabled / auto-filled from card
  emailId: string;
  cardOwner: string;
  cardName: string;
}

function blankForm(defaultBrand = ""): FormState {
  return {
    voucherCode:        "",
    brand:              defaultBrand,
    title:              "",
    sourceProgramOrCard: "",
    sourceCardId:       "",
    description:        "",
    issueDate:          today(),
    expiryDate:         "",
    hasExpiry:          false,
    periodType:         "QUARTERLY",
    periodKey:          currentPeriodKey("QUARTERLY"),
    bookingId:          "",
    emailId:            "",
    cardOwner:          "",
    cardName:           "",
  };
}

// Helper: format a card as "CardName ending XXXX"
function cardLabel(card: Card): string {
  return `${card.bank} | ${card.lastFourDigits}`;
}

export function AddVoucherModal({ open, onClose }: AddVoucherModalProps) {
  const { addVoucher, vouchers } = useVoucherStore();
  const { cards } = useCardStore();

  const [form,   setForm]   = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);
  const [error,  setErrorState] = useState("");
  // Every validation/API error also surfaces as a toast (top-right) — the
  // inline box alone was easy to miss since it sits at the bottom of the form.
  function setError(msg: string) {
    setErrorState(msg);
    if (msg) toast.error(msg);
  }

  // Reset on open — default Brand to whichever voucher was added most recently,
  // since it's common to add several vouchers for the same brand back-to-back.
  useEffect(() => {
    if (open) {
      const lastAdded = vouchers.reduce<typeof vouchers[number] | null>((latest, v) =>
        !latest || new Date(v.dateAdded).getTime() > new Date(latest.dateAdded).getTime() ? v : latest
      , null);
      setForm(blankForm(lastAdded?.brand ?? ""));
      setError("");
    }
  }, [open]);

  // When sourceCardId changes, auto-fill disabled fields from the matching card
  const applyCardFields = useCallback((cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) {
      setForm((f) => ({ ...f, emailId: "", cardOwner: "", cardName: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      sourceCardId:       card.id,
      sourceProgramOrCard: cardLabel(card),
      emailId:            card.email,
      cardOwner:          card.accountOwner,
      cardName:           card.cardName,
    }));
  }, [cards]);

  // Booking IDs are always unique, so instead of suggesting past ones, look
  // up whether this one already has a CVV usage log entry (from Card Vault)
  // and auto-fill brand + source card (which cascades to email/owner/name)
  // from it — leaving only voucher code, frequency, and issue date to fill by hand.
  async function handleBookingIdBlur() {
    const id = form.bookingId.trim();
    if (!id) return;
    try {
      const match = await cvvUsageApi.lookup(id);
      if (!match) return;
      const { bank, last4 } = parseCardLabel(match.cardLabel);
      // Last-4-digits is the reliable identifier here — Card Vault's "Bank"
      // column and Cards Summary's bank field are independent free-text
      // entries (e.g. "Punjab National Bank" vs "PNB"), so requiring an
      // exact bank-name match was silently failing. Lead with last4; only
      // fall back to a fuzzy bank-name match to disambiguate if more than
      // one card shares those last 4 digits.
      const byLast4 = last4 ? cards.filter((c) => c.lastFourDigits === last4) : [];
      const matchedCard = byLast4.length <= 1
        ? byLast4[0]
        : byLast4.find((c) => {
            const cb = c.bank.trim().toLowerCase();
            const b  = bank.toLowerCase();
            return cb === b || cb.includes(b) || b.includes(cb);
          }) ?? byLast4[0];
      if (matchedCard) applyCardFields(matchedCard.id);
      if (match.brand) setForm((f) => ({ ...f, brand: match.brand }));
      toast.success(matchedCard ? "Auto-filled from CVV log" : "Found the brand, but couldn't match the card — pick it manually");
    } catch {
      // Lookup failures shouldn't block manual entry
    }
  }

  function handleIssueDateChange(val: string) {
    setForm((f) => ({ ...f, issueDate: val }));
  }

  function handleExpiryDateChange(val: string) {
    setForm((f) => ({ ...f, expiryDate: val }));
  }

  function toggleHasExpiry() {
    setForm((f) => ({ ...f, hasExpiry: !f.hasExpiry, expiryDate: "" }));
  }

  const upd  = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const updE = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleVoucherCodeBlur() {
    if (!form.voucherCode.trim()) return;
    if (vouchers.some((v) => v.voucherCode.toLowerCase() === form.voucherCode.trim().toLowerCase())) {
      setError("A voucher with this code already exists.");
    } else {
      setError("");
    }
  }

  async function handleSubmit() {
    if (!form.voucherCode.trim()) { setError("Voucher code is required."); return; }
    if (!form.brand.trim())       { setError("Brand is required."); return; }
    if (!form.sourceCardId) {
      setError(cards.length === 0
        ? "Please add a card first, then select it as the source card."
        : "Please select a source card.");
      return;
    }
    if (vouchers.some((v) => v.voucherCode.toLowerCase() === form.voucherCode.trim().toLowerCase())) {
      setError("A voucher with this code already exists."); return;
    }
    setError("");

    setSaving(true);
    try {
      await addVoucher({
        voucherCode:         form.voucherCode.trim().toUpperCase(),
        brand:               form.brand.trim(),
        title:               form.title.trim(),
        sourceProgramOrCard: form.sourceProgramOrCard.trim(),
        description:         form.description.trim(),
        issueDate:           form.issueDate || undefined,
        expiryDate:          form.hasExpiry && form.expiryDate ? form.expiryDate : undefined,
        periodType:          form.periodType,
        periodKey:           form.periodKey,
        bookingId:           form.bookingId.trim(),
        emailId:             form.emailId.trim(),
        cardOwner:           form.cardOwner.trim(),
        cardName:            form.cardName.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  // Disabled input style
  const disabledCls = "input bg-gray-50 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 cursor-not-allowed select-none";

  return (
    <Modal
      open={open}
      onClose={() => { setForm(blankForm()); onClose(); }}
      title="Add voucher"
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={() => { setForm(blankForm()); onClose(); }}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : "Save voucher"}
          </button>
        </>
      }
    >
      <div className="space-y-5">

        {/* ── Booking ID (optional, always unique — no suggestions). If it
             matches a CVV copy logged from Card Vault, brand + source card
             (and email/owner/name that cascade from it) auto-fill below. ── */}
        <div>
          <label className="label">Booking ID <span className="text-gray-400 text-xs font-normal">(optional — auto-fills the rest if it matches a CVV log entry)</span></label>
          <input
            className="input"
            value={form.bookingId}
            onChange={(e) => setForm((f) => ({ ...f, bookingId: e.target.value }))}
            onBlur={handleBookingIdBlur}
            placeholder="e.g. order/booking reference, if you have one already"
            autoComplete="off"
          />
        </div>

        {/* ── Row 1: Brand (mandatory) + Voucher Code (mandatory) ── */}
        <div className="grid grid-cols-2 gap-4">
          <SmartInput
            field="brand"
            value={form.brand}
            onChange={upd("brand")}
            label="Brand"
            placeholder="e.g. Amazon"
            required
          />
          <div>
            <label className="label">
              Voucher code <span className="text-red-500">*</span>
            </label>
            <input
              className="input font-mono uppercase"
              value={form.voucherCode}
              onChange={(e) => setForm((f) => ({ ...f, voucherCode: e.target.value.toUpperCase() }))}
              onBlur={handleVoucherCodeBlur}
              placeholder="e.g. AMZN-HDFC-Q1-2025"
              autoComplete="off"
            />
          </div>
        </div>

        {/* ── Row 2: Title (optional) + Source card ── */}
        <div className="grid grid-cols-2 gap-4">
          <SmartInput
            field="title"
            value={form.title}
            onChange={upd("title")}
            label="Title"
            placeholder="e.g. Amazon Gift Voucher"
            contextField="brand"
            contextValue={form.brand}
          />

          {/* Source card — searchable combobox, only existing cards */}
          <CardSelectInput
            cards={cards}
            selectedId={form.sourceCardId}
            onSelect={(card) => {
              if (card) applyCardFields(card.id);
              else {
                setForm(f => ({
                  ...f,
                  sourceCardId: "",
                  sourceProgramOrCard: "",
                  emailId: "",
                  cardOwner: "",
                  cardName: "",
                }));
              }
            }}
            label="Source card"
            required
          />
        </div>

        {/* ── Row 3: Auto-filled card fields (disabled) ── */}
        {form.sourceCardId && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Card owner <span className="text-xs text-gray-400 font-normal">(from card)</span></label>
                <input className={disabledCls} value={form.cardOwner} readOnly tabIndex={-1} />
              </div>
              <div>
                <label className="label">Card name <span className="text-xs text-gray-400 font-normal">(from card)</span></label>
                <input className={disabledCls} value={form.cardName} readOnly tabIndex={-1} />
              </div>
            </div>
            <div>
              <label className="label">Email ID <span className="text-xs text-gray-400 font-normal">(from card)</span></label>
              <input className={disabledCls} value={form.emailId} readOnly tabIndex={-1} />
            </div>
          </div>
        )}

        {/* ── Row 4: Issue date + Expiry date ── */}
        <div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Issue date</label>
              <input
                className="input"
                type="date"
                value={form.issueDate}
                onChange={(e) => handleIssueDateChange(e.target.value)}
              />
            </div>
            <div>
              <label className="label flex items-center gap-2">
                Expiry date
                <button
                  type="button"
                  onClick={toggleHasExpiry}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors font-normal ${
                    form.hasExpiry
                      ? "border-accent-300 text-accent-600 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20"
                      : "border-gray-300 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {form.hasExpiry ? "✕ Remove expiry" : "+ Add expiry"}
                </button>
              </label>
              {form.hasExpiry ? (
                <input
                  className="input"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => handleExpiryDateChange(e.target.value)}
                />
              ) : (
                <div className="input text-gray-400 dark:text-gray-600 text-sm select-none cursor-default">
                  No expiry date
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Recurring benefit period (Rupay) ── */}
        <PeriodSelector
          periodType={form.periodType}
          periodKey={form.periodKey}
          onChange={(periodType, periodKey) => setForm((f) => ({ ...f, periodType, periodKey }))}
          hideYear
        />

        {/* ── Description ── */}
        <div>
          <label className="label">Description / notes <span className="text-gray-400 text-xs font-normal">(optional)</span></label>
          <textarea
            className="input resize-none"
            rows={2}
            value={form.description}
            onChange={updE("description")}
            placeholder="Optional notes about this voucher…"
            autoComplete="off"
          />
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

      </div>
    </Modal>
  );
}
