import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import "./app.css";
import type { Invoice, OwnerSettings, ShopInfo } from "./types";
import {
  blankInvoice,
  deleteInvoice,
  loadInvoices,
  loadOwner,
  loadShop,
  saveInvoice,
  saveOwner,
  saveShop,
} from "./invoice";
import InvoiceForm from "./components/InvoiceForm";
import InvoicePreview from "./components/InvoicePreview";
import SendPanel from "./components/SendPanel";
import ShopSettings from "./components/ShopSettings";
import IncomePanel from "./components/IncomePanel";
import OrdersPanel from "./components/OrdersPanel";
import { loadLists, saveLists } from "./customLists";
import type { CustomLists } from "./customLists";

type Tab = "edit" | "send" | "orders" | "income" | "shop";

export default function App() {
  const [saved, setSaved] = useState<Invoice[]>(() => loadInvoices());
  const [invoice, setInvoice] = useState<Invoice>(() => blankInvoice(saved.length));
  const [shop, setShop] = useState<ShopInfo>(() => loadShop());
  const [tab, setTab] = useState<Tab>("edit");
  const [message, setMessage] = useState("");
  const [owner, setOwner] = useState<OwnerSettings>(() => loadOwner());
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);
  const [lists, setLists] = useState<CustomLists>(() => loadLists());

  const openTab = (t: Tab) => {
    // Leaving the Income tab locks it again so a customer handed the phone can't open it.
    if (t !== "income") setOwnerUnlocked(false);
    setTab(t);
  };

  const persist = (next: Invoice, note: string) => {
    setInvoice(next);
    setSaved(saveInvoice(next));
    setMessage(note);
  };
  const onSave = () => persist(invoice, `Saved invoice #${invoice.invoiceNumber}`);
  const onNew = () => {
    setInvoice(blankInvoice(saved.length));
    openTab("edit");
    setMessage("");
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
    setOwner(next);
    saveOwner(next);
  };

  const labels: Record<Tab, string> = { edit: "Edit", send: "Send", orders: `Orders (${saved.length})`,
    income: "Income",
    shop: "Shop",
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
        {tab === "edit" && <InvoiceForm invoice={invoice} setInvoice={setInvoice} lists={lists} onLists={onLists} />}
        {tab === "send" && (
          <>
            <InvoicePreview invoice={invoice} shop={shop} />
            <SendPanel
              invoice={invoice}
              shop={shop}
              onSent={() =>
                persist({ ...invoice, sentAt: new Date().toISOString() }, `Texted invoice #${invoice.invoiceNumber}`)
              }
              onPaid={(method) =>
                persist(
                  { ...invoice, paymentMethod: method, paidAt: method ? new Date().toISOString() : "" },
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
              setInvoice(inv);
              openTab("edit");
            }}
            onDelete={(id) => setSaved(deleteInvoice(id))}
          />
        )}
        {tab === "income" && (
          <IncomePanel
            invoices={saved}
            owner={owner}
            onOwner={onOwner}
            unlocked={ownerUnlocked}
            onUnlock={setOwnerUnlocked}
          />
        )}
        {tab === "shop" && <ShopSettings shop={shop} onChange={onShop} lists={lists} onLists={onLists} />}
      </main>

      <footer className="actions">
        <span role="status">{message}</span>
        <button className="secondary" onClick={onNew}>
          New
        </button>
        {tab === "send" && !Capacitor.isNativePlatform() && (
          <button className="secondary" onClick={() => window.print()}>
            Print
          </button>
        )}
        <button onClick={onSave}>Save</button>
      </footer>
    </div>
  );
}
