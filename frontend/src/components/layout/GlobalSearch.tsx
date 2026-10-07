import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useVoucherStore } from "@/store/voucherStore";
import { useCardStore } from "@/store/cardStore";
import { useCardVaultStore } from "@/store/cardVaultStore";
import { isSensitiveColumn } from "@/utils/cardVaultExcel";
import { PAGE_PATHS } from "@/utils/routes";

interface Result {
  id: string;
  type: "voucher" | "card" | "vault";
  icon: string;
  primary: string;
  secondary: string;
  badge?: string;
  badgeCls?: string;
  path: string;
  // passed as location.state so the destination page can act on the specific item
  navState?: Record<string, string>;
}

const MAX_PER_TYPE = 5;

function hits(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.toLowerCase();
  return fields.some((f) => f && f.toLowerCase().includes(q));
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { vouchers } = useVoucherStore();
  const { cards } = useCardStore();
  const { rows: vaultRows, columns: vaultCols } = useCardVaultStore();

  const results = useMemo<Result[]>(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    const out: Result[] = [];

    // ── Vouchers ──────────────────────────────────────────────────────────
    let vCount = 0;
    for (const v of vouchers) {
      if (vCount >= MAX_PER_TYPE) break;
      if (!hits(q, v.brand, v.title, v.voucherCode, v.bookingId,
                v.sourceProgramOrCard, v.description, v.emailId,
                v.cardOwner, v.cardName)) continue;
      const statusCls = v.status === "REDEEMED"
        ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
        : v.status === "EXPIRED"
          ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
      out.push({
        id: `v-${v.id}`,
        type: "voucher",
        icon: "🎫",
        primary: `${v.brand}${v.title ? ` · ${v.title}` : ""}`,
        secondary: [v.voucherCode, v.bookingId, v.sourceProgramOrCard].filter(Boolean).join(" · "),
        badge: v.status.charAt(0) + v.status.slice(1).toLowerCase(),
        badgeCls: statusCls,
        path: PAGE_PATHS.vouchers,
        navState: { openVoucherId: v.id },
      });
      vCount++;
    }

    // ── Cards (Cards Summary) ──────────────────────────────────────────────
    let cCount = 0;
    for (const c of cards) {
      if (cCount >= MAX_PER_TYPE) break;
      if (!hits(q, c.bank, c.cardType, c.lastFourDigits, c.accountOwner,
                c.email, c.cardName, c.mobileNumber)) continue;
      out.push({
        id: `c-${c.id}`,
        type: "card",
        icon: "💳",
        primary: `${c.bank} | ${c.lastFourDigits} · ${c.cardName}`,
        secondary: [c.accountOwner, c.email].filter(Boolean).join(" · "),
        path: PAGE_PATHS.cards,
      });
      cCount++;
    }

    // ── Card Vault (offline, in-memory only) ──────────────────────────────
    let vaultCount = 0;
    for (const row of vaultRows) {
      if (vaultCount >= MAX_PER_TYPE) break;
      // Search all columns, including sensitive ones (card number, CVV, etc.)
      const matched = vaultCols.some((col) => {
        const val = row.values[col];
        return val && val.toLowerCase().includes(q.toLowerCase());
      });
      if (!matched) continue;

      // Display only non-sensitive columns in the result label
      const bankCol = vaultCols.find((c) => c.trim().toLowerCase() === "bank");
      const nameCol = vaultCols.find((c) => c.trim().toLowerCase() === "card name" || c.trim().toLowerCase() === "cardname");
      const numCol  = vaultCols.find((c) => c.trim().toLowerCase().includes("card number") || c.trim().toLowerCase() === "cardnumber");
      const ownerCol = vaultCols.find((c) => c.trim().toLowerCase() === "acc owner" || c.trim().toLowerCase() === "account owner" || c.trim().toLowerCase() === "owner");

      const bank  = bankCol  ? row.values[bankCol]  ?? "" : "";
      const name  = nameCol  ? row.values[nameCol]  ?? "" : "";
      const num   = numCol   ? row.values[numCol]   ?? "" : "";
      const owner = ownerCol ? row.values[ownerCol] ?? "" : "";

      const primary = [bank, name].filter(Boolean).join(" | ")
        || Object.entries(row.values).find(([col, val]) => val && !isSensitiveColumn(col))?.[1]
        || "Card Vault entry";
      const last4 = num ? `•••• ${num.slice(-4)}` : "";
      const secondary = [last4, owner].filter(Boolean).join(" · ");

      out.push({
        id: `vlt-${row.id}`,
        type: "vault",
        icon: "🏦",
        primary,
        secondary,
        badge: "Card Vault",
        badgeCls: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
        path: PAGE_PATHS.cardvault,
      });
      vaultCount++;
    }

    return out;
  }, [query, vouchers, cards, vaultRows, vaultCols]);

  // Reset cursor when results change
  useEffect(() => { setCursor(-1); }, [results]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Ctrl+K / Cmd+K global shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, -1)); }
    if (e.key === "Enter" && cursor >= 0 && results[cursor]) { go(results[cursor]); }
    if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  }

  const go = useCallback((r: Result) => {
    navigate(r.path, r.navState ? { state: r.navState } : undefined);
    setOpen(false);
    setQuery("");
    setCursor(-1);
    inputRef.current?.blur();
  }, [navigate]);

  const typeLabel: Record<Result["type"], string> = {
    voucher: "Vouchers",
    card: "Cards",
    vault: "Card Vault",
  };

  // Group results by type for section headers; flatIdx is position in the flat results array for keyboard nav
  const resultIndex = new Map(results.map((r, i) => [r.id, i]));
  const sections: { type: Result["type"]; items: (Result & { flatIdx: number })[] }[] = [];
  for (const type of ["voucher", "card", "vault"] as Result["type"][]) {
    const items = results
      .filter((r) => r.type === type)
      .map((r) => ({ ...r, flatIdx: resultIndex.get(r.id) ?? 0 }));
    if (items.length > 0) sections.push({ type, items });
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search anything… (Ctrl+K)"
          autoComplete="off"
          className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700
            bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent
            transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); inputRef.current?.focus(); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden max-h-[70vh] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">No results for &ldquo;{query}&rdquo;</div>
          ) : (
            sections.map(({ type, items }) => (
              <div key={type}>
                <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {typeLabel[type]}
                  {type === "vault" && items.length > 0 && (
                    <span className="ml-1 normal-case font-normal">(offline file)</span>
                  )}
                </div>
                {items.map((r) => (
                  <button
                    key={r.id}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
                      ${cursor === r.flatIdx
                        ? "bg-accent-50 dark:bg-accent-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                      }`}
                    onMouseEnter={() => setCursor(r.flatIdx)}
                    onClick={() => go(r)}
                  >
                    <span className="text-base shrink-0">{r.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.primary}</div>
                      {r.secondary && (
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{r.secondary}</div>
                      )}
                    </div>
                    {r.badge && (
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${r.badgeCls ?? ""}`}>
                        {r.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
          <div className="px-3 py-1.5 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-600 flex gap-3">
            <span>↑↓ navigate</span><span>↵ open</span><span>Esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}
