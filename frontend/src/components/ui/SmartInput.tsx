import React, { useState, useEffect, useRef, useCallback } from "react";
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
}

export function SmartInput({
  field, value, onChange, placeholder, label, required,
  className, type = "text", staticSuggestions,
}: SmartInputProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
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
          const results = await autocompleteApi.suggest(field, q || undefined);
          setSuggestions(results);
        }
      } catch {
        setSuggestions([]);
      }
    },
    [field, staticSuggestions]
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (open) {
      debounceRef.current = setTimeout(() => fetchSuggestions(value), 150);
    }
    return () => clearTimeout(debounceRef.current);
  }, [value, open, fetchSuggestions]);

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

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      {label && (
        <label className="label">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
        onFocus={() => { setOpen(true); fetchSuggestions(value); }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="input"
      />
      {open && visibleSuggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
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
        </ul>
      )}
    </div>
  );
}
