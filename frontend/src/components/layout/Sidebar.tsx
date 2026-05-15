import { useUIStore } from "@/store/uiStore";
import type { Page } from "@/types";

interface NavItem { id: Page; label: string; icon: string; }

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard",  icon: "⊞" },
  { id: "vouchers",  label: "Vouchers",   icon: "🎫" },
  { id: "cards",     label: "Cards",      icon: "💳" },
  { id: "analytics", label: "Analytics",  icon: "📊" },
  { id: "export",    label: "Export",     icon: "⬇" },
  { id: "audit",     label: "Audit Log",  icon: "📋" },
  { id: "settings",  label: "Settings",   icon: "⚙" },
];

export function Sidebar() {
  const { activePage, setActivePage, sidebarOpen, toggleSidebar, theme, toggleTheme } = useUIStore();

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-30 flex flex-col
          bg-white dark:bg-gray-900
          border-r border-gray-100 dark:border-gray-800
          transition-all duration-200
          ${sidebarOpen ? "w-56" : "w-0 lg:w-16 overflow-hidden"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <span className="text-xl">🎫</span>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">Voucher Tracker</div>
              <div className="text-xs text-gray-400 whitespace-nowrap">India Card Benefits</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActivePage(item.id); if (window.innerWidth < 1024) toggleSidebar(); }}
              className={`sidebar-link w-full ${activePage === item.id ? "active" : ""} ${!sidebarOpen ? "justify-center px-2" : ""}`}
              title={!sidebarOpen ? item.label : undefined}
            >
              <span className="text-base w-5 text-center flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Footer — theme toggle */}
        <div className={`p-2 border-t border-gray-100 dark:border-gray-800 flex ${sidebarOpen ? "justify-between items-center px-3" : "justify-center"}`}>
          {sidebarOpen && <span className="text-xs text-gray-400">{theme === "dark" ? "Dark mode" : "Light mode"}</span>}
          <button
            onClick={toggleTheme}
            title="Toggle theme"
            className="w-8 h-8 flex items-center justify-center rounded-lg
              text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
              hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base"
          >
            {theme === "dark" ? "☀" : "🌙"}
          </button>
        </div>
      </aside>
    </>
  );
}
