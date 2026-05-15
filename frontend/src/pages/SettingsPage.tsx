import { useUIStore } from "@/store/uiStore";
import { FieldValuesManager } from "@/components/settings/FieldValuesManager";

export function SettingsPage() {
  const { theme, setTheme } = useUIStore();

  return (
    <div className="max-w-2xl space-y-6">
      {/* Appearance */}
      <div className="card p-5">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-4">Appearance</h3>
        <div className="space-y-3">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">Theme</div>
          <div className="grid grid-cols-2 gap-3">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-colors
                  ${theme === t
                    ? "bg-accent-50 dark:bg-accent-900/30 border-accent-400 dark:border-accent-600 text-accent-700 dark:text-accent-300"
                    : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
              >
                <span>{t === "light" ? "☀" : "🌙"}</span>
                <span className="capitalize">{t} mode</span>
                {theme === t && <span className="ml-auto text-accent-500">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Field Values Manager */}
      <FieldValuesManager />

      {/* About */}
      <div className="card p-5">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">About</h3>
        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex justify-between"><span>Version</span><span className="font-medium text-gray-700 dark:text-gray-300">2.0.0</span></div>
          <div className="flex justify-between"><span>Stack</span><span className="font-medium text-gray-700 dark:text-gray-300">React + TypeScript + Tailwind + Zustand</span></div>
          <div className="flex justify-between"><span>Backend</span><span className="font-medium text-gray-700 dark:text-gray-300">Node.js + Express + Prisma + PostgreSQL</span></div>
          <div className="flex justify-between"><span>Purpose</span><span className="font-medium text-gray-700 dark:text-gray-300">India card voucher tracker</span></div>
        </div>
      </div>

      {/* Email config reminder */}
      <div className="card p-5">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Email configuration</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          To receive monthly summary emails, configure these environment variables in your <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">backend/.env</code>:
        </p>
        <div className="text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-0.5">
          {["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "REPORT_RECIPIENT"].map(k => (
            <div key={k}>{k}=…</div>
          ))}
        </div>
      </div>
    </div>
  );
}
