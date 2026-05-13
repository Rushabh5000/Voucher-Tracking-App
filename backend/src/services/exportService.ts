import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { PrismaClient } from "@prisma/client";
import { buildAnalytics } from "./analyticsService";
import { Response } from "express";

const prisma = new PrismaClient();

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function effStatus(v: { status: string; expiryDate: Date | null }): string {
  if (v.status === "REDEEMED") return "REDEEMED";
  if (v.expiryDate && v.expiryDate < new Date()) return "EXPIRED";
  return "UNREDEEMED";
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

export async function generateExcel(res: Response): Promise<void> {
  const [vouchers, analytics] = await Promise.all([
    prisma.voucher.findMany({ orderBy: { dateAdded: "asc" } }),
    buildAnalytics(),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Voucher Tracker";
  wb.created = new Date();

  // ── Sheet 1: Vouchers (no Value column) ──────────────────────────────────
  const ws = wb.addWorksheet("Vouchers");

  const headers = ["Brand", "Title", "Voucher Code", "Source Card", "Issue Date", "Expiry Date", "Date Added", "Status", "Redeemed On"];
  const colWidths = [14, 26, 24, 24, 14, 14, 14, 14, 14];

  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell: any) => {
    cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A6B4A" } };
    cell.font   = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  ws.getRow(1).height = 26;
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const statusColors: Record<string, string> = {
    UNREDEEMED: "FFE1F5EE",
    REDEEMED:   "FFF1F0EC",
    EXPIRED:    "FFFAEEDA",
  };

  for (const v of vouchers) {
    const status = effStatus(v);
    const row = ws.addRow([
      v.brand,
      v.title || "",
      v.voucherCode,
      v.sourceProgramOrCard,
      fmtDate(v.issueDate),
      fmtDate(v.expiryDate),
      fmtDate(v.dateAdded),
      status,
      fmtDate(v.redeemedAt),
    ]);
    row.eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusColors[status] ?? "FFFFFFFF" } };
      cell.alignment = { vertical: "middle" };
    });
    row.height = 20;
  }

  // ── Sheet 2: Summary ───────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet("Dashboard Summary");
  const { summary, brandBreakdown } = analytics;

  ws2.getRow(1).values = ["Voucher Tracker — Dashboard Summary", ""];
  ws2.getRow(1).font = { bold: true, size: 13 };
  ws2.getRow(1).height = 24;

  const summaryData = [
    ["Metric", "Value"],
    ["Total Vouchers",       summary.total],
    ["Unredeemed",           summary.unredeemed],
    ["Redeemed",             summary.redeemed],
    ["Expired",              summary.expired],
    ["Expiring in 7 days",   analytics.expiringIn7Days],
    ["Expiring in 30 days",  analytics.expiringIn30Days],
  ];

  summaryData.forEach((rowData, i) => {
    const r = ws2.getRow(3 + i);
    r.values = rowData;
    if (i === 0) r.font = { bold: true };
  });
  ws2.getColumn(1).width = 26;
  ws2.getColumn(2).width = 14;

  // Brand breakdown
  ws2.getRow(12).values = ["Brand Breakdown", ""];
  ws2.getRow(12).font = { bold: true, size: 12 };
  ws2.getRow(13).values = ["Brand", "Total", "Unredeemed", "Redeemed", "Expired"];
  ws2.getRow(13).font = { bold: true };
  (ws2.getRow(13) as any).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A6B4A" } };
  ws2.getRow(13).font = { bold: true, color: { argb: "FFFFFFFF" } };

  brandBreakdown.forEach((b, i) => {
    ws2.getRow(14 + i).values = [b.brand, b.total, b.unredeemed, b.redeemed, b.expired];
  });

  // ── Sheet 3: Monthly Trend ────────────────────────────────────────────────
  const ws3 = wb.addWorksheet("Monthly Trend");
  ws3.getRow(1).values = ["Month", "Added", "Redeemed"];
  ws3.getRow(1).font = { bold: true };
  analytics.monthlyTrend.forEach((m, i) => {
    ws3.getRow(2 + i).values = [m.month, m.added, m.redeemed];
  });
  ws3.getColumn(1).width = 14;
  ws3.getColumn(2).width = 12;
  ws3.getColumn(3).width = 12;

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="voucher-tracker-${new Date().toISOString().split("T")[0]}.xlsx"`);
  await wb.xlsx.write(res);
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

export async function generatePDF(res: Response): Promise<void> {
  const [vouchers, analytics] = await Promise.all([
    prisma.voucher.findMany({ orderBy: { dateAdded: "asc" } }),
    buildAnalytics(),
  ]);

  // Use landscape A4 so tables fit without wrapping
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="voucher-tracker-${new Date().toISOString().split("T")[0]}.pdf"`);
  doc.pipe(res);

  const { summary, brandBreakdown, monthlyTrend } = analytics;

  const GREEN  = "#1A6B4A";
  const GRAY   = "#888787";
  const DARK   = "#1A1816";
  const LIGHT  = "#F7F5F2";
  const BORDER = "#E2DFD8";

  // Landscape A4: 841.89 x 595.28 — usable width after 36px margins each side
  const W   = doc.page.width - 72;
  const MID = doc.page.height - 60; // content must stay above this to avoid overflow into footer

  function pageFooter(pageNum: number, total: number) {
    // save/restore prevents the text cursor from drifting and creating blank overflow pages
    doc.save();
    doc.fillColor(GRAY).fontSize(8).font("Helvetica")
      .text(
        `Page ${pageNum} of ${total}  —  Generated by Voucher Tracker  —  ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`,
        36, doc.page.height - 24, { width: W, align: "center", lineBreak: false }
      );
    doc.restore();
  }

  function drawTableHeader(y: number, cols: number[], labels: string[]): number {
    doc.rect(36, y, W, 20).fill(GREEN);
    let x = 36;
    for (let i = 0; i < labels.length; i++) {
      doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold")
        .text(labels[i], x + 4, y + 5, { width: cols[i] - 8, align: "left", lineBreak: false });
      x += cols[i];
    }
    return y + 20;
  }

  function drawTableRow(y: number, cols: number[], cells: string[], rowIdx: number, rowH = 18): number {
    const bg = rowIdx % 2 === 0 ? "#FFFFFF" : LIGHT;
    doc.rect(36, y, W, rowH).fill(bg);
    let x = 36;
    for (let i = 0; i < cells.length; i++) {
      doc.fillColor(DARK).fontSize(8).font("Helvetica")
        .text(cells[i], x + 4, y + (rowH - 8) / 2, { width: cols[i] - 8, lineBreak: false, ellipsis: true });
      x += cols[i];
    }
    return y + rowH;
  }

  // ── Page 1: Cover + Summary stats ─────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 70).fill(GREEN);
  doc.fillColor("#fff").fontSize(22).font("Helvetica-Bold")
    .text("Voucher Tracker", 36, 18);
  doc.fontSize(11).font("Helvetica")
    .text(`Export Report  —  ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`, 36, 46);
  doc.fillColor(DARK);

  // Stat boxes
  const statItems = [
    { label: "Total",       value: String(summary.total) },
    { label: "Unredeemed",  value: String(summary.unredeemed), color: GREEN },
    { label: "Redeemed",    value: String(summary.redeemed) },
    { label: "Expired",     value: String(summary.expired), color: "#BA7517" },
    { label: "Expiring ≤7d",value: String(analytics.expiringIn7Days), color: analytics.expiringIn7Days > 0 ? "#B91C1C" : DARK },
  ];
  const bW = (W - statItems.length * 8) / statItems.length;
  let bx = 36, by = 84;
  for (const s of statItems) {
    doc.rect(bx, by, bW, 56).fill(LIGHT).stroke(BORDER);
    doc.fillColor(s.color || DARK).fontSize(24).font("Helvetica-Bold")
      .text(s.value, bx + 6, by + 8, { width: bW - 12 });
    doc.fillColor(GRAY).fontSize(9).font("Helvetica")
      .text(s.label, bx + 6, by + 38);
    bx += bW + 8;
  }

  let curY = by + 72;

  // ── Brand Breakdown table ─────────────────────────────────────────────────
  doc.fillColor(DARK).fontSize(12).font("Helvetica-Bold").text("Brand-wise Breakdown", 36, curY);
  curY += 18;

  const bCols = [W * 0.28, W * 0.18, W * 0.18, W * 0.18, W * 0.18];
  curY = drawTableHeader(curY, bCols, ["Brand", "Total", "Unredeemed", "Redeemed", "Expired"]);

  for (let i = 0; i < brandBreakdown.length; i++) {
    const b = brandBreakdown[i];
    if (curY + 18 > MID) {
      doc.addPage();
      curY = 36;
    }
    curY = drawTableRow(curY, bCols, [b.brand, String(b.total), String(b.unredeemed), String(b.redeemed), String(b.expired)], i);
  }

  // ── Monthly Trend table — same page if space, otherwise new page ──────────
  const trendNeeded = 20 + monthlyTrend.length * 16 + 28;
  if (curY + trendNeeded > MID) {
    doc.addPage();
    curY = 36;
  } else {
    curY += 20;
  }

  doc.fillColor(DARK).fontSize(12).font("Helvetica-Bold").text("Monthly Trend (Last 12 Months)", 36, curY);
  curY += 18;

  // Three equal columns, each row on one line
  const mColW = W / 3;
  const mCols = [mColW, mColW, mColW];
  curY = drawTableHeader(curY, mCols, ["Month", "Added", "Redeemed"]);
  for (let i = 0; i < monthlyTrend.length; i++) {
    const m = monthlyTrend[i];
    curY = drawTableRow(curY, mCols, [m.month, String(m.added), String(m.redeemed)], i, 16);
  }

  // ── Voucher detail table — always starts fresh ────────────────────────────
  doc.addPage();
  curY = 36;

  doc.fillColor(DARK).fontSize(12).font("Helvetica-Bold").text("All Vouchers", 36, curY);
  curY += 18;

  // No Value column. Status gets enough width to show UNREDEEMED without wrap.
  const vCols = [
    W * 0.13,  // Brand
    W * 0.22,  // Title / Code
    W * 0.22,  // Source
    W * 0.13,  // Issue Date
    W * 0.13,  // Expiry
    W * 0.17,  // Status  ← widest to avoid truncation
  ];
  const vHeaders = ["Brand", "Title / Code", "Source Card", "Issue Date", "Expiry", "Status"];

  curY = drawTableHeader(curY, vCols, vHeaders);

  for (let i = 0; i < vouchers.length; i++) {
    const v = vouchers[i];
    if (curY + 22 > MID) {
      doc.addPage();
      curY = 36;
      curY = drawTableHeader(curY, vCols, vHeaders); // repeat header on new page
    }
    const status = effStatus(v);
    const bg = status === "REDEEMED" ? "#F5F4F0" : status === "EXPIRED" ? "#FFFBE8" : (i % 2 === 0 ? "#FFFFFF" : LIGHT);
    const rowH = 22;
    doc.rect(36, curY, W, rowH).fill(bg);
    const cells = [
      v.brand,
      v.title ? `${v.title}\n${v.voucherCode}` : v.voucherCode,
      v.sourceProgramOrCard,
      fmtDate(v.issueDate),
      v.expiryDate ? fmtDate(v.expiryDate) : "None",
      status,
    ];
    let x = 36;
    for (let ci = 0; ci < cells.length; ci++) {
      const isCode = ci === 1 && cells[ci].includes("\n");
      if (isCode) {
        const parts = cells[ci].split("\n");
        doc.fillColor(DARK).fontSize(8).font("Helvetica-Bold")
          .text(parts[0], x + 4, curY + 4, { width: vCols[ci] - 8, lineBreak: false, ellipsis: true });
        doc.fillColor(GRAY).fontSize(7).font("Helvetica")
          .text(parts[1], x + 4, curY + 13, { width: vCols[ci] - 8, lineBreak: false, ellipsis: true });
      } else {
        const statusColor = ci === 5
          ? (status === "REDEEMED" ? "#5F5E5A" : status === "EXPIRED" ? "#854F0B" : GREEN)
          : DARK;
        const isBold = ci === 5;
        doc.fillColor(statusColor)
          .fontSize(8)
          .font(isBold ? "Helvetica-Bold" : "Helvetica")
          .text(cells[ci], x + 4, curY + 7, { width: vCols[ci] - 8, lineBreak: false, ellipsis: true });
      }
      x += vCols[ci];
    }
    curY += rowH;
  }

  // ── Page footers ──────────────────────────────────────────────────────────
  // Must call flushPages() before end() when using bufferPages:true
  // to prevent PDFKit from appending blank pages for the footer writes
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    pageFooter(i + 1, totalPages);
  }
  doc.flushPages();
  doc.end();
}

// ─── Master Excel Export — full DB dump ───────────────────────────────────────

export async function generateMasterExcel(res: Response): Promise<void> {
  const [vouchers, cards, analytics] = await Promise.all([
    prisma.voucher.findMany({ orderBy: { dateAdded: "asc" } }),
    prisma.card.findMany({ orderBy: { bank: "asc" } }),
    buildAnalytics(),
  ]);

  const autocompleteEntries = await prisma.autocompleteEntry.findMany({
    orderBy: [{ field: "asc" }, { count: "desc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Voucher Tracker";
  wb.created = new Date();

  const GREEN_HEADER = "FF1A6B4A";
  const WHITE_TEXT   = "FFFFFFFF";

  function applyHeader(row: ExcelJS.Row, color = GREEN_HEADER) {
    row.eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
      cell.font = { bold: true, color: { argb: WHITE_TEXT }, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
    });
    row.height = 24;
  }

  function setColWidths(ws: ExcelJS.Worksheet, widths: number[]) {
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  }

  // ── Sheet 1: Overview — card + voucher joined view ────────────────────────
  // Build a lookup map: cardName → card record (match on stored cardName field in voucher)
  const cardByName = new Map<string, typeof cards[0]>();
  for (const card of cards) {
    cardByName.set(card.cardName.toLowerCase(), card);
  }

  const wsO = wb.addWorksheet("Overview");
  applyHeader(wsO.addRow([
    "Account Owner", "Card Name", "Bank", "Email", "Mobile Number",
    "Voucher Brand", "Title", "Voucher Code", "Issue Date", "Expiry Date", "Status",
  ]));
  setColWidths(wsO, [22, 22, 20, 28, 16, 14, 26, 24, 14, 14, 14]);

  const statusBgO: Record<string, string> = {
    UNREDEEMED: "FFE1F5EE", REDEEMED: "FFF1F0EC", EXPIRED: "FFFAEEDA",
  };

  for (const v of vouchers) {
    const status = effStatus(v);
    // Try to find the card: first by cardName stored on voucher, then by sourceProgramOrCard
    const matchedCard =
      (v.cardName ? cardByName.get(v.cardName.toLowerCase()) : undefined) ??
      (v.sourceProgramOrCard ? cardByName.get(v.sourceProgramOrCard.toLowerCase()) : undefined);

    const row = wsO.addRow([
      matchedCard?.accountOwner ?? v.cardOwner   ?? "",
      matchedCard?.cardName     ?? v.cardName     ?? "",
      matchedCard?.bank         ?? "",
      matchedCard?.email        ?? v.emailId      ?? "",
      matchedCard?.mobileNumber ?? "",
      v.brand,
      v.title ?? "",
      v.voucherCode,
      fmtDate(v.issueDate),
      v.expiryDate ? fmtDate(v.expiryDate) : "None",
      status,
    ]);
    row.eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusBgO[status] ?? "FFFFFFFF" } };
      cell.alignment = { vertical: "middle" };
    });
    row.height = 18;
  }

  // ── Sheet 2: Vouchers ──────────────────────────────────────────────────────
  const wsV = wb.addWorksheet("Vouchers");
  applyHeader(wsV.addRow([
    "ID", "Brand", "Title", "Voucher Code", "Source Card",
    "Card Owner", "Card Name", "Issue Date", "Expiry Date",
    "Date Added", "Status", "Redeemed On", "Email", "Description",
  ]));
  setColWidths(wsV, [36, 14, 26, 24, 24, 20, 20, 14, 14, 14, 14, 14, 26, 36]);

  const statusBg: Record<string, string> = {
    UNREDEEMED: "FFE1F5EE", REDEEMED: "FFF1F0EC", EXPIRED: "FFFAEEDA",
  };
  for (const v of vouchers) {
    const status = effStatus(v);
    const row = wsV.addRow([
      v.id, v.brand, v.title, v.voucherCode, v.sourceProgramOrCard,
      v.cardOwner, v.cardName, fmtDate(v.issueDate), fmtDate(v.expiryDate),
      fmtDate(v.dateAdded), status, fmtDate(v.redeemedAt),
      v.emailId, v.description,
    ]);
    row.eachCell((cell: any) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusBg[status] ?? "FFFFFFFF" } };
    });
    row.height = 18;
  }

  // ── Sheet 3: Cards ─────────────────────────────────────────────────────────
  const wsC = wb.addWorksheet("Cards");
  applyHeader(wsC.addRow(["ID", "Account Owner", "Card Name", "Bank", "Last 4 Digits", "Email", "Mobile", "Created At"]));
  setColWidths(wsC, [36, 22, 22, 22, 14, 28, 16, 20]);
  for (const c of cards) {
    wsC.addRow([c.id, c.accountOwner, c.cardName, c.bank, c.lastFourDigits, c.email, c.mobileNumber, fmtDate(c.createdAt)]);
  }

  // ── Sheet 4: Brands ────────────────────────────────────────────────────────
  const wsBr = wb.addWorksheet("Brands");
  applyHeader(wsBr.addRow(["Brand", "Total", "Unredeemed", "Redeemed", "Expired"]));
  setColWidths(wsBr, [20, 10, 14, 12, 10]);
  for (const b of analytics.brandBreakdown) {
    wsBr.addRow([b.brand, b.total, b.unredeemed, b.redeemed, b.expired]);
  }

  // ── Sheet 5: Summary ───────────────────────────────────────────────────────
  const wsS = wb.addWorksheet("Summary");
  applyHeader(wsS.addRow(["Metric", "Value"]));
  setColWidths(wsS, [28, 16]);
  const { summary } = analytics;
  const summaryRows = [
    ["Total Vouchers",       summary.total],
    ["Unredeemed",           summary.unredeemed],
    ["Redeemed",             summary.redeemed],
    ["Expired",              summary.expired],
    ["Expiring in 7 days",   analytics.expiringIn7Days],
    ["Expiring in 30 days",  analytics.expiringIn30Days],
    ["Total Cards",          cards.length],
    ["Export Generated At",  new Date().toLocaleString("en-IN")],
  ];
  for (const [label, value] of summaryRows) {
    wsS.addRow([label, value]);
  }

  // ── Sheet 6: Monthly Trend ────────────────────────────────────────────────
  const wsT = wb.addWorksheet("Monthly Trend");
  applyHeader(wsT.addRow(["Month", "Added", "Redeemed"]));
  setColWidths(wsT, [14, 12, 12]);
  for (const m of analytics.monthlyTrend) {
    wsT.addRow([m.month, m.added, m.redeemed]);
  }

  // ── Sheet 7: Autocomplete Entries ──────────────────────────────────────────
  const wsA = wb.addWorksheet("Autocomplete");
  applyHeader(wsA.addRow(["Field", "Value", "Usage Count", "Created At"]));
  setColWidths(wsA, [22, 32, 14, 20]);
  for (const e of autocompleteEntries) {
    wsA.addRow([e.field, e.value, e.count, fmtDate(e.createdAt)]);
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="voucher-tracker-master-${new Date().toISOString().split("T")[0]}.xlsx"`);
  await wb.xlsx.write(res);
}
