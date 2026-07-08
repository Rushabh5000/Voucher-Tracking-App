import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useCardVaultStore } from "@/store/cardVaultStore";
import { CardVaultRowModal } from "@/components/cardvault/CardVaultRowModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { copyToClipboard } from "@/utils/formatters";
import {
  type VaultRow,
  parseWorkbook, downloadWorkbook, supportsFileSystemAccess,
  pickFileToOpen, pickFileToSave, writeToHandle,
} from "@/utils/cardVaultExcel";

// Card Vault: a fully local, Excel-backed store for full card details
// (including card number + CVV). This page must NEVER import api/client.ts,
// any Zustand store backed by the backend, or otherwise make a network call —
// see cardVaultExcel.ts and cardVaultStore.ts for the enforced boundary.

function CopyCell({ value, onCopy, mono }: { value: string; onCopy: () => void; mono?: boolean }) {
  if (!value) return <span className="text-gray-300 dark:text-gray-600">—</span>;
  return (
    <button
      type="button"
      onClick={onCopy}
      title="Click to copy"
      className={`text-left hover:text-accent-600 dark:hover:text-accent-400 transition-colors whitespace-nowrap ${mono ? "font-mono" : ""}`}
    >
      {value} <span className="opacity-40 text-xs">⧉</span>
    </button>
  );
}

export function CardVaultPage() {
  const {
    rows, fileName, fileHandle, dirty,
    loadRows, addRow, updateRow, deleteRow, setHandle, markSaved, closeVault,
  } = useCardVaultStore();

  const [modalOpen, setModalOpen]     = useState(false);
  const [editingRow, setEditingRow]   = useState<VaultRow | null>(null);
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [revealed, setRevealed]       = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Warn before an accidental tab close/refresh discards unsaved edits —
  // there is no auto-save and no DB backup for this data.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function handleOpenFile() {
    if (supportsFileSystemAccess) {
      const picked = await pickFileToOpen();
      if (!picked) return;
      const buf = await picked.file.arrayBuffer();
      loadRows(parseWorkbook(buf), picked.file.name, picked.handle);
      toast.success(`Loaded from ${picked.file.name}`);
    } else {
      fileInputRef.current?.click();
    }
  }

  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const buf = await file.arrayBuffer();
    loadRows(parseWorkbook(buf), file.name, null);
    toast.success(`Loaded from ${file.name}`);
  }

  async function handleSave() {
    if (rows.length === 0) { toast.error("Nothing to save yet"); return; }
    try {
      if (fileHandle) {
        await writeToHandle(fileHandle, rows);
        markSaved();
        toast.success(`Saved to ${fileName}`);
      } else if (supportsFileSystemAccess) {
        const handle = await pickFileToSave(fileName || "card-vault.xlsx");
        if (!handle) return;
        await writeToHandle(handle, rows);
        setHandle(handle, handle.name ?? fileName ?? "card-vault.xlsx");
        markSaved();
        toast.success("Saved");
      } else {
        downloadWorkbook(rows, fileName || "card-vault.xlsx");
        markSaved();
        toast.success("Downloaded — replace your original file with this one");
      }
    } catch {
      toast.error("Couldn't save the file");
    }
  }

  async function handleSaveAs() {
    if (!supportsFileSystemAccess) return;
    const handle = await pickFileToSave(fileName || "card-vault.xlsx");
    if (!handle) return;
    try {
      await writeToHandle(handle, rows);
      setHandle(handle, handle.name);
      markSaved();
      toast.success("Saved");
    } catch {
      toast.error("Couldn't save the file");
    }
  }

  function handleModalSave(data: Omit<VaultRow, "id">) {
    if (editingRow) updateRow(editingRow.id, data);
    else addRow({ id: crypto.randomUUID(), ...data });
    setEditingRow(null);
  }

  async function handleCopy(label: string, value: string) {
    if (!value) return;
    const ok = await copyToClipboard(value);
    toast[ok ? "success" : "error"](ok ? `${label} copied` : "Couldn't copy");
  }

  function toggleReveal(id: string) {
    setRevealed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function requestClose() {
    if (dirty) setCloseConfirm(true);
    else closeVault();
  }

  const saveLabel = fileHandle ? "Save" : supportsFileSystemAccess ? "Save to file…" : "Download file";

  return (
    <div className="space-y-4">
      {/* Privacy banner */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800">
        <span className="text-emerald-600 dark:text-emerald-400 text-lg flex-shrink-0">🔒</span>
        <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
          <strong>Offline only.</strong> This vault never sends data to any server or database —
          everything lives only in this browser tab and in the Excel file you open/save on your own
          computer. Refreshing or closing the tab clears it from memory; nothing is kept unless you
          explicitly save it to a file.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary text-sm" onClick={handleOpenFile}>📂 Open Excel file…</button>
        <button className="btn-secondary text-sm" onClick={() => { setEditingRow(null); setModalOpen(true); }}>+ Add card</button>
        <button className="btn-primary text-sm" onClick={handleSave} disabled={rows.length === 0}>
          💾 {saveLabel}{dirty ? " •" : ""}
        </button>
        {supportsFileSystemAccess && fileHandle && (
          <button className="btn-secondary text-sm" onClick={handleSaveAs}>Save as…</button>
        )}
        {(rows.length > 0 || fileName) && (
          <button className="text-xs text-gray-400 hover:text-red-500 ml-auto" onClick={requestClose}>✕ Close vault</button>
        )}
        <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileInputChange} />
      </div>

      {fileName && (
        <div className="text-xs text-gray-400">
          File: <span className="font-mono">{fileName}</span>
          {dirty && <span className="text-amber-500 ml-2">● Unsaved changes</span>}
          {!supportsFileSystemAccess && (
            <span className="ml-2">— this browser can't edit the file in place; Save downloads a new copy.</span>
          )}
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🗄️</div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">No card vault open</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
            Open an existing Excel file, or add your first card to start a new one.
          </p>
          <div className="flex justify-center gap-2">
            <button className="btn-secondary text-sm" onClick={handleOpenFile}>📂 Open Excel file…</button>
            <button className="btn-primary text-sm" onClick={() => { setEditingRow(null); setModalOpen(true); }}>+ Add card</button>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-3 py-2 font-medium">SrNo</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Card Type</th>
                  <th className="px-3 py-2 font-medium">Acc Owner</th>
                  <th className="px-3 py-2 font-medium">Card Name</th>
                  <th className="px-3 py-2 font-medium">Bank</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                  <th className="px-3 py-2 font-medium">Number</th>
                  <th className="px-3 py-2 font-medium">Card Number</th>
                  <th className="px-3 py-2 font-medium">Expiry</th>
                  <th className="px-3 py-2 font-medium">CVV</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isRevealed = revealed.has(r.id);
                  const maskedCardNumber = r.cardNumber
                    ? (isRevealed ? r.cardNumber : "•••• •••• •••• " + r.cardNumber.slice(-4))
                    : "";
                  const maskedCvv = r.cvv ? (isRevealed ? r.cvv : "•".repeat(r.cvv.length)) : "";
                  return (
                    <tr key={r.id} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                      <td className="px-3 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.type || "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.cardType || "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.accOwner || "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.cardName || "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{r.bank || "—"}</td>
                      <td className="px-3 py-2.5">
                        <CopyCell value={r.email} onCopy={() => handleCopy("Email", r.email)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <CopyCell value={r.number} onCopy={() => handleCopy("Number", r.number)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <CopyCell value={maskedCardNumber} mono onCopy={() => handleCopy("Card number", r.cardNumber)} />
                          {r.cardNumber && (
                            <button
                              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                              onClick={() => toggleReveal(r.id)}
                              title={isRevealed ? "Hide" : "Reveal"}
                            >
                              {isRevealed ? "🙈" : "👁"}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <CopyCell value={r.expiry} mono onCopy={() => handleCopy("Expiry", r.expiry)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <CopyCell value={maskedCvv} mono onCopy={() => handleCopy("CVV", r.cvv)} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button className="btn-secondary text-xs px-2 py-1 mr-1" onClick={() => { setEditingRow(r); setModalOpen(true); }}>Edit</button>
                        <button className="btn-danger text-xs px-2 py-1" onClick={() => setDeleteId(r.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CardVaultRowModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingRow(null); }}
        onSave={handleModalSave}
        existing={editingRow}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Delete card?"
        message="Remove this card from the vault. This won't affect the file on disk until you save."
        confirmLabel="Yes, delete"
        onConfirm={() => { if (deleteId) deleteRow(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />

      <ConfirmDialog
        open={closeConfirm}
        title="Close vault without saving?"
        message="You have unsaved changes. Closing will clear them from memory — they were never saved to the Excel file."
        confirmLabel="Close without saving"
        onConfirm={() => { closeVault(); setCloseConfirm(false); }}
        onCancel={() => setCloseConfirm(false)}
      />
    </div>
  );
}
