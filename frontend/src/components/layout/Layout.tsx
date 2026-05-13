import React from "react";
import { Sidebar } from "./Sidebar";
import { useUIStore } from "@/store/uiStore";

interface LayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function Layout({ title, subtitle, actions, children }: LayoutProps) {
  const { sidebarOpen, toggleSidebar } = useUIStore();

  const marginLeft = `${sidebarOpen ? 224 : 64}px`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />

      {/* Main content */}
      <div
        className="transition-all duration-200 min-h-screen"
        style={{ marginLeft }}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
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

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
