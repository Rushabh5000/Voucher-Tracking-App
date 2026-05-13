import { useState } from "react";
import { exportApi } from "@/api/client";
import toast from "react-hot-toast";

function ExportCard({ icon, title, description, buttonLabel, onClick, loading }: {
  icon: string; title: string; description: string;
  buttonLabel: string; onClick: () => void; loading: boolean;
}) {
  return (
    <div className="card p-6 flex flex-col gap-4">
      <div className="text-4xl">{icon}</div>
      <div>
        <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">{description}</div>
      </div>
      <button className="btn-primary mt-auto" onClick={onClick} disabled={loading}>
        {loading ? "Generating…" : buttonLabel}
      </button>
    </div>
  );
}

export function ExportPage() {
  const [sendingEmail, setSendingEmail] = useState(false);

  function downloadExcel() {
    window.open(exportApi.excel(), "_blank");
    toast.success("Export started");
  }

  function downloadMasterExcel() {
    window.open(exportApi.masterExcel(), "_blank");
    toast.success("Master export started");
  }

  function downloadPdf() {
    window.open(exportApi.pdf(), "_blank");
    toast.success("PDF file download started");
  }

  async function triggerEmail() {
    setSendingEmail(true);
    try {
      await exportApi.sendEmail();
      toast.success("Monthly summary email sent!");
    } catch {
      toast.error("Failed to send email. Check SMTP settings.");
    } finally {
      setSendingEmail(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Export your complete voucher inventory with dashboard summaries and charts.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ExportCard
          icon="📊"
          title="Excel Export"
          description="Vouchers, summary, and monthly trend. Color-coded by status."
          buttonLabel="Download Excel"
          onClick={downloadExcel}
          loading={false}
        />
        <ExportCard
          icon="🗄️"
          title="Master Export"
          description="Full database dump — vouchers, cards, brands, summary, trend, and autocomplete — across 6 sheets."
          buttonLabel="Download Master"
          onClick={downloadMasterExcel}
          loading={false}
        />
        <ExportCard
          icon="📄"
          title="PDF Report"
          description="Complete report with cover page, summary stats, brand breakdown table, monthly trend, and all vouchers."
          buttonLabel="Download PDF"
          onClick={downloadPdf}
          loading={false}
        />
        <ExportCard
          icon="📧"
          title="Email Report"
          description="Send a monthly summary email with the PDF report attached to your configured email address."
          buttonLabel="Send email now"
          onClick={triggerEmail}
          loading={sendingEmail}
        />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">
          Automatic monthly email
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          The app automatically sends a monthly summary on the last day of each month at 9:00 AM IST.
          Configure SMTP settings via environment variables:
        </p>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 font-mono text-xs text-gray-700 dark:text-gray-300 space-y-1">
          <div>SMTP_HOST=smtp.gmail.com</div>
          <div>SMTP_PORT=587</div>
          <div>SMTP_USER=your@gmail.com</div>
          <div>SMTP_PASS=your_app_password</div>
          <div>REPORT_RECIPIENT=your@gmail.com</div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          For Gmail, use an App Password (not your main password). See Google Account → Security → App Passwords.
        </p>
      </div>
    </div>
  );
}
