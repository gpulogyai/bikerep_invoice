import { jsPDF } from "jspdf";
import type { Invoice, ShopInfo } from "./types";
import { calculateTotals, localDate, round2 } from "./invoice";
import { monthlyIncome, summarizeIncome } from "./income";

export const REPORT_NOTE = "Paid invoices only, by local payment date (cash-basis sales summary). USD. Uses saved payment totals when available; older records use current invoice totals. Excludes unpaid invoices, expenses, deductions and refunds not recorded in the app. Sales tax is separate from sales income. Not a tax return or a TurboTax import file; review with your CPA.";
export const PRIVACY_NOTE = "Customer names, contact details and repair notes are omitted. Invoice numbers and financial totals are included.";

export function createTaxReport(invoices: Invoice[], year: number, shop: ShopInfo) {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) throw new Error("Choose a valid tax year.");
  const from = `${year}-01-01`, to = `${year}-12-31`;
  const rows = invoices.filter(i => {
    if (!i.paidAt) return false;
    const day = localDate(new Date(i.paidAt));
    return day >= from && day <= to;
  }).map(i => {
    const t = i.paymentTotals ?? calculateTotals(i);
    return { number: i.invoiceNumber, invoiceDate: i.date, paidDate: localDate(new Date(i.paidAt)),
      method: i.paymentMethod || "Unspecified", source: i.paymentTotals ? "Payment snapshot" : "Current invoice (legacy)",
      parts: t.parts, labor: t.labor, other: t.other, netSales: round2(t.total - t.tax), salesTax: t.tax, collected: t.total };
  }).sort((a, b) => a.paidDate.localeCompare(b.paidDate) || a.number.localeCompare(b.number));
  return { year, shop: shop.name || "Bike Shop", generated: new Date().toISOString(), rows,
    summary: summarizeIncome(invoices, from, to, 0), months: monthlyIncome(invoices, year, 0) };
}
export type TaxReport = ReturnType<typeof createTaxReport>;
const money = (n: number) => n.toFixed(2);
/** Quote every cell and neutralize spreadsheet formulas in user-controlled text. */
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
export function taxCSV(report: TaxReport): string {
  const records: (string | number)[][] = [
    ["Bike invoice tax-year sales report", report.year], ["Business", report.shop],
    ["Generated (UTC)", report.generated], ["Basis and limitations", REPORT_NOTE], ["Privacy", PRIVACY_NOTE], [],
    ["Annual summary", "Paid invoices", "Parts USD", "Labor USD", "Other USD", "Net sales USD", "Sales tax collected USD", "Total collected USD"],
    [report.year, report.summary.paidCount, ...[report.summary.parts, report.summary.labor, report.summary.other, report.summary.netSales, report.summary.salesTax, report.summary.collected].map(money)], [],
    ["Month", "Paid invoices", "Parts USD", "Labor USD", "Other USD", "Net sales USD", "Sales tax collected USD", "Total collected USD"],
    ...report.months.map(m => [m.month, m.paidCount, ...[m.parts, m.labor, m.other, m.netSales, m.salesTax, m.collected].map(money)]), [],
    ["Invoice number", "Invoice date", "Paid date", "Payment method", "Totals source", "Parts USD", "Labor USD", "Other USD", "Net sales USD", "Sales tax collected USD", "Total collected USD"],
    ...report.rows.map(r => [r.number, r.invoiceDate, r.paidDate, r.method, r.source, ...[r.parts, r.labor, r.other, r.netSales, r.salesTax, r.collected].map(money)]),
  ];
  return "\uFEFF" + records.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function taxPDF(report: TaxReport): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = 48;
  // Built-in PDF font is Latin: replace unsupported glyphs rather than emit corrupt text.
  const printable = (text: string) => text.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
  function line(text: string, size = 10) {
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(printable(text), 516);
    for (const part of lines) {
      if (y + size + 5 > 738) { doc.addPage(); y = 48; }
      doc.text(part, 48, y);
      y += size + 5;
    }
  }
  line(`Tax-year sales report | ${report.year}`, 18);
  line(report.shop, 14);
  line(`Generated: ${report.generated}`);
  line(REPORT_NOTE); line(PRIVACY_NOTE); y += 10;
  line("Annual totals (USD)", 14);
  const s = report.summary;
  line(`Paid invoices: ${s.paidCount}`);
  line(`Parts: ${money(s.parts)} | Labor: ${money(s.labor)} | Other: ${money(s.other)}`);
  line(`Net sales before expenses: ${money(s.netSales)}`);
  line(`Sales tax collected: ${money(s.salesTax)} | Total collected: ${money(s.collected)}`);
  y += 10; line("Monthly totals (USD)", 14);
  for (const m of report.months) line(`${m.month}: ${m.paidCount} paid | Net sales ${money(m.netSales)} | Sales tax ${money(m.salesTax)} | Collected ${money(m.collected)}`);
  y += 10; line("Paid invoice detail (USD)", 14);
  if (!report.rows.length) line("No paid invoices in this tax year.");
  for (const r of report.rows) {
    if (y > 650) { doc.addPage(); y = 48; line("Paid invoice detail (continued)", 14); }
    line(`#${r.number} | Invoice ${r.invoiceDate} | Paid ${r.paidDate} | ${r.method}`);
    line(`Parts ${money(r.parts)} | Labor ${money(r.labor)} | Other ${money(r.other)}`);
    line(`Net sales ${money(r.netSales)} | Sales tax ${money(r.salesTax)} | Collected ${money(r.collected)}`);
    line(`Source: ${r.source}`, 9); y += 6;
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(9);
    doc.text(`${report.year} | USD | Page ${p} of ${pages}`, 48, 766);
  }
  return doc.output("blob");
}
