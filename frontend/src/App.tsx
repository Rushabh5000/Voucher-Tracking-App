import { useEffect, useState, lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore }   from "@/store/authStore";
import { useVoucherStore } from "@/store/voucherStore";
import { useCardStore }   from "@/store/cardStore";
import { Layout }         from "@/components/layout/Layout";
import { ConnectionGate } from "@/components/layout/ConnectionGate";
import { AddVoucherModal }  from "@/components/vouchers/AddVoucherModal";
import { EditVoucherModal } from "@/components/vouchers/EditVoucherModal";
import { GetVoucherModal }  from "@/components/vouchers/GetVoucherModal";
import { VoucherDetailModal } from "@/components/vouchers/VoucherDetailModal";
import { DashboardPage }  from "@/pages/DashboardPage";
import { VouchersPage }   from "@/pages/VouchersPage";
import { CardsPage }      from "@/pages/CardsPage";
import { CardStatsPage }  from "@/pages/CardStatsPage";
import { PAGE_PATHS, pageForPath } from "@/utils/routes";

// Lazy-loaded: pulls in the `xlsx` library (~350KB gzipped), so it's kept out
// of the main bundle and only fetched when the user opens Card Vault.
const CardVaultPage = lazy(() =>
  import("@/pages/CardVaultPage").then((m) => ({ default: m.CardVaultPage }))
);
import { AnalyticsPage }  from "@/pages/AnalyticsPage";
import { ExportPage }     from "@/pages/ExportPage";
import { AuditPage }      from "@/pages/AuditPage";
import { SettingsPage }   from "@/pages/SettingsPage";
import { LoginPage }      from "@/pages/LoginPage";
import { RegisterPage }   from "@/pages/RegisterPage";
import { WordCloudPage }  from "@/pages/WordCloudPage";

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Your voucher overview" },
  vouchers:  { title: "My vouchers", subtitle: "All claimed vouchers, oldest first" },
  wordcloud: { title: "Brand Cloud", subtitle: "Vouchers grouped by brand" },
  cards:     { title: "Cards Summary", subtitle: "Manage your credit and debit cards" },
  cardvault: { title: "Card Vault", subtitle: "Full card details, stored only in your local Excel file — never online" },
  cardstats: { title: "Card Stats", subtitle: "Compare recurring vouchers across cards, spot what's pending" },
  analytics: { title: "Analytics", subtitle: "Charts and trends" },
  export:    { title: "Export", subtitle: "Excel, PDF, and email reports" },
  audit:     { title: "Audit Log", subtitle: "Every API call, recorded" },
  settings:  { title: "Settings" },
};

export default function App() {
  const { token, role, guestExpiresAt, logout } = useAuthStore();
  const { pathname } = useLocation();
  const activePage = pageForPath(pathname);
  const { load: loadVouchers, loaded, loading, error } = useVoucherStore();
  const { load: loadCards }    = useCardStore();

  const [authView, setAuthView] = useState<"login" | "register">("login");
  const [addOpen, setAddOpen] = useState(false);
  const [getOpen, setGetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string>("");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingVoucherId, setViewingVoucherId] = useState<string>("");
  const openView = (id: string) => { setViewingVoucherId(id); setViewOpen(true); };
  const openEdit = (id: string) => { setEditingVoucherId(id); setEditOpen(true); };

  // Apply saved theme on mount
  useEffect(() => {
    const stored = localStorage.getItem("vt-ui");
    if (stored) {
      try {
        const { state } = JSON.parse(stored);
        if (state?.theme === "dark") document.documentElement.classList.add("dark");
      } catch {}
    }
  }, []);

  // Load data whenever the token changes
  useEffect(() => {
    if (!token) return;
    loadVouchers();
    loadCards();
  }, [token]);

  // Auto-logout when guest session expires
  useEffect(() => {
    if (!guestExpiresAt || role !== "guest") return;
    const diff = new Date(guestExpiresAt).getTime() - Date.now();
    if (diff <= 0) { logout(); return; }
    const id = setTimeout(logout, diff);
    return () => clearTimeout(id);
  }, [guestExpiresAt, role]);

  const toaster = (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: "var(--toast-bg, #fff)",
          color: "#1A1816",
          borderRadius: "10px",
          border: "1px solid #E2DFD8",
          fontSize: "13px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        },
      }}
    />
  );

  if (!token) {
    // Mount the Toaster here too — Login/Register errors need somewhere to
    // render; without this, toast.error() calls before login are silently lost.
    if (authView === "register") {
      return <><RegisterPage onShowLogin={() => setAuthView("login")} />{toaster}</>;
    }
    return <><LoginPage onShowRegister={() => setAuthView("register")} />{toaster}</>;
  }

  const meta = PAGE_TITLES[activePage] ?? { title: activePage };

  const pageActions =
    activePage === "dashboard" || activePage === "vouchers" ? (
      <div className="flex gap-2">
        <button className="btn-secondary text-sm" onClick={() => setGetOpen(true)}>🎫 Get voucher</button>
        <button className="btn-primary text-sm"   onClick={() => setAddOpen(true)}>+ Add voucher</button>
      </div>
    ) : activePage === "cards" ? null : null;

  // Every page except Card Vault (which is fully offline and must never
  // wait on, or be blocked by, backend voucher/card loading) waits behind
  // the connection gate until the initial data load succeeds.
  const gated = (el: JSX.Element) =>
    !loaded ? <ConnectionGate loading={loading} error={error} onRetry={loadVouchers} /> : el;

  return (
    <>
      <Layout title={meta.title} subtitle={meta.subtitle} actions={loaded || activePage === "cardvault" ? pageActions : null}>
        <Routes>
          <Route
            path={PAGE_PATHS.cardvault}
            element={
              <Suspense fallback={<div className="card p-10 text-center text-sm text-gray-400">Loading Card Vault…</div>}>
                <CardVaultPage />
              </Suspense>
            }
          />
          <Route path={PAGE_PATHS.dashboard} element={gated(<DashboardPage onAddVoucher={() => setAddOpen(true)} onGetVoucher={() => setGetOpen(true)} onEditVoucher={openEdit} onViewVoucher={openView} />)} />
          <Route path={PAGE_PATHS.vouchers}  element={gated(<VouchersPage  onAdd={() => setAddOpen(true)} onGetVoucher={() => setGetOpen(true)} onEdit={openEdit} onView={openView} />)} />
          <Route path={PAGE_PATHS.wordcloud} element={gated(<WordCloudPage onEdit={openEdit} />)} />
          <Route path={PAGE_PATHS.cards}     element={gated(<CardsPage onEditVoucher={openEdit} />)} />
          <Route path={PAGE_PATHS.cardstats} element={gated(<CardStatsPage />)} />
          <Route path={PAGE_PATHS.analytics} element={gated(<AnalyticsPage />)} />
          <Route path={PAGE_PATHS.export}    element={gated(<ExportPage />)} />
          <Route path={PAGE_PATHS.audit}     element={gated(<AuditPage />)} />
          <Route path={PAGE_PATHS.settings}  element={gated(<SettingsPage />)} />
          <Route path="*" element={<Navigate to={PAGE_PATHS.dashboard} replace />} />
        </Routes>
      </Layout>

      <AddVoucherModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditVoucherModal open={editOpen} onClose={() => { setEditOpen(false); setEditingVoucherId(""); }} voucherId={editingVoucherId} />
      <VoucherDetailModal open={viewOpen} onClose={() => { setViewOpen(false); setViewingVoucherId(""); }} voucherId={viewingVoucherId} onEdit={openEdit} />
      <GetVoucherModal open={getOpen} onClose={() => setGetOpen(false)} />

      {toaster}
    </>
  );
}
