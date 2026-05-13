import { create } from "zustand";
import type { Card, CardFormData } from "@/types";
import { cardApi } from "@/api/client";
import toast from "react-hot-toast";

interface CardState {
  cards: Card[];
  loading: boolean;
  load: () => Promise<void>;
  addCard: (data: CardFormData) => Promise<Card>;
  updateCard: (id: string, data: Partial<CardFormData>) => Promise<Card>;
  deleteCard: (id: string) => Promise<void>;
}

export const useCardStore = create<CardState>()((set) => ({
  cards: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const cards = await cardApi.list();
      set({ cards, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addCard: async (data) => {
    const card = await cardApi.create(data);
    set((s) => ({ cards: [...s.cards, card] }));
    toast.success(`Card "${card.cardName} ending ${card.lastFourDigits}" added`);
    return card;
  },

  updateCard: async (id, data) => {
    const updated = await cardApi.update(id, data);
    set((s) => ({ cards: s.cards.map((c) => (c.id === id ? updated : c)) }));
    toast.success("Card updated");
    return updated;
  },

  deleteCard: async (id) => {
    await cardApi.delete(id);
    set((s) => ({ cards: s.cards.filter((c) => c.id !== id) }));
    toast.success("Card deleted");
  },
}));
