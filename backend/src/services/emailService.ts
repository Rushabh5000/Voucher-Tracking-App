import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { PrismaClient } from "@prisma/client";
import { buildAnalytics } from "./analyticsService";

const prisma = new PrismaClient();

const LAST_SENT_KEY = "monthly_report_last_sent";

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || "smtp.gmail.com",
    port:   parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_PORT   === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ─── Persist last-sent timestamp ─────────────────────────────────────────────

async function getLastSentDate(): Promise<Date | null> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: LAST_SENT_KEY } });
    return row ? new Date(row.value) : null;
  } catch {
    return null;
  }
}

async function recordSentDate(date: Date): Promise<void> {
  await prisma.appSetting.upsert({
    where:  { key: LAST_SENT_KEY },
    update: { value: date.toISOString() },
    create: { key: LAST_SENT_KEY, value: date.toISOString() },
  });
}

// ─── Check on startup: send if overdue ───────────────────────────────────────

export async function checkAndSendIfOverdue(): Promise<void> {
  const recipient = process.env.REPORT_RECIPIENT;
  if (!recipient || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("[Email] SMTP not configured — skipping overdue check");
    return;
  }

  const lastSent = await getLastSentDate();
  const now      = new Date();

  if (!lastSent) {
    console.log("[Email] No monthly report has ever been sent — sending now…");
    await sendMonthlyReport();
    return;
  }

  const daysSince = (now.getTime() - lastSent.getTime()) / 86400000;
  const lastSentStr = lastSent.toLocaleDateString("en-IN", {
    day: "2-digit", month: "long", year: "numeric",
  });

  if (daysSince > 30) {
    console.log(
      `[Email] Last report sent ${Math.floor(daysSince)} days ago (${lastSentStr}) — overdue, sending now…`
    );
    await sendMonthlyReport();
  } else {
    console.log(
      `[Email] Last report sent ${Math.floor(daysSince)} day(s) ago (${lastSentStr}) — next report due in ${Math.ceil(30 - daysSince)} day(s)`
    );
  }
}

// ─── Build PDF buffer in memory ───────────────────────────────────────────────

async function buildPdfBuffer(): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const analytics = await buildAnalytics();
    const { summary, brandBreakdown, monthlyTrend } = analytics;

    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data",  (chunk: Buffer) => chunks.push(chunk));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const GREEN = "#1A6B4A";
    const W     = doc.page.width - 80;

    // Cover
    doc.rect(0, 0, doc.page.width, 80).fill(GREEN);
    doc.fillColor("#fff").fontSize(20).font("Helvetica-Bold")
      .text("Voucher Tracker — Monthly Summary", 40, 24);
    doc.fontSize(11).font("Helvetica")
      .text(new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" }), 40, 52);
    doc.fillColor("#1A1816").moveDown(3);

    // Summary stats
    const stats: Array<[string, string]> = [
      ["Total Vouchers",      String(summary.total)],
      ["Unredeemed",          String(summary.unredeemed)],
      ["Redeemed",            String(summary.redeemed)],
      ["Expired",             String(summary.expired)],
      ["Expiring in 7 days",  String(analytics.expiringIn7Days)],
      ["Expiring in 30 days", String(analytics.expiringIn30Days)],
    ];
    doc.fontSize(13).font("Helvetica-Bold").text("Summary");
    doc.moveDown(0.3);
    for (const [label, value] of stats) {
      doc.fontSize(11).font("Helvetica-Bold").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(value);
    }
    doc.moveDown(1);

    // Brand breakdown
    doc.fontSize(13).font("Helvetica-Bold").text("Brand Breakdown");
    doc.moveDown(0.3);
    for (const b of brandBreakdown.slice(0, 15)) {
      doc.fontSize(10).font("Helvetica").text(
        `  ${b.brand.padEnd(20)} Total: ${b.total}  Unredeemed: ${b.unredeemed}  Redeemed: ${b.redeemed}  Expired: ${b.expired}`
      );
    }
    doc.moveDown(1);

    // Monthly trend
    doc.fontSize(13).font("Helvetica-Bold").text("Monthly Trend");
    doc.moveDown(0.3);
    for (const m of monthlyTrend) {
      doc.fontSize(9).font("Helvetica").text(
        `  ${m.month.padEnd(10)}  Added: ${String(m.added).padEnd(6)}  Redeemed: ${m.redeemed}`
      );
    }

    // Page footers
    const pages = doc.bufferedPageRange();
    const totalPg = pages.count;
    for (let i = 0; i < totalPg; i++) {
      doc.switchToPage(i);
      doc.save();
      doc.fillColor("#999").fontSize(9).text(
        `Page ${i + 1} of ${totalPg} — Voucher Tracker`,
        40, doc.page.height - 30, { align: "center", lineBreak: false }
      );
      doc.restore();
    }
    doc.flushPages();
    doc.end();
  });
}

// ─── Send monthly report email ────────────────────────────────────────────────

export async function sendMonthlyReport(): Promise<void> {
  const recipient = process.env.REPORT_RECIPIENT;
  if (!recipient) {
    console.warn("[Email] REPORT_RECIPIENT not set — skipping email");
    return;
  }
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[Email] SMTP credentials not set — skipping email");
    return;
  }

  const analytics  = await buildAnalytics();
  const { summary } = analytics;
  const pdfBuffer  = await buildPdfBuffer();
  const transport  = createTransport();
  const month      = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  await transport.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME || "Voucher Tracker"}" <${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER}>`,
    to:   recipient,
    subject: `Voucher Tracker — Monthly Summary (${month})`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1A6B4A;color:#fff;padding:24px 28px;border-radius:8px 8px 0 0">
          <h2 style="margin:0;font-size:20px">Voucher Tracker Monthly Summary</h2>
          <p style="margin:4px 0 0;opacity:0.8;font-size:14px">${month}</p>
        </div>
        <div style="background:#f9f8f6;padding:24px 28px;border-radius:0 0 8px 8px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#666;font-size:14px">Total vouchers</td>
                <td style="padding:8px 0;font-weight:600;text-align:right">${summary.total}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:14px">Unredeemed</td>
                <td style="padding:8px 0;font-weight:600;color:#1A6B4A;text-align:right">${summary.unredeemed}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:14px">Redeemed</td>
                <td style="padding:8px 0;font-weight:600;text-align:right">${summary.redeemed}</td></tr>
            <tr><td style="padding:8px 0;color:#666;font-size:14px">Expired</td>
                <td style="padding:8px 0;font-weight:600;color:#92580A;text-align:right">${summary.expired}</td></tr>
          </table>
          <p style="margin-top:20px;font-size:12px;color:#999">
            Full report attached as PDF. Sent automatically by Voucher Tracker.
          </p>
        </div>
      </div>`,
    attachments: [{
      filename:    `voucher-report-${new Date().toISOString().split("T")[0]}.pdf`,
      content:     pdfBuffer,
      contentType: "application/pdf",
    }],
  });

  // Persist the sent timestamp so startup check works correctly
  await recordSentDate(new Date());
  console.log(`[Email] Monthly report sent to ${recipient}`);
}
