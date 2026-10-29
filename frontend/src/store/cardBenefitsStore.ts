import { create } from "zustand";
import { cardBenefitsApi, type CardBenefit } from "@/api/client";

interface CardBenefitsState {
  benefits: CardBenefit[];
  loaded: boolean;
  load: () => Promise<void>;
  addBenefit: (bank: string, cardType: string, brand: string, periodType: string) => Promise<void>;
  removeBenefit: (id: string) => Promise<void>;
}

export const useCardBenefitsStore = create<CardBenefitsState>()((set, get) => ({
  benefits: [],
  loaded: false,

  load: async () => {
    if (get().loaded) return;
    try {
      const benefits = await cardBenefitsApi.list();
      set({ benefits, loaded: true });
    } catch { /* silently fail */ }
  },

  addBenefit: async (bank, cardType, brand, periodType) => {
    const benefit = await cardBenefitsApi.create({ bank, cardType, brand, periodType });
    set((s) => ({ benefits: [...s.benefits, benefit] }));
  },

  removeBenefit: async (id) => {
    await cardBenefitsApi.remove(id);
    set((s) => ({ benefits: s.benefits.filter((b) => b.id !== id) }));
  },
}));
