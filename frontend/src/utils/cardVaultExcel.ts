// Card Vault: local-only Excel read/write helpers (SheetJS).
//
// IMPORTANT: nothing in this file ever calls fetch/axios or touches the backend.
// All parsing/writing happens entirely in the browser, against a file the user
// explicitly opens/saves on their own machine. Do not add any network calls here.
import * as XLSX from "xlsx";

export interface VaultRow {
  id: string; // client-only key, never written to the sheet
  type: string;
  cardType: string;
  accOwner: string;
  cardName: string;
  bank: string;
  email: string;
  number: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

type FieldKey = Exclude<keyof VaultRow, "id">;

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  type:       ["Type"],
  cardType:   ["Card Type", "CardType"],
  accOwner:   ["Acc Owner", "Account Owner", "AccOwner"],
  cardName:   ["Card Name", "CardName"],
  bank:       ["Bank"],
  email:      ["Email"],
  number:     ["Number", "Mobile", "Mobile Number"],
  cardNumber: ["Card Number", "CardNumber"],
  expiry:     ["Expiry", "Expiry Date"],
  cvv:        ["CVV"],
};

function pick(row: Record<string, unknown>, aliases: string[]): string {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const key = keys.find((k) => k.trim().toLowerCase() === alias.toLowerCase());
    if (key !== undefined && row[key] != null) return String(row[key]).trim();
  }
  return "";
}

export function parseWorkbook(buf: ArrayBuffer): VaultRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" });
  return json.map((row) => ({
    id: crypto.randomUUID(),
    type:       pick(row, HEADER_ALIASES.type),
    cardType:   pick(row, HEADER_ALIASES.cardType),
    accOwner:   pick(row, HEADER_ALIASES.accOwner),
    cardName:   pick(row, HEADER_ALIASES.cardName),
    bank:       pick(row, HEADER_ALIASES.bank),
    email:      pick(row, HEADER_ALIASES.email),
    number:     pick(row, HEADER_ALIASES.number),
    cardNumber: pick(row, HEADER_ALIASES.cardNumber),
    expiry:     pick(row, HEADER_ALIASES.expiry),
    cvv:        pick(row, HEADER_ALIASES.cvv),
  }));
}

function buildWorkbook(rows: VaultRow[]): XLSX.WorkBook {
  const data = rows.map((r, i) => ({
    SrNo: i + 1,
    Type: r.type,
    "Card Type": r.cardType,
    "Acc Owner": r.accOwner,
    "Card Name": r.cardName,
    Bank: r.bank,
    Email: r.email,
    Number: r.number,
    "Card Number": r.cardNumber,
    Expiry: r.expiry,
    CVV: r.cvv,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cards");
  return wb;
}

function workbookToArrayBuffer(rows: VaultRow[]): ArrayBuffer {
  return XLSX.write(buildWorkbook(rows), { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function downloadWorkbook(rows: VaultRow[], fileName: string): void {
  XLSX.writeFile(buildWorkbook(rows), fileName);
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

export async function writeToHandle(handle: any, rows: VaultRow[]): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(workbookToArrayBuffer(rows));
  await writable.close();
}
