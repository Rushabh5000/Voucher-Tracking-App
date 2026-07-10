import { create } from "zustand";
import type { VaultRow } from "@/utils/cardVaultExcel";

// Deliberately NOT using zustand's `persist` middleware — this store must never
// touch localStorage, sessionStorage, or the backend. Data lives only in memory
// for the life of this browser tab and is written to disk solely via an explicit
// user "Save" action (see cardVaultExcel.ts).
interface CardVaultState {
  columns: string[]; // fully dynamic — exactly mirrors the opened file's header row
  rows: VaultRow[];
  fileName: string | null;
  fileHandle: any | null;
  // True when rows came from the local-dev CARD_VAULT_PATH bridge — Save then
  // writes straight back to that same path instead of using a file picker.
  devFileActive: boolean;
  dirty: boolean;
  loadRows: (columns: string[], rows: VaultRow[], fileName: string, handle: any | null, devFileActive?: boolean) => void;
  ensureColumns: (columns: string[]) => void; // seed columns for a brand-new vault with no file open
  addRow: (row: VaultRow) => void;
  updateRow: (id: string, patch: Record<string, string>) => void;
  deleteRow: (id: string) => void;
  setHandle: (handle: any | null, fileName: string | null) => void;
  markSaved: () => void;
  closeVault: () => void;
}

export const useCardVaultStore = create<CardVaultState>()((set) => ({
  columns: [],
  rows: [],
  fileName: null,
  fileHandle: null,
  devFileActive: false,
  dirty: false,

  loadRows: (columns, rows, fileName, handle, devFileActive = false) =>
    set({ columns, rows, fileName, fileHandle: handle, devFileActive, dirty: false }),

  ensureColumns: (columns) => set((s) => (s.columns.length === 0 ? { columns } : {})),

  addRow: (row) => set((s) => ({ rows: [...s.rows, row], dirty: true })),

  updateRow: (id, patch) => set((s) => ({
    rows: s.rows.map((r) => (r.id === id ? { ...r, values: { ...r.values, ...patch } } : r)),
    dirty: true,
  })),

  deleteRow: (id) => set((s) => ({ rows: s.rows.filter((r) => r.id !== id), dirty: true })),

  setHandle: (handle, fileName) => set({ fileHandle: handle, fileName, devFileActive: false }),

  markSaved: () => set({ dirty: false }),

  closeVault: () => set({ columns: [], rows: [], fileName: null, fileHandle: null, devFileActive: false, dirty: false }),
}));
