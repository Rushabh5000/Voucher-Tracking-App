import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import { buildAnalytics } from "./analyticsService";
import { prisma } from "../db";

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

    const GREEN  = "#1A6B4A";
    const AMBER  = "#D97706";
    const RED    = "#B91C1C";
    const SLATE  = "#6B7280";
    const GRAY   = "#888787";
    const DARK   = "#1A1816";
    const LIGHT  = "#F7F5F2";
    const BORDER = "#E2DFD8";
    const L      = 40;
    const W      = doc.page.width - 80;   // 515.28 for A4
    const PGBOT  = doc.page.height - 50;
    const month  = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

    // ── helpers ────────────────────────────────────────────────────────────────

    function sectionHeading(text: string, y: number): number {
      doc.fillColor(DARK).fontSize(12).font("Helvetica-Bold").text(text, L, y);
      doc.moveTo(L, y + 15).lineTo(L + W, y + 15).lineWidth(0.5).strokeColor(BORDER).stroke();
      return y + 23;
    }

    function tableHeader(y: number, cols: number[], labels: string[]): number {
      doc.rect(L, y, W, 20).fill(GREEN);
      let x = L;
      for (let i = 0; i < labels.length; i++) {
        doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold")
          .text(labels[i], x + 4, y + 6, { width: cols[i] - 8, lineBreak: false });
        x += cols[i];
      }
      return y + 20;
    }

    function tableRow(y: number, cols: number[], cells: string[], idx: number, h = 18): number {
      doc.rect(L, y, W, h).fill(idx % 2 === 0 ? "#FFFFFF" : LIGHT);
      let x = L;
      for (let i = 0; i < cells.length; i++) {
        doc.fillColor(DARK).fontSize(8).font("Helvetica")
          .text(cells[i], x + 4, y + (h - 8) / 2, { width: cols[i] - 8, lineBreak: false, ellipsis: true });
        x += cols[i];
      }
      return y + h;
    }

    // Donut chart drawn with SVG arc paths — no extra dependencies
    function drawDonut(cx: number, cy: number, r: number): void {
      const segs = [
        { value: summary.unredeemed, color: GREEN },
        { value: summary.redeemed,   color: SLATE },
        { value: summary.expired,    color: AMBER },
      ];
      if (summary.total === 0) {
        doc.circle(cx, cy, r).fill(LIGHT);
      } else {
        let angle = -Math.PI / 2;
        for (const seg of segs) {
          if (seg.value === 0) continue;
          const sweep = (seg.value / summary.total) * 2 * Math.PI;
          const end   = angle + sweep;
          const x1    = cx + r * Math.cos(angle);
          const y1    = cy + r * Math.sin(angle);
          const x2    = cx + r * Math.cos(end);
          const y2    = cy + r * Math.sin(end);
          const large = sweep > Math.PI ? 1 : 0;
          doc.path(`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`).fill(seg.color);
          angle = end;
        }
      }
      // Donut hole
      doc.circle(cx, cy, r * 0.54).fill("#FFFFFF");
      // Center label
      doc.fillColor(DARK).fontSize(18).font("Helvetica-Bold")
        .text(String(summary.total), cx - 20, cy - 13, { width: 40, align: "center", lineBreak: false });
      doc.fillColor(GRAY).fontSize(7).font("Helvetica")
        .text("TOTAL", cx - 20, cy + 7, { width: 40, align: "center", lineBreak: false });
    }

    function hBar(y: number, label: string, val: number, maxVal: number, color: string): number {
      const LABEL_W = W * 0.32;
      const BAR_MAX = W * 0.50;
      const barW    = maxVal > 0 ? (val / maxVal) * BAR_MAX : 0;
      doc.fillColor(DARK).fontSize(8).font("Helvetica")
        .text(label, L, y + 3, { width: LABEL_W, lineBreak: false, ellipsis: true });
      if (barW > 0) doc.rect(L + LABEL_W + 4, y, barW, 14).fill(color);
      doc.fillColor(DARK).fontSize(8).font("Helvetica-Bold")
        .text(String(val), L + LABEL_W + barW + 10, y + 3, { lineBreak: false });
      return y + 18;
    }

    function drawBarChart(x0: number, y0: number, cW: number, cH: number): void {
      const maxVal = Math.max(...monthlyTrend.map(m => Math.max(m.added, m.redeemed)), 1);
      const n      = monthlyTrend.length;
      const groupW = cW / n;
      const barW   = Math.max(groupW * 0.28, 3);

      // Baseline
      doc.moveTo(x0, y0 + cH).lineTo(x0 + cW, y0 + cH).lineWidth(0.5).strokeColor(BORDER).stroke();

      // Grid lines
      for (let g = 1; g <= 4; g++) {
        const gy = y0 + cH - (g / 4) * cH;
        doc.moveTo(x0, gy).lineTo(x0 + cW, gy).lineWidth(0.3).strokeColor(BORDER).stroke();
        doc.fillColor(GRAY).fontSize(6).font("Helvetica")
          .text(String(Math.round((g / 4) * maxVal)), x0 - 18, gy - 3, { width: 16, align: "right", lineBreak: false });
      }

      for (let i = 0; i < n; i++) {
        const m  = monthlyTrend[i];
        const gx = x0 + i * groupW + groupW * 0.12;

        const aH = (m.added / maxVal) * cH;
        if (aH > 0) doc.rect(gx, y0 + cH - aH, barW, aH).fill(GREEN);

        const rH = (m.redeemed / maxVal) * cH;
        if (rH > 0) doc.rect(gx + barW + 2, y0 + cH - rH, barW, rH).fill(AMBER);

        doc.fillColor(GRAY).fontSize(5.5).font("Helvetica")
          .text(m.month, x0 + i * groupW, y0 + cH + 4, { width: groupW, align: "center", lineBreak: false });
      }

      // Legend
      const lgX = x0 + cW - 80;
      const lgY = y0 + 4;
      doc.rect(lgX, lgY, 8, 8).fill(GREEN);
      doc.fillColor(DARK).fontSize(7).font("Helvetica").text("Added", lgX + 11, lgY + 1, { lineBreak: false });
      doc.rect(lgX, lgY + 13, 8, 8).fill(AMBER);
      doc.fillColor(DARK).fontSize(7).font("Helvetica").text("Redeemed", lgX + 11, lgY + 14, { lineBreak: false });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 1 — Header + stat boxes + status overview + brand breakdown
    // ══════════════════════════════════════════════════════════════════════════

    // Header banner
    doc.rect(0, 0, doc.page.width, 72).fill(GREEN);
    doc.fillColor("#fff").fontSize(20).font("Helvetica-Bold")
      .text("Voucher Tracker — Monthly Summary", L, 20);
    doc.fontSize(11).font("Helvetica").text(month, L, 48);

    // Stat boxes
    const statItems = [
      { label: "Total",         value: summary.total,              color: DARK  },
      { label: "Unredeemed",    value: summary.unredeemed,         color: GREEN },
      { label: "Redeemed",      value: summary.redeemed,           color: DARK  },
      { label: "Expired",       value: summary.expired,            color: AMBER },
      { label: "Expiring ≤30d", value: analytics.expiringIn30Days, color: analytics.expiringIn30Days > 0 ? RED : DARK },
    ];
    const boxW = (W - (statItems.length - 1) * 6) / statItems.length;
    let bx = L;
    for (const s of statItems) {
      doc.rect(bx, 84, boxW, 52).fillAndStroke(LIGHT, BORDER);
      doc.fillColor(s.color).fontSize(22).font("Helvetica-Bold")
        .text(String(s.value), bx + 6, 91, { width: boxW - 12 });
      doc.fillColor(GRAY).fontSize(8).font("Helvetica")
        .text(s.label, bx + 6, 117);
      bx += boxW + 6;
    }

    let curY = 152;

    // ── Status Overview: donut + legend ──────────────────────────────────────
    curY = sectionHeading("Status Overview", curY);

    const donutCX = L + 88;
    const donutCY = curY + 70;
    drawDonut(donutCX, donutCY, 62);

    const legItems = [
      { label: "Unredeemed", value: summary.unredeemed, color: GREEN },
      { label: "Redeemed",   value: summary.redeemed,   color: SLATE },
      { label: "Expired",    value: summary.expired,    color: AMBER },
    ];
    const legX = L + 200;
    let legY   = curY + 16;
    for (const item of legItems) {
      const pct = summary.total > 0 ? Math.round((item.value / summary.total) * 100) : 0;
      doc.rect(legX, legY, 10, 10).fill(item.color);
      doc.fillColor(item.color).fontSize(13).font("Helvetica-Bold")
        .text(String(item.value), legX + 14, legY - 1, { lineBreak: false });
      doc.fillColor(GRAY).fontSize(8).font("Helvetica")
        .text(`${item.label}  (${pct}%)`, legX + 14, legY + 14, { lineBreak: false });
      legY += 38;
    }

    if (analytics.expiringIn7Days > 0) {
      legY += 4;
      doc.rect(legX, legY, W - 200, 26).fillAndStroke("#FEF2F2", "#FECACA");
      doc.fillColor(RED).fontSize(9).font("Helvetica-Bold")
        .text(`! ${analytics.expiringIn7Days} voucher(s) expiring within 7 days`, legX + 8, legY + 8, { width: W - 216, lineBreak: false });
    }

    curY = donutCY + 62 + 22;

    // ── Brand Breakdown ───────────────────────────────────────────────────────
    curY = sectionHeading("Brand Breakdown", curY);

    const maxBrand = Math.max(...brandBreakdown.map(b => b.total), 1);
    for (const b of brandBreakdown) {
      if (curY + 18 > PGBOT) { doc.addPage(); curY = 40; }
      curY = hBar(curY, b.brand, b.total, maxBrand, GREEN);
    }

    curY += 10;

    const bCols = [W * 0.28, W * 0.18, W * 0.18, W * 0.18, W * 0.18];
    if (curY + 24 > PGBOT) { doc.addPage(); curY = 40; }
    curY = tableHeader(curY, bCols, ["Brand", "Total", "Unredeemed", "Redeemed", "Expired"]);
    for (let i = 0; i < brandBreakdown.length; i++) {
      if (curY + 18 > PGBOT) {
        doc.addPage(); curY = 40;
        curY = tableHeader(curY, bCols, ["Brand", "Total", "Unredeemed", "Redeemed", "Expired"]);
      }
      const b = brandBreakdown[i];
      curY = tableRow(curY, bCols, [b.brand, String(b.total), String(b.unredeemed), String(b.redeemed), String(b.expired)], i);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PAGE 2 — Monthly trend chart + table
    // ══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    curY = 40;

    curY = sectionHeading("Monthly Trend — Last 12 Months", curY);

    const chartH = 150;
    drawBarChart(L + 20, curY, W - 20, chartH);
    curY += chartH + 32;

    const mCols = [W / 3, W / 3, W / 3];
    curY = tableHeader(curY, mCols, ["Month", "Added", "Redeemed"]);
    for (let i = 0; i < monthlyTrend.length; i++) {
      const m = monthlyTrend[i];
      curY = tableRow(curY, mCols, [m.month, String(m.added), String(m.redeemed)], i, 16);
    }

    // ── Page footers ──────────────────────────────────────────────────────────
    const range    = doc.bufferedPageRange();
    const totalPgs = range.count;
    for (let i = 0; i < totalPgs; i++) {
      doc.switchToPage(i);
      doc.save();
      doc.fillColor(GRAY).fontSize(8).font("Helvetica")
        .text(
          `Page ${i + 1} of ${totalPgs}  —  Voucher Tracker  —  ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`,
          L, doc.page.height - 24, { width: W, align: "center", lineBreak: false }
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
