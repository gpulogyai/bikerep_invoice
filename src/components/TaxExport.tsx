import { useState } from "react";
import type { Invoice, ShopInfo } from "../types";
import { localDate, storageDamaged } from "../invoice";
import { createTaxReport, taxCSV, taxPDF } from "../taxExport";
import { shareReport } from "../shareReport";

export default function TaxExport({ invoices, shop }: { invoices: Invoice[]; shop: ShopInfo }) {
  const now = new Date().getFullYear();
  const [year, setYear] = useState(now);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const damaged = storageDamaged();
  const years = [...new Set([now, now - 1, ...invoices.filter(i => i.paidAt).map(i => Number(localDate(new Date(i.paidAt)).slice(0, 4)))])]
    .filter(y => Number.isInteger(y) && y >= 1900 && y <= 9999).sort((a, b) => b - a);
  const count = createTaxReport(invoices, year, shop).rows.length;
  async function exportReport(format: "csv" | "pdf") {
    if (busy || damaged) return;
    setBusy(true); setError(""); setStatus("");
    try {
      const report = createTaxReport(invoices, year, shop);
      const blob = format === "csv" ? new Blob([taxCSV(report)], { type: "text/csv;charset=utf-8" }) : taxPDF(report);
      const result = await shareReport(blob, `bike-sales-tax-${year}.${format}`);
      setStatus(result === "cancelled" ? "Sharing cancelled. You can export again." : result === "downloaded" ? "Report downloaded. Attach it to a message or send it to your accountant." : "Share sheet closed. Check your chosen app for delivery.");
    } catch { setError("The report could not be exported or shared. Please try again."); }
    finally { setBusy(false); }
  }
  return <section className="tax-export" aria-labelledby="tax-export-title">
    <h3 id="tax-export-title">Export &amp; share</h3>
    <p>Tax-year sales reports for your accountant or Excel.</p>
    <label>Tax year
      <select aria-label="Export tax year" value={year} disabled={busy} onChange={e => { setYear(Number(e.target.value)); setStatus(""); setError(""); }}>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
    <p className="muted">{count} paid invoice{count === 1 ? "" : "s"} in {year}. Full calendar year, independent of the Income period above.</p>
    {!count && <p className="hint">No payments in this year. Reports will show zero totals.</p>}
    <div className="export-buttons">
      <button type="button" disabled={busy || damaged} onClick={() => void exportReport("csv")}>Export CSV (accountant / Excel)</button>
      <button type="button" className="secondary" disabled={busy || damaged} onClick={() => void exportReport("pdf")}>Export PDF sales report</button>
    </div>
    <p className="hint">Both reports include annual and monthly totals plus paid-invoice detail: parts, labor, other charges, net sales, sales tax collected and total collected (USD). Counted by local payment date. Customer names and contact details stay private.</p>
    <p className="hint">Share to Mail, Messages, Files or another available app on iPhone; download where sharing is unavailable. Reports contain financial information—share only with people you trust.</p>
    <p className="hint">Not a tax return or direct TurboTax import. Expenses, deductions and unrecorded refunds are not tracked. Review with your CPA before filing.</p>
    {damaged && <p role="alert">Export unavailable: some stored records are unreadable. Recover them before exporting to avoid incomplete tax totals.</p>}
    {busy && <p role="status">Preparing report and opening share options…</p>}
    {status && <p role="status">{status}</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
