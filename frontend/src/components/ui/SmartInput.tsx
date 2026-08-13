import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { autocompleteApi } from "@/api/client";

interface SmartInputProps {
  field: string;                    // autocomplete field key (e.g. "bank")
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  type?: string;
  staticSuggestions?: string[];     // optional fixed suggestions (no API call)
  contextField?: string;            // context field for filtering (e.g. "brand")
  contextValue?: string;            // context value (e.g. "Amazon")
  dropUp?: boolean;                 // force the list above the input; omit to auto-pick based on available space
}

interface DropdownPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  direction: "up" | "down";
}

const DROPDOWN_GAP = 4;
const DROPDOWN_MAX = 208; // matches the old max-h-52

export function SmartInput({
  field, value, onChange, placeholder, label, required,
  className, type = "text", staticSuggestions, contextField, contextValue, dropUp,
}: SmartInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const debounceRef   = useRef<ReturnType<typeof setTimeout>>();

  // Fetch suggestions from API or use static list
  const fetchSuggestions = useCallback(
    async (q: string) => {
      try {
        if (staticSuggestions) {
          const filtered = staticSuggestions.filter((s) =>
            s.toLowerCase().includes(q.toLowerCase())
          );
          setSuggestions(filtered);
        } else {
          const results = await autocompleteApi.suggest(field, q || undefined, contextField, contextValue);
          setSuggestions(results);
        }
      } catch {
        setSuggestions([]);
      }
    },
    [field, staticSuggestions, contextField, contextValue]
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (open) {
      debounceRef.current = setTimeout(() => fetchSuggestions(value), 150);
    }
    return () => clearTimeout(debounceRef.current);
  }, [value, open, fetchSuggestions]);

  // Rendered via a portal to document.body (position: fixed), so it always
  // escapes any ancestor's overflow/scroll clipping — e.g. a Modal's
  // scrollable body — regardless of where in the page this input sits.
  // Recomputed on open and kept anchored on scroll/resize while open.
  const updatePosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const goUp = dropUp ?? (spaceBelow < 150 && spaceAbove > spaceBelow);
    const available = goUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(80, Math.min(DROPDOWN_MAX, available - DROPDOWN_GAP - 8));

    setPos({
      top:   goUp ? rect.top - DROPDOWN_GAP : rect.bottom + DROPDOWN_GAP,
      left:  rect.left,
      width: rect.width,
      maxHeight,
      direction: goUp ? "up" : "down",
    });
  }, [dropUp]);

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

  // Close on outside click (checks both the input's own container and the
  // portalled dropdown, since the dropdown no longer lives inside containerRef)
  const dropdownRef = useRef<HTMLUListElement>(null);
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, suggestions.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      select(suggestions[highlighted]);
    }
    if (e.key === "Escape") setOpen(false);
  }

  function select(val: string) {
    onChange(val);
    setOpen(false);
    setHighlighted(-1);
  }

  const visibleSuggestions = suggestions.filter(
    (s) => s.toLowerCase() !== value.toLowerCase()
  );
  const showDropdown = open && visibleSuggestions.length > 0 && pos;

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      {label && (
        <label className="label">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
        onFocus={() => { setOpen(true); fetchSuggestions(value); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="input"
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
          {visibleSuggestions.map((s, i) => (
            <li
              key={s}
              onMouseDown={(e) => { e.preventDefault(); select(s); }}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors
                ${i === highlighted
                  ? "bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
                }`}
            >
              {s}
            </li>
          ))}
          {/* Add new option if typed value doesn't exist */}
          {value.trim() && !suggestions.some(s => s.toLowerCase() === value.toLowerCase()) && (
            <li
              onMouseDown={(e) => { e.preventDefault(); select(value.trim()); }}
              className="px-3 py-2 text-sm cursor-pointer border-t border-gray-100 dark:border-gray-800
                         text-accent-600 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 flex items-center gap-2"
            >
              <span className="text-xs font-medium uppercase tracking-wide opacity-60">Add</span>
              <span className="font-medium">"{value.trim()}"</span>
            </li>
          )}
        </ul>,
        document.body
      )}
    </div>
  );
}
