export type VoucherStatus = "UNREDEEMED" | "REDEEMED" | "EXPIRED";

export interface Voucher {
  id: string;
  title: string;
  voucherCode: string;
  brand: string;
  sourceProgramOrCard: string;
  description: string;
  voucherType: string;
  value: number | null;
  expiryDate: string | null;
  issueDate: string;
  dateAdded: string;
  status: VoucherStatus;
  redeemedAt: string | null;
  emailId: string;
  cardOwner: string;
  cardName: string;
  periodType: string;
  periodKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherFormData {
  voucherCode: string;
  brand: string;
  title: string;
  sourceProgramOrCard: string;
  description: string;
  expiryDate: string;
  hasExpiry: boolean;
  issueDate: string;
  // auto-filled from source card (read-only in UI)
  emailId: string;
  cardOwner: string;
  cardName: string;
}

export interface Card {
  id: string;
  accountOwner: string;
  cardName: string;
  bank: string;
  cardType: string;
  lastFourDigits: string;
  email: string;
  mobileNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardFormData {
  accountOwner: string;
  cardName: string;
  bank: string;
  cardType: string;
  lastFourDigits: string;
  email: string;
  mobileNumber: string;
}

export interface AnalyticsData {
  summary: {
    total: number;
    unredeemed: number;
    redeemed: number;
    expired: number;
    totalValue: number;
    redeemedValue: number;
  };
  brandBreakdown: Array<{
    brand: string;
    total: number;
    unredeemed: number;
    redeemed: number;
    expired: number;
  }>;
  monthlyTrend: Array<{ month: string; added: number; redeemed: number }>;
  statusPie: Array<{ name: string; value: number }>;
  expiringIn7Days: number;
  expiringIn30Days: number;
}

export interface AuditLog {
  id:         string;
  action:     string;
  entity:     string;
  entityId:   string | null;
  details:    string | null;
  method:     string;
  path:       string;
  statusCode: number;
  durationMs: number;
  ipAddress:  string | null;
  userAgent:  string | null;
  createdAt:  string;
}

export interface AuditListResponse {
  data:  AuditLog[];
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

export type Page =
  | "dashboard"
  | "vouchers"
  | "wordcloud"
  | "cards"
  | "cardvault"
  | "cardstats"
  | "analytics"
  | "export"
  | "audit"
  | "settings";
