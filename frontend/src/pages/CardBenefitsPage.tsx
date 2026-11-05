import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useCardStore } from "@/store/cardStore";
import { useCardBenefitsStore } from "@/store/cardBenefitsStore";
import { SmartInput } from "@/components/ui/SmartInput";
import { PERIOD_TYPE_LABEL } from "@/utils/periods";
import type { CardBenefit } from "@/api/client";

interface ProgramBenefitsProps {
  bank: string;
  cardType: string;
  benefits: CardBenefit[];
  onAdd: (brand: string, periodType: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

function ProgramBenefits({ bank, cardType, benefits, onAdd, onRemove }: ProgramBenefitsProps) {
  const [brand, setBrand] = useState("");
  const [periodType, setPeriodType] = useState("QUARTERLY");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!brand.trim()) return;
    setSaving(true);
    try {
      await onAdd(brand.trim(), periodType);
      setBrand("");
      toast.success("Benefit added");
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? err?.message ?? "Failed to add benefit");
    }
    setSaving(false);
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">💳</span>
        <span className="font-semibold text-gray-900 dark:text-gray-100">{bank}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300">
          {cardType}
        </span>
        {benefits.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">{benefits.length} benefit{benefits.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {benefits.length > 0 && (
        <div className="space-y-1.5">
          {benefits.map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <span className="font-medium text-gray-800 dark:text-gray-200">{b.brand}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">{PERIOD_TYPE_LABEL[b.periodType] ?? b.periodType}</span>
              <button
                type="button"
                onClick={() =>
                  onRemove(b.id)
                    .then(() => toast.success("Benefit removed"))
                    .catch((err: any) => toast.error(err?.response?.data?.error ?? "Failed to remove"))
                }
                className="ml-auto text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300 px-1"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {benefits.length === 0 && (
        <p className="text-xs text-gray-400 italic">No benefits defined yet.</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <SmartInput
          field="brand"
          className="flex-1"
          placeholder="Brand (e.g. Amazon)"
          value={brand}
          onChange={setBrand}
        />
        <select
          className="input text-sm py-1.5 w-auto"
          value={periodType}
          onChange={(e) => setPeriodType(e.target.value)}
        >
          <option value="QUARTERLY">Quarterly</option>
          <option value="HALF_YEARLY">Half-yearly</option>
          <option value="YEARLY">Yearly</option>
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={saving || !brand.trim()}
          className="btn-primary text-sm py-1.5 px-4 whitespace-nowrap"
        >
          {saving ? "…" : "+ Add"}
        </button>
      </div>
    </div>
  );
}

export function CardBenefitsPage() {
  const { cards } = useCardStore();
  const { benefits, addBenefit, removeBenefit } = useCardBenefitsStore();

  const programs = useMemo(() => {
    const map = new Map<string, { bank: string; cardType: string }>();
    for (const c of cards) {
      const key = `${c.bank}:::${c.cardType}`;
      if (!map.has(key)) map.set(key, { bank: c.bank, cardType: c.cardType });
    }
    // Also include programs from existing benefits that may no longer have cards
    for (const b of benefits) {
      const key = `${b.bank}:::${b.cardType}`;
      if (!map.has(key)) map.set(key, { bank: b.bank, cardType: b.cardType });
    }
    return [...map.values()].sort((a, b) =>
      `${a.bank} ${a.cardType}`.localeCompare(`${b.bank} ${b.cardType}`)
    );
  }, [cards, benefits]);

  if (programs.length === 0) {
    return (
      <div className="card p-8 text-center max-w-xl mx-auto mt-6">
        <div className="text-4xl mb-3">💳</div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">No card programs yet</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Add cards in <strong>Cards Summary</strong> first. Card programs are grouped by bank and card type.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Define which brands and periods each card program offers. <strong>Card Stats</strong> will
          show these as columns and mark them pending even before the first voucher is claimed.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {programs.map(({ bank, cardType }) => (
          <ProgramBenefits
            key={`${bank}:::${cardType}`}
            bank={bank}
            cardType={cardType}
            benefits={benefits.filter((b) => b.bank === bank && b.cardType === cardType)}
            onAdd={(brand, pt) => addBenefit(bank, cardType, brand, pt)}
            onRemove={removeBenefit}
          />
        ))}
      </div>
    </div>
  );
}
