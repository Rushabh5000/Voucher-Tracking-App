import { useState, useEffect } from "react";
import { autocompleteApi } from "@/api/client";
import { useVoucherStore } from "@/store/voucherStore";
import { useCardStore } from "@/store/cardStore";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import toast from "react-hot-toast";

const FIELD_LABELS: Record<string, string> = {
  brand:               "Brands",
  sourceProgramOrCard: "Source Cards / Programs",
  voucherType:         "Voucher Types",
  bank:                "Banks",
  cardType:            "Card Types",
  accountOwner:        "Account Owners",
  email:               "Emails",
  mobileNumber:        "Mobile Numbers",
};

const FIELD_ORDER = [
  "brand", "sourceProgramOrCard", "voucherType",
  "bank", "cardType", "accountOwner", "email", "mobileNumber",
];

export function FieldValuesManager() {
  const [fields, setFields]               = useState<Record<string, string[]>>({});
  const [loading, setLoading]             = useState(true);
  const [editKey, setEditKey]             = useState<string | null>(null);
  const [editVal, setEditVal]             = useState("");
  const [saving, setSaving]               = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ field: string; value: string } | null>(null);

  const loadVouchers = useVoucherStore(s => s.load);
  const loadCards    = useCardStore(s => s.load);

  async function fetchAll() {
    setLoading(true);
    try {
      const data = await autocompleteApi.getAll();
      setFields(data);
    } catch {
      toast.error("Failed to load field values");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  async function handleSave(field: string, oldValue: string) {
    const trimmed = editVal.trim();
    if (!trimmed) { toast.error("Value cannot be empty"); return; }
    if (trimmed === oldValue) { setEditKey(null); return; }
    setSaving(true);
    try {
      await autocompleteApi.rename(field, oldValue, trimmed);
      await fetchAll();
      await Promise.all([loadVouchers(), loadCards()]);
      toast.success("Renamed across all records");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to rename");
    } finally {
      setSaving(false);
      setEditKey(null);
    }
  }

  async function handleDelete(field: string, value: string) {
    try {
      await autocompleteApi.remove(field, value);
      setFields(prev => ({
        ...prev,
        [field]: prev[field].filter(v => v !== value),
      }));
      toast.success("Entry removed");
    } catch {
      toast.error("Failed to remove entry");
    } finally {
      setConfirmDelete(null);
    }
  }

  const ordered     = FIELD_ORDER.filter(f => (fields[f]?.length ?? 0) > 0);
  const extra       = Object.keys(fields).filter(f => !FIELD_ORDER.includes(f) && (fields[f]?.length ?? 0) > 0);
  const allFields   = [...ordered, ...extra];

  return (
    <>
      <div className="card p-5">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Field Values</h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          Rename any value to update it everywhere — all matching vouchers and cards are updated automatically.
          Removing only clears it from autocomplete suggestions; existing records are not affected.
        </p>

        {loading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : allFields.length === 0 ? (
          <p className="text-sm text-gray-400">
            No values yet. They are added automatically when you create vouchers and cards.
          </p>
        ) : (
          <div className="space-y-5">
            {allFields.map(field => (
              <div key={field}>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1.5">
                  {FIELD_LABELS[field] ?? field}
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
                  {fields[field].map(value => {
                    const key       = `${field}::${value}`;
                    const isEditing = editKey === key;
                    return (
                      <div key={value} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 min-h-[40px]">
                        {isEditing ? (
                          <>
                            <input
                              className="input flex-1 h-8 text-sm py-0"
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === "Enter")  handleSave(field, value);
                                if (e.key === "Escape") setEditKey(null);
                              }}
                              autoComplete="off"
                              autoFocus
                            />
                            <button
                              className="btn-primary text-xs px-3 py-1 h-8"
                              onClick={() => handleSave(field, value)}
                              disabled={saving}
                            >
                              {saving ? "…" : "Save"}
                            </button>
                            <button
                              className="btn-secondary text-xs px-3 py-1 h-8"
                              onClick={() => setEditKey(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                              {value}
                            </span>
                            <button
                              className="p-1 text-gray-400 hover:text-accent-500 dark:hover:text-accent-400 transition-colors rounded"
                              title="Rename"
                              onClick={() => { setEditKey(key); setEditVal(value); }}
                            >
                              ✎
                            </button>
                            <button
                              className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded"
                              title="Remove from suggestions"
                              onClick={() => setConfirmDelete({ field, value })}
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Remove suggestion"
        message={`Remove "${confirmDelete?.value}" from ${FIELD_LABELS[confirmDelete?.field ?? ""] ?? confirmDelete?.field} suggestions? Existing vouchers and cards with this value are not affected.`}
        confirmLabel="Remove"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.field, confirmDelete.value)}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
