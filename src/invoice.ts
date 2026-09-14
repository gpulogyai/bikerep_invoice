import type { Invoice, LineItem, Totals } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineTotal(item: LineItem): number {
  const qty = Number.isFinite(item.quantity) ? item.quantity : 0;
  const price = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;
  return round2(qty * price);
}

export function calculateTotals(invoice: Pick<Invoice, "lineItems" | "taxRate">): Totals {
  const subtotal = round2(invoice.lineItems.reduce((sum, item) => sum + lineTotal(item), 0));
  const rate = Number.isFinite(invoice.taxRate) ? invoice.taxRate : 0;
  const tax = round2((subtotal * rate) / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function emptyLineItem(): LineItem {
  return { id: newId(), description: "", quantity: 1, unitPrice: 0 };
}

export function blankInvoice(existingCount = 0): Invoice {
  return {
    id: newId(),
    invoiceNumber: String(1001 + existingCount),
    date: localDate(),
    shopName: "Bicycle Repair Shop",
    customerName: "",
    customerPhone: "",
    bikeDescriptions: [""],
    serviceNotes: [""],
    lineItems: [emptyLineItem()],
    taxRate: 0,
  };
}

const STORAGE_KEY = "bike-invoices";

export function loadInvoices(storage: Storage = localStorage): Invoice[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Invoice[]) : [];
  } catch {
    return [];
  }
}

export function saveInvoice(invoice: Invoice, storage: Storage = localStorage): Invoice[] {
  const all = loadInvoices(storage);
  const idx = all.findIndex((i) => i.id === invoice.id);
  const next = idx >= 0 ? all.map((i) => (i.id === invoice.id ? invoice : i)) : [...all, invoice];
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteInvoice(id: string, storage: Storage = localStorage): Invoice[] {
  const next = loadInvoices(storage).filter((i) => i.id !== id);
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
