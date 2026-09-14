import { useState } from "react";
import "./app.css";
import type { Invoice } from "./types";
import { blankInvoice, calculateTotals, deleteInvoice, formatMoney, loadInvoices, saveInvoice } from "./invoice";
import InvoiceForm from "./components/InvoiceForm";
import InvoicePreview from "./components/InvoicePreview";

export default function App() {
  const [saved, setSaved] = useState<Invoice[]>(() => loadInvoices());
  const [invoice, setInvoice] = useState<Invoice>(() => blankInvoice(saved.length));
  const [tab, setTab] = useState<"edit" | "preview" | "saved">("edit");
  const [status, setStatus] = useState("");

  const onSave = () => {
    setSaved(saveInvoice(invoice));
    setStatus(`Saved invoice #${invoice.invoiceNumber}`);
  };
  const onNew = () => {
    setInvoice(blankInvoice(saved.length));
    setTab("edit");
    setStatus("");
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Bike Shop Invoices</h1>
        <nav role="tablist">
          {(["edit", "preview", "saved"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t === "edit" ? "Edit" : t === "preview" ? "Preview" : `Saved (${saved.length})`}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === "edit" && <InvoiceForm invoice={invoice} setInvoice={setInvoice} />}
        {tab === "preview" && <InvoicePreview invoice={invoice} />}
        {tab === "saved" && (
          <ul className="card saved">
            {saved.length === 0 && <li>No saved invoices yet.</li>}
            {saved.map((inv) => (
              <li key={inv.id}>
                <button
                  className="link"
                  onClick={() => {
                    setInvoice(inv);
                    setTab("edit");
                  }}
                >
                  #{inv.invoiceNumber} · {inv.customerName || "No name"} ·{" "}
                  {formatMoney(calculateTotals(inv).total)}
                </button>
                <button
                  className="icon"
                  aria-label={`Delete invoice ${inv.invoiceNumber}`}
                  onClick={() => setSaved(deleteInvoice(inv.id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="actions">
        <span role="status">{status}</span>
        <button className="secondary" onClick={onNew}>New</button>
        {tab === "preview" && <button className="secondary" onClick={() => window.print()}>Print</button>}
        <button onClick={onSave}>Save</button>
      </footer>
    </div>
  );
}
