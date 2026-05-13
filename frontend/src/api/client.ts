import axios from "axios";
import type { Voucher, Card, CardFormData, AnalyticsData } from "@/types";

const http = axios.create({ baseURL: "/api" });

// ─── Vouchers ─────────────────────────────────────────────────
export const voucherApi = {
  list:     ()               => http.get<{ data: Voucher[] }>("/vouchers").then(r => r.data.data),
  get:      (id: string)     => http.get<{ data: Voucher }>(`/vouchers/${id}`).then(r => r.data.data),
  next:     (brand?: string) => http.get<{ data: Voucher | null }>(`/vouchers/next${brand && brand !== "ALL" ? `?brand=${encodeURIComponent(brand)}` : ""}`).then(r => r.data.data),
  create:   (data: Record<string, unknown>) => http.post<{ data: Voucher }>("/vouchers", data).then(r => r.data.data),
  redeem:   (id: string)     => http.patch<{ data: Voucher }>(`/vouchers/${id}/redeem`).then(r => r.data.data),
  unredeem: (id: string)     => http.patch<{ data: Voucher }>(`/vouchers/${id}/unredeem`).then(r => r.data.data),
  delete:   (id: string)     => http.delete(`/vouchers/${id}`),
};

// ─── Cards ────────────────────────────────────────────────────
export const cardApi = {
  list:   ()                                       => http.get<{ data: Card[] }>("/cards").then(r => r.data.data),
  get:    (id: string)                             => http.get<{ data: Card }>(`/cards/${id}`).then(r => r.data.data),
  create: (data: CardFormData)                     => http.post<{ data: Card }>("/cards", data).then(r => r.data.data),
  update: (id: string, data: Partial<CardFormData>) => http.patch<{ data: Card }>(`/cards/${id}`, data).then(r => r.data.data),
  delete: (id: string)                             => http.delete(`/cards/${id}`),
};

// ─── Autocomplete ─────────────────────────────────────────────
export const autocompleteApi = {
  suggest: (field: string, q?: string) =>
    http.get<{ data: string[] }>("/autocomplete", { params: { field, q } }).then(r => r.data.data),
};

// ─── Analytics ────────────────────────────────────────────────
export const analyticsApi = {
  get: () => http.get<{ data: AnalyticsData }>("/analytics").then(r => r.data.data),
};

// ─── Export ───────────────────────────────────────────────────
export const exportApi = {
  excel:       () => `/api/export/excel`,
  masterExcel: () => `/api/export/excel/master`,
  pdf:         () => `/api/export/pdf`,
  sendEmail:   () => http.post("/export/email"),
};
