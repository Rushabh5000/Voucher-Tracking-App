import { create } from "zustand";
import type { VaultRow } from "@/utils/cardVaultExcel";

// Deliberately NOT using zustand's `persist` middleware — this store must never
// touch localStorage, sessionStorage, or the backend. Data lives only in memory
// for the life of this browser tab and is written to disk solely via an explicit
// user "Save" action (see cardVaultExcel.ts).
interface CardVaultState {
  rows: VaultRow[];
  fileName: string | null;
  fileHandle: any | null;
  dirty: boolean;
  loadRows: (rows: VaultRow[], fileName: string, handle: any | null) => void;
  addRow: (row: VaultRow) => void;
  updateRow: (id: string, patch: Partial<VaultRow>) => void;
  deleteRow: (id: string) => void;
  setHandle: (handle: any | null, fileName: string | null) => void;
  markSaved: () => void;
  closeVault: () => void;
}

export const useCardVaultStore = create<CardVaultState>()((set) => ({
  rows: [],
  fileName: null,
  fileHandle: null,
  dirty: false,

  loadRows: (rows, fileName, handle) => set({ rows, fileName, fileHandle: handle, dirty: false }),

  addRow: (row) => set((s) => ({ rows: [...s.rows, row], dirty: true })),

  updateRow: (id, patch) => set((s) => ({
    rows: s.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    dirty: true,
  })),

  deleteRow: (id) => set((s) => ({ rows: s.rows.filter((r) => r.id !== id), dirty: true })),

  setHandle: (handle, fileName) => set({ fileHandle: handle, fileName }),

  markSaved: () => set({ dirty: false }),

  closeVault: () => set({ rows: [], fileName: null, fileHandle: null, dirty: false }),
}));
