import { useState, useEffect, useCallback } from "react";
import { auditApi } from "@/api/client";
import type { AuditLog } from "@/types";

// ─── Entity badge styling ─────────────────────────────────────────────────────
const ENTITY_BADGE: Record<string, string> = {
  Voucher:            "bg-accent-50  text-accent-700  dark:bg-accent-900/30  dark:text-accent-300",
  Card:               "bg-blue-50    text-blue-700    dark:bg-blue-900/30    dark:text-blue-300",
  AutocompleteEntry:  "bg-purple-50  text-purple-700  dark:bg-purple-900/30  dark:text-purple-300",
};

const ENTITY_LABEL: Record<string, string> = {
  Voucher:           "Voucher",
  Card:              "Card",
  AutocompleteEntry: "Field Value",
};

const ENTITIES = ["Voucher", "Card", "AutocompleteEntry"];

function statusBadge(code: number): { cls: string; label: string } {
  if (code < 300) return { cls: "text-green-600  dark:text-green-400",  label: String(code) };
  if (code < 400) return { cls: "text-yellow-600 dark:text-yellow-400", label: String(code) };
  if (code < 500) return { cls: "text-orange-600 dark:text-orange-400", label: String(code) };
  return              { cls: "text-red-600    dark:text-red-400",    label: String(code) };
}

function fmtTs(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone:  "Asia/Kolkata",
    day:       "2-digit",
    month:     "short",
    year:      "numeric",
    hour:      "2-digit",
    minute:    "2-digit",
    second:    "2-digit",
    hour12:    false,
  });
}

const LIMIT = 50;

interface Filters { entity: string; action: string; from: string; to: string; }
const BLANK: Filters = { entity: "", action: "", from: "", to: "" };

export function AuditPage() {
  const [logs,    setLogs]    = useState<AuditLog[]>([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>(BLANK);

  const load = useCallback(async (p: number, f: Filters) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: LIMIT };
      if (f.entity) params.entity = f.entity;
      if (f.action) params.action = f.action;
      if (f.from)   params.from   = f.from;
      if (f.to)     params.to     = f.to;
      const res = await auditApi.list(params);
      setLogs(res.data);
      setTotal(res.total);
      setPages(res.pages);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, filters); }, [page, filters, load]);

  function apply(next: Filters) { setFilters(next); setPage(1); }
  function clear()               { setFilters(BLANK);  setPage(1); }

  const hasFilters = Object.values(filters).some(Boolean);

  const exportUrl = auditApi.exportUrl({
    entity: filters.entity,
    action: filters.action,
    from:   filters.from,
    to:     filters.to,
  });

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">

          <div>
            <label className="label">Entity</label>
            <select
              className="input h-9 text-sm pr-8"
              value={filters.entity}
              onChange={e => apply({ ...filters, entity: e.target.value })}
            >
              <option value="">All</option>
              {ENTITIES.map(e => (
                <option key={e} value={e}>{ENTITY_LABEL[e] ?? e}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Action contains</label>
            <input
              className="input h-9 text-sm w-44"
              placeholder="e.g. Created, Deleted"
              value={filters.action}
              onChange={e => apply({ ...filters, action: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="label">From</label>
            <input
              type="date"
              className="input h-9 text-sm"
              value={filters.from}
              onChange={e => apply({ ...filters, from: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="label">To</label>
            <input
              type="date"
              className="input h-9 text-sm"
              value={filters.to}
              onChange={e => apply({ ...filters, to: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div className="flex gap-2">
            {hasFilters && (
              <button className="btn-secondary text-sm h-9" onClick={clear}>Clear</button>
            )}
            <a
              href={exportUrl}
              download
              className="btn-primary text-sm h-9 flex items-center gap-1.5 no-underline"
            >
              ⬇ Export Excel
            </a>
          </div>
        </div>

        <p className="mt-2 text-xs text-gray-400">
          {loading ? "Loading…" : `${total.toLocaleString()} record${total !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Timestamp (IST)</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Entity</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Details</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">ms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-gray-400 text-sm">
                    No audit records found.
                  </td>
                </tr>
              )}

              {logs.map(log => {
                const { cls: statusCls, label: statusLabel } = statusBadge(log.statusCode);
                return (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    {/* Timestamp */}
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">
                      {fmtTs(log.createdAt)}
                    </td>

                    {/* Action */}
                    <td className="px-3 py-3 text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {log.action}
                    </td>

                    {/* Entity badge */}
                    <td className="px-3 py-3">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${ENTITY_BADGE[log.entity] ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
                        {ENTITY_LABEL[log.entity] ?? log.entity}
                      </span>
                    </td>

                    {/* Details */}
                    <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {log.details ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>

                    {/* Status */}
                    <td className={`px-3 py-3 text-right text-xs font-semibold tabular-nums ${statusCls}`}>
                      {statusLabel}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3 text-right text-xs text-gray-400 tabular-nums">
                      {log.durationMs}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400 text-sm">
            Page {page} of {pages} &nbsp;·&nbsp; {total.toLocaleString()} total records
          </span>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-sm px-3 py-1.5"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              ← Prev
            </button>
            <button
              className="btn-secondary text-sm px-3 py-1.5"
              disabled={page >= pages}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
