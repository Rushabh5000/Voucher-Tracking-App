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
  }

  const filtered = value.trim()
    ? logs.filter((l) => l.bookingId.toLowerCase().includes(value.trim().toLowerCase()))
    : logs;
  const showDropdown = open && loaded && filtered.length > 0 && pos;

  return (
    <div ref={containerRef} className="relative">
      <label className="label">Booking ID <span className="text-gray-400 text-xs font-normal">(optional — pick a past one to auto-fill the rest)</span></label>
      <input
        ref={inputRef}
        className="input"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="e.g. order/booking reference, if you have one already"
        autoComplete="off"
      />
      {showDropdown && createPortal(
        <ul
          ref={dropdownRef}
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
          {filtered.map((l) => (
            <li
              key={l.id}
              onMouseDown={(e) => { e.preventDefault(); select(l); }}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-50 dark:border-gray-800/60 last:border-0"
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
