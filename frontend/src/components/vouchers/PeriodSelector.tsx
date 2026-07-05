import {
  PERIOD_TYPES,
  subPeriodOptions,
  makePeriodKey,
  parsePeriodKey,
  currentPeriodKey,
  type PeriodType,
} from "@/utils/periods";

interface PeriodSelectorProps {
  periodType: string;
  periodKey: string;
  onChange: (periodType: string, periodKey: string) => void;
  // When true, the Year picker is hidden and the current year is always used.
  hideYear?: boolean;
}

/**
 * Lets the user tag a voucher as a recurring Rupay benefit
 * (quarterly / half-yearly / yearly) so it can be compared across cards.
 */
export function PeriodSelector({ periodType, periodKey, onChange, hideYear = false }: PeriodSelectorProps) {
  const type = (periodType || "") as PeriodType;
  const parsed = parsePeriodKey(type, periodKey);
  const subOptions = subPeriodOptions(type);

  const curYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = curYear + 1; y >= curYear - 6; y--) years.push(y);

  function handleTypeChange(next: PeriodType) {
    // Default to the current period whenever a periodic type is chosen
    onChange(next, next ? currentPeriodKey(next) : "");
  }

  function handleYearChange(year: number) {
    onChange(type, makePeriodKey(type, year, parsed.sub));
  }

  function handleSubChange(sub: number) {
    // With the year hidden we always anchor to the current year
    const year = hideYear ? curYear : parsed.year;
    onChange(type, makePeriodKey(type, year, sub));
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3 bg-gray-50/60 dark:bg-gray-800/30">
      <div className="flex items-center gap-2">
        <span className="text-sm">🔁</span>
        <label className="label mb-0">
          Recurring benefit period
          <span className="text-xs text-gray-400 font-normal ml-1">
            (Rupay quarterly / half-yearly / yearly — powers Card Stats)
          </span>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Period type */}
        <div>
          <label className="label text-xs">Frequency</label>
          <select
            className="input"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as PeriodType)}
          >
            {PERIOD_TYPES.map((t) => (
              <option key={t.value || "none"} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Year — only when periodic and not hidden */}
        {type && !hideYear && (
          <div>
            <label className="label text-xs">Year</label>
            <select
              className="input"
              value={parsed.year}
              onChange={(e) => handleYearChange(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}

        {/* Sub-period — only for quarterly / half-yearly */}
        {subOptions.length > 0 && (
          <div>
            <label className="label text-xs">Period</label>
            <select
              className="input"
              value={parsed.sub}
              onChange={(e) => handleSubChange(Number(e.target.value))}
            >
              {subOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!type && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Leave as “One-time” for regular vouchers. Choose a frequency to track this brand across
          cards for each period.
        </p>
      )}
    </div>
  );
}
