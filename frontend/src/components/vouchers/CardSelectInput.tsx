import { useState, useRef, useEffect, useCallback } from "react";
import type { Card } from "@/types";

interface CardSelectInputProps {
  cards: Card[];
  selectedId: string;
  onSelect: (card: Card | null) => void;
  label?: string;
}

function cardLabel(card: Card): string {
  return `${card.bank} | ${card.lastFourDigits}`;
}

function cardDetail(card: Card): string {
  return `${card.cardName}  ·  ${card.accountOwner}`;
}

export function CardSelectInput({ cards, selectedId, onSelect, label }: CardSelectInputProps) {
  const [query,      setQuery]      = useState("");
  const [open,       setOpen]       = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // When a card is already selected, show its label in the input
  const selectedCard = cards.find(c => c.id === selectedId) ?? null;
  const displayValue = open ? query : (selectedCard ? cardLabel(selectedCard) : "");

  const filtered = useCallback(() => {
    if (!query.trim()) return cards;
    const q = query.toLowerCase();
    return cards.filter(c =>
      c.bank.toLowerCase().includes(q) ||
      c.lastFourDigits.includes(q) ||
      c.cardName.toLowerCase().includes(q) ||
      c.accountOwner.toLowerCase().includes(q)
    );
  }, [cards, query]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // If nothing valid selected, reset query
        if (!selectedCard) setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selectedCard]);

  function handleFocus() {
    setOpen(true);
    setQuery(""); // clear to show all options on focus
    setHighlighted(-1);
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
    setHighlighted(-1);
    // Clear selection if user starts typing something different
    if (selectedCard && e.target.value !== cardLabel(selectedCard)) {
      onSelect(null);
    }
  }

  function handleSelect(card: Card) {
    onSelect(card);
    setQuery("");
    setOpen(false);
    setHighlighted(-1);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onSelect(null);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    const opts = filtered();
    if (!open) { if (e.key === "ArrowDown" || e.key === "Enter") { setOpen(true); return; } }
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted(h => Math.min(h + 1, opts.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    if (e.key === "Enter" && highlighted >= 0 && opts[highlighted]) {
      e.preventDefault(); handleSelect(opts[highlighted]);
    }
    if (e.key === "Escape") { setOpen(false); setQuery(""); }
    if (e.key === "Tab") {
      if (!selectedCard && opts.length > 0) {
        const pick = highlighted >= 0 ? opts[highlighted] : opts[0];
        handleSelect(pick);
        // don't prevent default — focus moves naturally to next field
      } else {
        setOpen(false);
      }
    }
  }

  function handleBlur() {
    setOpen(false);
    if (!selectedCard) setQuery("");
  }

  const opts = filtered();

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="label">{label}</label>}

      <div className={`relative flex items-center border rounded-lg transition-colors ${
        open
          ? "border-accent-500 ring-2 ring-accent-500/20"
          : selectedCard
            ? "border-accent-400 dark:border-accent-600 bg-accent-50/30 dark:bg-accent-900/10"
            : "border-gray-300 dark:border-gray-700"
      }`}>
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={cards.length === 0 ? "No cards saved — add cards first" : "Type bank name or last 4 digits…"}
          disabled={cards.length === 0}
          autoComplete="off"
          className="flex-1 px-3 py-2 text-sm bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 disabled:cursor-not-allowed"
        />

        {/* Selected badge OR chevron */}
        <div className="flex items-center gap-1 pr-2 flex-shrink-0">
          {selectedCard ? (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs px-1 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Clear selection"
            >
              ✕
            </button>
          ) : (
            <span className="text-gray-400 text-xs pointer-events-none">{open ? "▲" : "▼"}</span>
          )}
        </div>
      </div>

      {/* Selected card detail pill */}
      {selectedCard && !open && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 px-1">
          {cardDetail(selectedCard)}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden max-h-60 overflow-y-auto">
          {opts.length === 0 ? (
            <li className="px-3 py-3 text-sm text-gray-400 text-center">
              {query ? `No cards match "${query}"` : "No cards saved"}
            </li>
          ) : (
            opts.map((card, i) => (
              <li
                key={card.id}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(card); }}
                onMouseEnter={() => setHighlighted(i)}
                className={`px-3 py-2.5 cursor-pointer transition-colors border-b border-gray-50 dark:border-gray-800 last:border-0 ${
                  i === highlighted || card.id === selectedId
                    ? "bg-accent-50 dark:bg-accent-900/30"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    {/* Primary: Bank | XXXX */}
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {card.bank}
                      <span className="font-mono text-accent-600 dark:text-accent-400 ml-1.5">| {card.lastFourDigits}</span>
                    </div>
                    {/* Secondary: card name · owner */}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {card.cardName}  ·  {card.accountOwner}
                    </div>
                  </div>
                  {card.id === selectedId && (
                    <span className="text-accent-500 text-sm flex-shrink-0">✓</span>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
