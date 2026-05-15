import axios from "axios";
import type { Voucher, Card, CardFormData, AnalyticsData, AuditListResponse } from "@/types";

const http = axios.create({ baseURL: "/api" });

// ─── Vouchers ─────────────────────────────────────────────────
export const voucherApi = {
  list:     ()               => http.get<{ data: Voucher[] }>("/vouchers").then(r => r.data.data),
  get:      (id: string)     => http.get<{ data: Voucher }>(`/vouchers/${id}`).then(r => r.data.data),
  next:     (brand?: string, exclude?: string[]) => {
    const params: Record<string, string> = {};
    if (brand && brand !== "ALL") params.brand = brand;
    if (exclude && exclude.length > 0) params.exclude = exclude.join(",");
    return http.get<{ data: Voucher | null }>("/vouchers/next", { params }).then(r => r.data.data);
  },
  create:   (data: Record<string, unknown>) => http.post<{ data: Voucher }>("/vouchers", data).then(r => r.data.data),
  update:   (id: string, data: Record<string, unknown>) => http.patch<{ data: Voucher }>(`/vouchers/${id}`, data).then(r => r.data.data),
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
  suggest: (field: string, q?: string, contextField?: string, contextValue?: string) =>
    http.get<{ data: string[] }>("/autocomplete", { params: { field, q, contextField, contextValue } }).then(r => r.data.data),
  getAll: () =>
    http.get<{ data: Record<string, string[]> }>("/autocomplete/all").then(r => r.data.data),
  rename: (field: string, oldValue: string, newValue: string) =>
    http.patch("/autocomplete", { field, oldValue, newValue }),
  remove: (field: string, value: string) =>
    http.delete("/autocomplete", { data: { field, value } }),
};

// ─── Analytics ────────────────────────────────────────────────
export const analyticsApi = {
  get: () => http.get<{ data: AnalyticsData }>("/analytics").then(r => r.data.data),
};

// ─── Audit ────────────────────────────────────────────────────
export const auditApi = {
  list: (params: Record<string, string | number>) =>
    http.get<AuditListResponse>("/audit", { params }).then(r => r.data),
  exportUrl: (params: Record<string, string>) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => Boolean(v)))
    ).toString();
    return `/api/audit/export${qs ? "?" + qs : ""}`;
  },
};

// ─── Export ───────────────────────────────────────────────────
export const exportApi = {
  excel:       () => `/api/export/excel`,
  masterExcel: () => `/api/export/excel/master`,
  pdf:         () => `/api/export/pdf`,
  sendEmail:   () => http.post("/export/email"),
};
