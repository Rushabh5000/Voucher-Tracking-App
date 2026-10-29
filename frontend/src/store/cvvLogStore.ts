import { create } from "zustand";
import { cvvUsageApi, type CvvUsageLog } from "@/api/client";

interface CvvLogState {
  logs: CvvUsageLog[];
  loaded: boolean;
  load: () => Promise<void>;
  setLogs: (logs: CvvUsageLog[]) => void;
}

export const useCvvLogStore = create<CvvLogState>()((set, get) => ({
  logs: [],
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    try {
      const logs = await cvvUsageApi.list();
      set({ logs, loaded: true });
    } catch { /* silently fail — global search just returns 0 CVV results */ }
  },

  // Used by PendingCouponsPage after it fetches fresh data on mount, so
  // GlobalSearch always has the latest list without a separate fetch.
  setLogs: (logs) => set({ logs, loaded: true }),
}));
