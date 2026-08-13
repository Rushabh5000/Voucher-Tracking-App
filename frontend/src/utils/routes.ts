import type { Page } from "@/types";

// Single source of truth for page <-> URL mapping, so refreshing (or
// bookmarking/sharing a link to) any page lands back on that same page
// instead of always resetting to the dashboard.
export const PAGE_PATHS: Record<Page, string> = {
  dashboard: "/",
  vouchers:  "/vouchers",
  wordcloud: "/brand-cloud",
  cards:     "/cards",
  cardvault: "/card-vault",
  cardstats: "/card-stats",
  analytics: "/analytics",
  export:    "/export",
  audit:     "/audit",
  settings:  "/settings",
};

export function pageForPath(pathname: string): Page {
  const entry = (Object.entries(PAGE_PATHS) as [Page, string][]).find(([, path]) => path === pathname);
  return entry?.[0] ?? "dashboard";
}
