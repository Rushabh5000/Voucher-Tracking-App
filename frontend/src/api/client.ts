import axios from "axios";
import type { Voucher, Card, CardFormData, AnalyticsData, AuditListResponse } from "@/types";
import { useAuthStore } from "@/store/authStore";

// In production (Vercel + Render) VITE_API_URL = "https://your-backend.onrender.com"
// In local dev it's empty and Vite's proxy handles /api → localhost:3001
export const API_ORIGIN = (import.meta.env.VITE_API_URL as string) || "";

// 60s timeout: the Render free tier can hold a request open while it wakes from hibernation.
const http = axios.create({ baseURL: `${API_ORIGIN}/api`, timeout: 60000 });

// Attach JWT to every request
http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear the token so the app redirects to login.
// On cold-start failures (backend hibernating → network error / 502 / 503 / 504),
// transparently retry idempotent GETs with backoff so real data loads once it wakes,
// instead of surfacing an error the UI would render as "no data".
const MAX_RETRIES = 10;
http.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
      return Promise.reject(err);
    }

    const config = err.config;
    const status = err.response?.status;
    const method = (config?.method ?? "get").toLowerCase();
    const transient = !err.response || status === 502 || status === 503 || status === 504;

    if (config && method === "get" && transient) {
      const attempt = (config as any).__retry ?? 0;
      if (attempt < MAX_RETRIES) {
        (config as any).__retry = attempt + 1;
        const delay = Math.min(5000, 1500 * (attempt + 1)); // ~1.5s → 5s, ~40s total
        await new Promise((r) => setTimeout(r, delay));
        return http(config);
      }
    }
    return Promise.reject(err);
  }
);

// Append token to download href URLs so the browser can authenticate
function authUrl(path: string): string {
  const token = useAuthStore.getState().token;
  const full  = `${API_ORIGIN}${path}`;
  if (!token) return full;
  const sep = full.includes("?") ? "&" : "?";
  return `${full}${sep}token=${encodeURIComponent(token)}`;
}

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
    return authUrl(`/api/audit/export${qs ? "?" + qs : ""}`);
  },
};

// ─── Auth (pre-login — raw fetch, no axios interceptors) ──────
export const authApi = {
  login: (username: string, password: string) =>
    fetch(`${API_ORIGIN}/api/auth/login`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, password }),
    }),
  register: (username: string, password: string) =>
    fetch(`${API_ORIGIN}/api/auth/register`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, password }),
    }),
  guest: () =>
    fetch(`${API_ORIGIN}/api/auth/guest`, { method: "POST" }),
};

// ─── Export ───────────────────────────────────────────────────
export const exportApi = {
  excel:       () => authUrl("/api/export/excel"),
  masterExcel: () => authUrl("/api/export/excel/master"),
  pdf:         () => authUrl("/api/export/pdf"),
  sendEmail:   () => http.post("/export/email"),
};
