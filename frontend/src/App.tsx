import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { useUIStore }     from "@/store/uiStore";
import { useVoucherStore } from "@/store/voucherStore";
import { useCardStore }   from "@/store/cardStore";
import { Layout }         from "@/components/layout/Layout";
import { AddVoucherModal }  from "@/components/vouchers/AddVoucherModal";
import { EditVoucherModal } from "@/components/vouchers/EditVoucherModal";
import { GetVoucherModal }  from "@/components/vouchers/GetVoucherModal";
import { DashboardPage }  from "@/pages/DashboardPage";
import { VouchersPage }   from "@/pages/VouchersPage";
import { CardsPage }      from "@/pages/CardsPage";
import { AnalyticsPage }  from "@/pages/AnalyticsPage";
import { ExportPage }     from "@/pages/ExportPage";
import { AuditPage }     from "@/pages/AuditPage";
import { SettingsPage }   from "@/pages/SettingsPage";
import { WordCloudPage }  from "@/pages/WordCloudPage";
import { useState }       from "react";

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Your voucher overview" },
  vouchers:  { title: "My vouchers", subtitle: "All claimed vouchers, oldest first" },
  cards:     { title: "Cards", subtitle: "Manage your credit and debit cards" },
  analytics: { title: "Analytics", subtitle: "Charts and trends" },
  wordcloud: { title: "Brand Cloud", subtitle: "All brands — click one to explore its vouchers" },
  export:    { title: "Export", subtitle: "Excel, PDF, and email reports" },
  audit:     { title: "Audit Log", subtitle: "Every API call, recorded" },
  settings:  { title: "Settings" },
};

export default function App() {
  const { activePage } = useUIStore();
  const { load: loadVouchers } = useVoucherStore();
  const { load: loadCards }    = useCardStore();

  const [addOpen, setAddOpen] = useState(false);
  const [getOpen, setGetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string>("");

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

  useEffect(() => {
    loadVouchers();
    loadCards();
  }, []);

  const meta = PAGE_TITLES[activePage] ?? { title: activePage };

  const pageActions =
    activePage === "dashboard" || activePage === "vouchers" || activePage === "wordcloud" ? (
      <div className="flex gap-2">
        <button className="btn-secondary text-sm" onClick={() => setGetOpen(true)}>🎫 Get voucher</button>
        <button className="btn-primary text-sm"   onClick={() => setAddOpen(true)}>+ Add voucher</button>
      </div>
    ) : activePage === "cards" ? (
      null // CardsPage has its own button
    ) : null;

  return (
    <>
      <Layout title={meta.title} subtitle={meta.subtitle} actions={pageActions}>
        {activePage === "dashboard" && <DashboardPage onAddVoucher={() => setAddOpen(true)} onGetVoucher={() => setGetOpen(true)} onEditVoucher={(id) => { setEditingVoucherId(id); setEditOpen(true); }} />}
        {activePage === "vouchers"  && <VouchersPage  onAdd={() => setAddOpen(true)} onGetVoucher={() => setGetOpen(true)} onEdit={(id) => { setEditingVoucherId(id); setEditOpen(true); }} />}
        {activePage === "wordcloud" && <WordCloudPage onEdit={(id) => { setEditingVoucherId(id); setEditOpen(true); }} />}
        {activePage === "cards"     && <CardsPage />}
        {activePage === "analytics" && <AnalyticsPage />}
        {activePage === "export"    && <ExportPage />}
        {activePage === "audit"     && <AuditPage />}
        {activePage === "settings"  && <SettingsPage />}
      </Layout>

      <AddVoucherModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditVoucherModal open={editOpen} onClose={() => { setEditOpen(false); setEditingVoucherId(""); }} voucherId={editingVoucherId} />
      <GetVoucherModal open={getOpen} onClose={() => setGetOpen(false)} />

      <Toaster
        position="bottom-right"
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
    </>
  );
}
