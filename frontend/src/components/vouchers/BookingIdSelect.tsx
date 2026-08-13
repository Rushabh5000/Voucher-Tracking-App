import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cvvUsageApi, type CvvUsageLog } from "@/api/client";

interface BookingIdSelectProps {
  value: string;
  onChange: (val: string) => void;
  onSelectLog: (log: CvvUsageLog) => void;
}

interface DropdownPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  direction: "up" | "down";
}

const GAP = 4;
const MAX_H = 240;

// Booking IDs are always unique, so this isn't a generic type-ahead
// suggestion list — it's a real picker over your own past CVV usage log
// entries (from Card Vault), so you can select one instead of retyping it
// exactly. Selecting an entry triggers the caller's auto-fill.
export function BookingIdSelect({ value, onChange, onSelectLog }: BookingIdSelectProps) {
  const [logs, setLogs] = useState<CvvUsageLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open && !loaded) {
      cvvUsageApi.list().then((data) => { setLogs(data); setLoaded(true); }).catch(() => setLoaded(true));
    }
  }, [open, loaded]);

  const updatePosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const goUp = spaceBelow < 150 && spaceAbove > spaceBelow;
    const available = goUp ? spaceAbove : spaceBelow;
    setPos({
      top:   goUp ? rect.top - GAP : rect.bottom + GAP,
      left:  rect.left,
      width: rect.width,
      maxHeight: Math.max(80, Math.min(MAX_H, available - GAP - 8)),
      direction: goUp ? "up" : "down",
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    updatePosition();
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function select(log: CvvUsageLog) {
    onChange(log.bookingId);
    onSelectLog(log);
    setOpen(false);
    setHighlighted(-1);
  }

  const withBookingId = logs.filter((l) => l.bookingId.trim());
  const filtered = value.trim()
    ? withBookingId.filter((l) => l.bookingId.toLowerCase().includes(value.trim().toLowerCase()))
    : withBookingId;
  const showDropdown = open && loaded && filtered.length > 0 && pos;

  // Tab (or Enter) picks the highlighted suggestion — defaulting to the
  // first match — same as a real autocomplete, instead of just tabbing past
  // the field with nothing selected.
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); return; }
    if (e.key === "Escape")    { setOpen(false); setHighlighted(-1); return; }
    if (e.key === "Enter" || e.key === "Tab") {
      const pick = filtered[highlighted] ?? filtered[0];
      if (pick) {
        if (e.key === "Enter") e.preventDefault();
        select(pick);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="label">Booking ID <span className="text-gray-400 text-xs font-normal">(optional — pick a past one to auto-fill the rest)</span></label>
      <input
        ref={inputRef}
        className="input"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. order/booking reference, if you have one already"
        autoComplete="off"
      />
      {showDropdown && createPortal(
        <ul
          ref={dropdownRef}
          data-portal-dropdown
          style={{
            position: "fixed",
            top:    pos.direction === "up" ? undefined : pos.top,
            bottom: pos.direction === "up" ? window.innerHeight - pos.top : undefined,
            left:   pos.left,
            width:  pos.width,
            maxHeight: pos.maxHeight,
          }}
          className="fixed z-[100] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-y-auto"
        >
          {filtered.map((l, i) => (
            <li
              key={l.id}
              onMouseDown={(e) => { e.preventDefault(); select(l); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-2 text-sm cursor-pointer border-b border-gray-50 dark:border-gray-800/60 last:border-0 ${
                i === highlighted
                  ? "bg-accent-50 dark:bg-accent-900/30"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <div className="font-medium text-gray-800 dark:text-gray-200 font-mono">{l.bookingId}</div>
              <div className="text-xs text-gray-400 truncate">
                {[l.brand, l.cardLabel].filter(Boolean).join(" · ") || "No brand/card noted"}
              </div>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}
