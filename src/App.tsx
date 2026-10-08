import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import "./app.css";
import type { Invoice, OwnerSettings, ShopInfo } from "./types";
import {
  newInvoice,
  deleteInvoiceSafely,
  exportInvoiceBackup,
  importInvoiceBackup,
  storageDamaged,
  normalizeInvoice,
  calculateTotals,
  loadInvoices,
  loadOwner,
  loadShop,
  saveInvoiceSafely,
  saveOwner,
  saveShop,
} from "./invoice";
import InvoiceForm from "./components/InvoiceForm";
import InvoicePreview from "./components/InvoicePreview";
import SendPanel from "./components/SendPanel";
import SettingsPanel from "./components/SettingsPanel";
import FaceIDGate from "./components/FaceIDGate";
import { useIncomeAccess } from "./useIncomeAccess";
import IncomePanel from "./components/IncomePanel";
import OrdersPanel from "./components/OrdersPanel";
import { loadLists, saveLists } from "./customLists";
import type { CustomLists } from "./customLists";

type Tab = "edit" | "send" | "orders" | "income" | "settings";

export default function App() {
  const [saved, setSaved] = useState<Invoice[]>(() => loadInvoices());
  const [invoice, setInvoice] = useState<Invoice>(() => {
    try {
      const draft = localStorage.getItem("bike-draft");
      if (draft) return normalizeInvoice(JSON.parse(draft));
    } catch { /* Retain unreadable draft for backup, but do not crash startup. */ }
    return newInvoice();
  });
  const [baseline, setBaseline] = useState(() => {
    const stored = loadInvoices().find(i => i.id === invoice.id);
    return JSON.stringify(stored ?? (localStorage.getItem("bike-draft") ? newInvoice() : invoice));
  });
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(invoice) !== baseline;
  useEffect(() => {
    try { localStorage.setItem("bike-draft", JSON.stringify(invoice)); }
    catch { setMessage("Draft recovery could not be saved. Export a backup before leaving."); }
  }, [invoice]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    const refresh = (event: StorageEvent) => { if (event.key === "bike-invoices") setSaved(loadInvoices()); };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("storage", refresh); };
  }, [dirty]);
  const [shop, setShop] = useState<ShopInfo>(() => loadShop());
  const [tab, setTab] = useState<Tab>("edit");
  const [message, setMessage] = useState("");
  const [owner, setOwner] = useState<OwnerSettings>(() => loadOwner());
  const access = useIncomeAccess();
  const [lists, setLists] = useState<CustomLists>(() => loadLists());

  const openTab = (t: Tab) => {
    // Each owner page requires a fresh authentication after leaving it.
    if (t !== tab) access.lock();
    setTab(t);
  };

  const persist = async (next: Invoice, note: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const all = await saveInvoiceSafely(next);
      const stored = all.find(i => i.id === next.id)!;
      setInvoice(stored);
      setBaseline(JSON.stringify(stored));
      setSaved(all);
      setMessage(note);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Saving failed; nothing changed."); }
    finally { setBusy(false); }
  };
  const onSave = () => void persist(invoice, `Saved invoice #${invoice.invoiceNumber}`);
  const discardOK = () => !dirty || window.confirm("Discard unsaved changes? A recovery draft will be replaced.");
  const onNew = () => {
    if (!discardOK()) return;
    const next = newInvoice();
    setInvoice(next);
    setBaseline(JSON.stringify(next));
    openTab("edit");
    setMessage("");
  };
  const backup = () => {
    const blob = new Blob([exportInvoiceBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "bike-invoices-backup.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importBackup = async (file?: File) => {
    if (!file || busy) return;
    setBusy(true);
    try { setSaved(await importInvoiceBackup(await file.text())); setMessage("Backup imported."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Import failed."); }
    finally { setBusy(false); }
  };
  const onShop = (next: ShopInfo) => {
    setShop(next);
    saveShop(next);
  };
  const onLists = (next: CustomLists) => {
    setLists(next);
    saveLists(next);
  };
  const onOwner = (next: OwnerSettings) => {
    saveOwner(next);
    setOwner(next);
  };

  const labels: Record<Tab, string> = { edit: "Edit", send: "Send", orders: `Orders (${saved.length})`,
    income: "Income",
    settings: "Settings",
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>{shop.name || "Bike Shop"} Invoices</h1>
        <nav role="tablist">
          {(Object.keys(labels) as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "active" : ""}
              onClick={() => openTab(t)}
            >
              {labels[t]}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {storageDamaged() && <p role="alert">Some invoice records are unreadable. Valid records remain visible; saving and deleting are blocked. Export a backup for recovery.</p>}
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>

        {tab === "edit" && <>
          {invoice.paidAt && <p role="note">Paid invoices are locked. Undo payment on Send before correcting an invoice.</p>}
          <fieldset disabled={Boolean(invoice.paidAt)} style={{ border: 0, padding: 0 }}><InvoiceForm invoice={invoice} setInvoice={setInvoice} lists={lists} onLists={onLists} /></fieldset>
        </>}
        {tab === "send" && (
          <>
            <InvoicePreview invoice={invoice} shop={shop} />
            <SendPanel
              invoice={invoice}
              shop={shop}
              onSent={() =>
                persist({ ...invoice, sentAt: new Date().toISOString() }, `Invoice #${invoice.invoiceNumber} marked sent`)
              }
              onPaid={(method) =>
                persist(
                  { ...invoice, paymentMethod: method, paidAt: method ? new Date().toISOString() : "", paymentTotals: method ? calculateTotals(invoice) : undefined },
                  method ? `Invoice #${invoice.invoiceNumber} marked paid` : "Payment cleared",
                )
              }
            />
          </>
        )}
        {tab === "orders" && (
          <OrdersPanel
            orders={saved}
            onOpen={(inv) => {
              if (!discardOK()) return;
              setInvoice(inv);
              setBaseline(JSON.stringify(inv));
              openTab("edit");
            }}
            onDelete={async (id) => {
              if (!window.confirm("Delete this invoice permanently? Export a backup first.")) return;
              setBusy(true);
              try {
                setSaved(await deleteInvoiceSafely(id));
                if (invoice.id === id) {
                  const next = newInvoice(); setInvoice(next); setBaseline(JSON.stringify(next));
                }
                setMessage("Invoice deleted.");
              } catch (e) { setMessage(e instanceof Error ? e.message : "Delete failed."); }
              finally { setBusy(false); }
            }}
          />
        )}
        {tab === "income" && (!owner.faceIDEnabled || access.unlocked ? (
          <IncomePanel invoices={saved} owner={owner} onLock={owner.faceIDEnabled ? access.lock : undefined} />
        ) : <FaceIDGate authenticating={access.authenticating} error={access.error} onUnlock={() => void access.unlock()} />)}
        {tab === "settings" && <SettingsPanel shop={shop} onShop={onShop} lists={lists} onLists={onLists}
          owner={owner} onOwner={onOwner} access={access} onBackup={backup} onImport={importBackup} />}
      </fieldset>
      </main>

      <footer className="actions">
        <span role="status">{message}</span>
        <button className="secondary" onClick={onNew} disabled={busy}>
          New
        </button>
        {tab === "send" && !Capacitor.isNativePlatform() && (
          <button className="secondary" onClick={() => window.print()}>
            Print
          </button>
        )}
        <button onClick={onSave} disabled={busy}>Save</button>
      </footer>
    </div>
  );
}
