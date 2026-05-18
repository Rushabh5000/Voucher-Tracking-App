import React, { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { useUIStore }  from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";

interface LayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function GuestCountdown({ expiresAt, onSignUp }: { expiresAt: string; onSignUp: () => void }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function tick() {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("expired"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}m ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-6 py-1.5 flex items-center justify-between text-xs">
      <span className="text-amber-700 dark:text-amber-300">
        Guest session — expires in {remaining}. All data is deleted on expiry.
      </span>
      <button
        onClick={onSignUp}
        className="ml-4 text-amber-800 dark:text-amber-200 font-semibold underline hover:no-underline whitespace-nowrap"
      >
        Create account
      </button>
    </div>
  );
}

export function Layout({ title, subtitle, actions, children }: LayoutProps) {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { role, guestExpiresAt, logout } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />

      <div className={`transition-all duration-200 min-h-screen ${sidebarOpen ? "lg:ml-56" : "lg:ml-16"}`}>
        {/* Topbar */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
          {role === "guest" && guestExpiresAt && (
            <GuestCountdown
              expiresAt={guestExpiresAt}
              onSignUp={() => { logout(); }}
            />
          )}
          <div className="flex items-center gap-4 px-6 h-14">
            <button
              onClick={toggleSidebar}
              className="w-8 h-8 flex items-center justify-center rounded-lg
                text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-lg"
              title="Toggle sidebar"
            >
              ☰
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-base text-gray-900 dark:text-gray-100">{title}</h1>
              {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
