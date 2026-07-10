import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { isSensitiveColumn, type VaultRow } from "@/utils/cardVaultExcel";

interface CardVaultRowModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
  columns: string[];
  existing?: VaultRow | null;
}

// Renders one plain input per column — never SmartInput, which calls the
// backend autocomplete API. This vault must make zero network requests.
// Fields are fully dynamic: whatever columns the vault currently has (driven
// by the opened Excel file) is exactly what's editable here.
export function CardVaultRowModal({ open, onClose, onSave, columns, existing }: CardVaultRowModalProps) {
  const [form, setForm]   = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(Object.fromEntries(columns.map((c) => [c, existing?.values[c] ?? ""])));
      setError("");
    }
  }, [open, existing, columns]);

  const upd = (col: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [col]: e.target.value }));

  function handleSubmit() {
    if (columns.length > 0 && columns.every((c) => !form[c]?.trim())) {
      setError("Enter at least one field.");
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
        {columns.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This vault has no columns yet — open an Excel file with a header row, or add columns first.
          </p>
        )}
        <div className="grid grid-cols-2 gap-4">
          {columns.map((col) => {
            const sensitive = isSensitiveColumn(col);
            return (
              <div key={col}>
                <label className="label">{col}</label>
                <input
                  className={`input ${sensitive ? "font-mono" : ""}`}
                  value={form[col] ?? ""}
                  onChange={upd(col)}
                  placeholder={col}
                  autoComplete="off"
                  inputMode={sensitive ? "numeric" : undefined}
                />
              </div>
            );
          })}
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
