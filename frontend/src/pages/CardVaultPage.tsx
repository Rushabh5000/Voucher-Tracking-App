import { useState, useEffect, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import { useCardVaultStore } from "@/store/cardVaultStore";
import { CardVaultRowModal } from "@/components/cardvault/CardVaultRowModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { copyToClipboard } from "@/utils/formatters";
import {
  DEFAULT_COLUMNS, isSensitiveColumn, isCopyableColumn,
  parseWorkbook, downloadWorkbook, supportsFileSystemAccess,
  pickFileToOpen, pickFileToSave, writeToHandle,
  tryLoadDevVaultFile, saveDevVaultFile, openDevVaultFileInDesktopApp,
} from "@/utils/cardVaultExcel";

// Card Vault: a fully local, Excel-backed store for full card details
// (including card number + CVV). This page must NEVER import api/client.ts,
// any Zustand store backed by the backend, or otherwise make a network call —
// see cardVaultExcel.ts and cardVaultStore.ts for the enforced boundary.
//
// Columns are fully dynamic — driven entirely by the opened file's header
// row (store.columns). Add/remove a column in Excel and reopen: the table,
// filters, and Add/Edit form all follow automatically. "sensitive" columns
// (card number/cvv/pin/password, matched by name) get masking + no
// autocomplete dropdown; everything else gets a copy button + local dropdown.

const filterInputCls =
  "w-full min-w-[70px] text-xs px-1.5 py-1 rounded border border-gray-200 dark:border-gray-700 " +
  "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600 " +
  "focus:ring-1 focus:ring-accent-500 focus:outline-none";

function FilterInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      className={filterInputCls}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Filter ${label}…`}
      autoComplete="off"
    />
  );
}

// Filter box with a local dropdown of distinct values already present in the
// loaded rows for this column — typed and click-to-pick both narrow the filter.
function ColumnFilterInput({
  value, onChange, label, options,
}: { value: string; onChange: (v: string) => void; label: string; options: string[] }) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = value.trim()
    ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase()))
    : options;

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) { if (e.key === "ArrowDown") setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && highlighted >= 0 && filtered[highlighted]) { e.preventDefault(); select(filtered[highlighted]); }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        className={filterInputCls}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={`Filter ${label}…`}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        // text-left + list-none/m-0/p-1 are required here, not decorative: this
        // dropdown sits inside a <th>, whose browser-default text-align:center
        // otherwise inherits straight through (position:absolute doesn't break
        // CSS inheritance), centering every option and making it look broken.
        <ul className="absolute z-20 mt-1 w-40 max-h-48 overflow-y-auto list-none m-0 p-1 text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-xs">
          {filtered.map((o, i) => (
            <li
              key={o}
              onMouseDown={(e) => { e.preventDefault(); select(o); }}
              title={o}
              className={`text-left px-2 py-1.5 rounded cursor-pointer truncate ${
                i === highlighted ? "bg-accent-100 dark:bg-accent-500/30" : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
    columns, rows, fileName, fileHandle, devFileActive, dirty,
    loadRows, ensureColumns, addRow, setHandle, markSaved, closeVault,
  } = useCardVaultStore();

  const [modalOpen, setModalOpen]     = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [revealed, setRevealed]       = useState<Set<string>>(new Set());
  const [autoLoadChecked, setAutoLoadChecked] = useState(false);
  const autoLoadStarted = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const hasFilters = Object.values(filters).some((v) => v.trim());

  // Distinct, non-empty values per non-sensitive column, built purely from
  // rows already in memory — never fetched, never from the backend.
  const columnOptions = useMemo(() => {
    const opts: Record<string, string[]> = {};
    for (const col of columns) {
      if (isSensitiveColumn(col)) continue;
      const values = rows.map((r) => (r.values[col] ?? "").trim()).filter(Boolean);
      opts[col] = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
    }
    return opts;
  }, [rows, columns]);

  const filteredRows = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v.trim());
    if (active.length === 0) return rows.map((r, i) => ({ row: r, pos: i + 1 }));
    return rows
      .map((r, i) => ({ row: r, pos: i + 1 }))
      .filter(({ row }) =>
        active.every(([col, raw]) => (row.values[col] ?? "").toLowerCase().includes(raw.trim().toLowerCase()))
      );
  }, [rows, filters]);

  function setFilter(col: string, value: string) {
    setFilters((f) => ({ ...f, [col]: value }));
  }

  // Warn before an accidental tab close/refresh discards unsaved edits —
  // there is no auto-save and no DB backup for this data.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // On first mount with nothing open yet, try the local-dev CARD_VAULT_PATH
  // bridge (see vite.config.ts). No-ops instantly if unset or not running the
  // dev/preview server — the manual screen below is what shows in that case.
  useEffect(() => {
    if (autoLoadStarted.current || fileName) return;
    autoLoadStarted.current = true;
    tryLoadDevVaultFile().then((result) => {
      if (result) {
        loadRows(result.columns, result.rows, result.fileName, null, true);
        toast.success(`Auto-loaded ${result.fileName} from CARD_VAULT_PATH`);
      }
      setAutoLoadChecked(true);
    });
  }, [fileName, loadRows]);

  async function handleOpenFile() {
    if (supportsFileSystemAccess) {
      const picked = await pickFileToOpen();
      if (!picked) return;
      const buf = await picked.file.arrayBuffer();
      const parsed = parseWorkbook(buf);
      loadRows(parsed.columns, parsed.rows, picked.file.name, picked.handle);
      toast.success(`Loaded from ${picked.file.name} (${parsed.columns.length} column${parsed.columns.length !== 1 ? "s" : ""})`);
    } else {
      fileInputRef.current?.click();
    }
  }

  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const buf = await file.arrayBuffer();
    const parsed = parseWorkbook(buf);
    loadRows(parsed.columns, parsed.rows, file.name, null);
    toast.success(`Loaded from ${file.name} — note its folder now; the app can't show it later`);
  }

  async function handleSave() {
    if (rows.length === 0) { toast.error("Nothing to save yet"); return; }
    try {
      if (devFileActive) {
        const ok = await saveDevVaultFile(columns, rows);
        if (ok) { markSaved(); toast.success(`Saved directly to ${fileName} (CARD_VAULT_PATH)`); }
        else toast.error("Couldn't save to CARD_VAULT_PATH");
        return;
      }
      if (fileHandle) {
        await writeToHandle(fileHandle, columns, rows);
        markSaved();
        toast.success(`Saved to ${fileName} (same folder you opened it from)`);
      } else if (supportsFileSystemAccess) {
        const handle = await pickFileToSave(fileName || "card-vault.xlsx");
        if (!handle) return;
        await writeToHandle(handle, columns, rows);
        setHandle(handle, handle.name ?? fileName ?? "card-vault.xlsx");
        markSaved();
        toast.success("Saved to the folder you just chose");
      } else {
        downloadWorkbook(columns, rows, fileName || "card-vault.xlsx");
        markSaved();
        toast.success("Downloaded to your browser's Downloads folder — move/replace your original file with this one");
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
      await writeToHandle(handle, columns, rows);
      setHandle(handle, handle.name);
      markSaved();
      toast.success("Saved to the folder you just chose");
    } catch {
      toast.error("Couldn't save the file");
    }
  }

  function openAddModal() {
    if (columns.length === 0) ensureColumns(DEFAULT_COLUMNS);
    setModalOpen(true);
  }

  function handleModalSave(values: Record<string, string>) {
    addRow({ id: crypto.randomUUID(), values });
  }

  async function handleOpenInExcel() {
    const ok = await openDevVaultFileInDesktopApp();
    if (ok) toast.success("Opening in your desktop Excel app…");
    else toast.error("Couldn't open the file — is it still at CARD_VAULT_PATH?");
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

  const saveLabel = devFileActive
    ? "Save"
    : fileHandle ? "Save" : supportsFileSystemAccess ? "Save to file…" : "Download file";

  return (
    <div className="space-y-4">
      {/* Privacy banner */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800">
        <span className="text-emerald-600 dark:text-emerald-400 text-lg flex-shrink-0">🔒</span>
        <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
          <strong>Offline only.</strong> This vault never sends data to any server or database —
          everything lives only in this browser tab and in the Excel file you open/save on your own
          computer. Refreshing or closing the tab clears it from memory; nothing is kept unless you
          explicitly save it to a file. Columns exactly mirror the opened file's header row — add or
          remove a column in Excel and reopen to see it reflected here.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-secondary text-sm" onClick={handleOpenFile}>📂 Open Excel file…</button>
        <button className="btn-secondary text-sm" onClick={openAddModal}>+ Add card</button>
        <button className="btn-primary text-sm" onClick={handleSave} disabled={rows.length === 0}>
          💾 {saveLabel}{dirty ? " •" : ""}
        </button>
        {!devFileActive && supportsFileSystemAccess && fileHandle && (
          <button className="btn-secondary text-sm" onClick={handleSaveAs}>Save as…</button>
        )}
        {devFileActive && (
          <button className="btn-secondary text-sm" onClick={handleOpenInExcel}>📊 Open in Excel</button>
        )}
        {(rows.length > 0 || fileName) && (
          <button className="text-xs text-gray-400 hover:text-red-500 ml-auto" onClick={requestClose}>✕ Close vault</button>
        )}
        <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileInputChange} />
      </div>

      {/* Table */}
      {!autoLoadChecked ? (
        <div className="card p-10 text-center text-sm text-gray-400">Checking for a configured vault file…</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-4xl mb-3">🗄️</div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">No card vault open</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
            Open an existing Excel file, or add your first card to start a new one.
          </p>
          <div className="flex justify-center gap-2">
            <button className="btn-secondary text-sm" onClick={handleOpenFile}>📂 Open Excel file…</button>
            <button className="btn-primary text-sm" onClick={openAddModal}>+ Add card</button>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {hasFilters && (
            <div className="flex items-center justify-between px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <span>{filteredRows.length} of {rows.length} card{rows.length !== 1 ? "s" : ""} match</span>
              <button className="text-accent-600 dark:text-accent-400 underline" onClick={() => setFilters({})}>Clear filters</button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-3 py-2 font-medium">#</th>
                  {columns.map((col) => (
                    <th key={col} className="px-3 py-2 font-medium whitespace-nowrap">{col}</th>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-2 py-1.5" />
                  {columns.map((col) => {
                    const sensitive = isSensitiveColumn(col);
                    return (
                      <th key={col} className="px-2 py-1.5">
                        {sensitive ? (
                          <FilterInput value={filters[col] ?? ""} onChange={(v) => setFilter(col, v)} label={col} />
                        ) : (
                          <ColumnFilterInput
                            value={filters[col] ?? ""}
                            onChange={(v) => setFilter(col, v)}
                            label={col}
                            options={columnOptions[col] ?? []}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-sm text-gray-400">
                      No cards match your filters.
                    </td>
                  </tr>
                ) : filteredRows.map(({ row: r, pos }) => {
                  const isRevealed = revealed.has(r.id);
                  const isHighlighted = r.id === highlightedId;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setHighlightedId(r.id)}
                      className={`border-b border-gray-50 dark:border-gray-800/60 last:border-0 cursor-pointer transition-colors ${
                        isHighlighted ? "bg-accent-100 dark:bg-accent-500/30" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      }`}
                    >
                      <td className={`px-3 py-2.5 text-gray-400 ${isHighlighted ? "border-l-4 border-accent-500 dark:border-accent-400" : ""}`}>{pos}</td>
                      {columns.map((col) => {
                        const raw = r.values[col] ?? "";
                        if (isSensitiveColumn(col)) {
                          const masked = raw
                            ? (isRevealed
                                ? raw
                                : col.toLowerCase().includes("card") ? "•••• •••• •••• " + raw.slice(-4) : "•".repeat(raw.length))
                            : "";
                          return (
                            <td key={col} className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <CopyCell value={masked} mono onCopy={() => handleCopy(col, raw)} />
                                {raw && (
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
                          );
                        }
                        return (
                          <td key={col} className="px-3 py-2.5 whitespace-nowrap">
                            {isCopyableColumn(col) ? (
                              <CopyCell value={raw} onCopy={() => handleCopy(col, raw)} />
                            ) : (
                              raw || <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                        );
                      })}
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
        onClose={() => setModalOpen(false)}
        onSave={handleModalSave}
        columns={columns}
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
