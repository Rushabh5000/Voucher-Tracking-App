// Card Vault: local-only Excel read/write helpers (SheetJS).
//
// IMPORTANT: nothing in this file ever imports the app's API client
// (voucherApi/cardApi/axios) or sends data to the backend/DB/internet. The one
// exception is the dev-file bridge at the bottom, which only ever talks to a
// fixed same-origin, localhost-only route the Vite dev/preview server exposes
// (see vite.config.ts) — it doesn't exist in the deployed production build, so
// it can't run against the hosted site. Do not add any other network calls here.
//
// Columns are fully dynamic: whatever header row the opened .xlsx has is
// exactly what's shown/edited/saved. Add or remove a column in Excel and the
// vault picks it up next time it's opened — there is no fixed schema.
import * as XLSX from "xlsx";

export interface VaultRow {
  id: string;                     // client-only key, never written to the sheet
  values: Record<string, string>; // column name -> value
}

export interface ParsedVault {
  columns: string[];
  rows: VaultRow[];
}

// Starting schema for a brand-new vault (no file opened yet). Purely a
// convenience default — add/remove/rename freely, nothing is fixed.
export const DEFAULT_COLUMNS = [
  "Type", "Card Type", "Acc Owner", "Card Name", "Bank",
  "Email", "Number", "Card Number", "Expiry", "CVV",
];

// Column-name heuristic for sensitive fields (masked in the table by default,
// no autocomplete dropdown offered). Matched case-insensitively so it still
// works if the user renames/reorders columns in Excel.
export function isSensitiveColumn(column: string): boolean {
  const n = column.trim().toLowerCase();
  return n === "cvv" || n.includes("card number") || n.includes("cardnumber") || n === "pin" || n.includes("password");
}

export function blankRow(columns: string[]): VaultRow {
  return { id: crypto.randomUUID(), values: Object.fromEntries(columns.map((c) => [c, ""])) };
}

export function parseWorkbook(buf: ArrayBuffer): ParsedVault {
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { columns: [], rows: [] };

  // header:1 gives raw arrays-of-arrays, preserving the exact column order —
  // object mode doesn't guarantee that once headers repeat/reorder oddly.
  const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], { header: 1, defval: "", blankrows: false });
  const headerRow = (raw[0] ?? []).map((h) => String(h ?? "").trim());
  const cols = headerRow
    .map((h, i) => ({ h, i }))
    .filter((x) => x.h);
  const columns = cols.map((c) => c.h);

  const rows: VaultRow[] = raw.slice(1).map((r) => ({
    id: crypto.randomUUID(),
    values: Object.fromEntries(cols.map(({ h, i }) => [h, String((r as unknown[])[i] ?? "").trim()])),
  }));

  return { columns, rows };
}

function buildWorkbook(columns: string[], rows: VaultRow[]): XLSX.WorkBook {
  const data = rows.map((r) => Object.fromEntries(columns.map((c) => [c, r.values[c] ?? ""])));
  const ws = XLSX.utils.json_to_sheet(data, { header: columns });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cards");
  return wb;
}

function workbookToArrayBuffer(columns: string[], rows: VaultRow[]): ArrayBuffer {
  return XLSX.write(buildWorkbook(columns, rows), { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function downloadWorkbook(columns: string[], rows: VaultRow[], fileName: string): void {
  XLSX.writeFile(buildWorkbook(columns, rows), fileName);
}

// File System Access API lets us edit the user's chosen file in place.
// Only Chromium-based browsers support it — Firefox/Safari fall back to
// open-via-input + download-a-new-copy, handled by the caller.
export const supportsFileSystemAccess =
  typeof window !== "undefined" && "showOpenFilePicker" in window;

const XLSX_PICKER_TYPES = [{
  description: "Excel files",
  accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
}];

// These handle types aren't in the default TS DOM lib yet, hence `any`.
export async function pickFileToOpen(): Promise<{ handle: any; file: File } | null> {
  if (!supportsFileSystemAccess) return null;
  try {
    const [handle] = await (window as any).showOpenFilePicker({ types: XLSX_PICKER_TYPES, multiple: false });
    return { handle, file: await handle.getFile() };
  } catch {
    return null; // user cancelled the picker
  }
}

export async function pickFileToSave(suggestedName: string): Promise<any | null> {
  if (!supportsFileSystemAccess) return null;
  try {
    return await (window as any).showSaveFilePicker({ types: XLSX_PICKER_TYPES, suggestedName });
  } catch {
    return null;
  }
}

export async function writeToHandle(handle: any, columns: string[], rows: VaultRow[]): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(workbookToArrayBuffer(columns, rows));
  await writable.close();
}

// ── Local-dev auto-file bridge ──────────────────────────────────────────
// Talks only to the fixed same-origin route the Vite dev/preview server
// exposes when CARD_VAULT_PATH is set (see vite.config.ts). That route reads
// and writes ONE fixed path configured server-side — never a client-supplied
// path — and simply doesn't exist in the static production build, so this is
// a no-op (404/network error) on the deployed Vercel site.
const DEV_VAULT_ROUTE = "/__card-vault-file";

export async function tryLoadDevVaultFile(): Promise<(ParsedVault & { fileName: string }) | null> {
  try {
    const res = await fetch(DEV_VAULT_ROUTE, { method: "GET" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const encodedName = res.headers.get("X-Card-Vault-Filename");
    const fileName = encodedName ? decodeURIComponent(encodedName) : "card-vault.xlsx";
    return { ...parseWorkbook(buf), fileName };
  } catch {
    return null;
  }
}

export async function saveDevVaultFile(columns: string[], rows: VaultRow[]): Promise<boolean> {
  try {
    const res = await fetch(DEV_VAULT_ROUTE, { method: "PUT", body: workbookToArrayBuffer(columns, rows) });
    return res.ok;
  } catch {
    return false;
  }
}

// Opens the CARD_VAULT_PATH file in its OS-default app (Desktop Excel, if
// that's the installed handler for .xlsx). Only meaningful in the auto-loaded
// dev-file mode: the browser file picker (File System Access API) never
// exposes a real filesystem path, so there's nothing to launch in that case.
export async function openDevVaultFileInDesktopApp(): Promise<boolean> {
  try {
    const res = await fetch("/__card-vault-open", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}
