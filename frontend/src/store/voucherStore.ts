import { create } from "zustand";
import type { Voucher } from "@/types";
import { voucherApi } from "@/api/client";
import toast from "react-hot-toast";

interface VoucherState {
  vouchers: Voucher[];
  loading: boolean;
  error: string | null;
  // Actions
  load: () => Promise<void>;
  addVoucher: (data: Record<string, unknown>) => Promise<Voucher>;
  updateVoucher: (id: string, data: Record<string, unknown>) => Promise<Voucher>;
  redeemVoucher: (id: string) => Promise<void>;
  unredeemVoucher: (id: string) => Promise<void>;
  deleteVoucher: (id: string) => Promise<void>;
  getNext: (brand?: string, exclude?: string[]) => Promise<Voucher | null>;
  // Derived
  brands: () => string[];
}

export const useVoucherStore = create<VoucherState>()((set, get) => ({
  vouchers: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const vouchers = await voucherApi.list();
      set({ vouchers, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  addVoucher: async (data: Record<string, unknown>) => {
    const v = await voucherApi.create(data as any);
    set((s) => ({
      vouchers: [...s.vouchers, v].sort(
        (a, b) => new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
      ),
    }));
    toast.success(`Voucher "${v.brand}" saved!`);
    return v;
  },

  updateVoucher: async (id: string, data: Record<string, unknown>) => {
    const v = await voucherApi.update(id, data as any);
    set((s) => ({
      vouchers: s.vouchers.map((existing) => (existing.id === id ? v : existing)),
    }));
    toast.success(`Voucher "${v.brand}" updated!`);
    return v;
  },

  redeemVoucher: async (id) => {
    const updated = await voucherApi.redeem(id);
    set((s) => ({ vouchers: s.vouchers.map((v) => (v.id === id ? updated : v)) }));
    toast.success("Marked as redeemed");
  },

  unredeemVoucher: async (id) => {
    const updated = await voucherApi.unredeem(id);
    set((s) => ({ vouchers: s.vouchers.map((v) => (v.id === id ? updated : v)) }));
    toast.success("Reverted to unredeemed");
  },

  deleteVoucher: async (id) => {
    await voucherApi.delete(id);
    set((s) => ({ vouchers: s.vouchers.filter((v) => v.id !== id) }));
    toast.success("Voucher deleted");
  },

  getNext: async (brand, exclude) => {
    return voucherApi.next(brand, exclude);
  },

  brands: () => [...new Set(get().vouchers.map((v) => v.brand))].sort(),
}));
