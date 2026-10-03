import { CHARGE_KEYS } from "./types";
import type { ChargeKey, Invoice, LineItem, OwnerSettings, ShopInfo, Totals } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

export function lineTotal(item: Pick<LineItem, "quantity" | "unitPrice">): number {
  return round2(num(item.quantity) * num(item.unitPrice));
}

type TotalsInput = { lineItems: LineItem[]; taxRate: number } & Partial<Pick<Invoice, "labor" | "charges">>;

export function calculateTotals(invoice: TotalsInput): Totals {
  const parts = round2(invoice.lineItems.reduce((sum, item) => sum + lineTotal(item), 0));
  const labor = round2(num(invoice.labor));
  const other = round2(CHARGE_KEYS.reduce((sum, k) => sum + num(invoice.charges?.[k]), 0));
  const subtotal = round2(parts + labor + other);
  const tax = round2((subtotal * num(invoice.taxRate)) / 100);
  return { parts, labor, other, subtotal, tax, total: round2(subtotal + tax) };
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const CHARGE_LABELS: Record<ChargeKey, string> = {
  miscMerchandise: "Misc. merchandise",
  sublet: "Sublet repairs",
  storage: "Storage fee",
  wasteRemoval: "Waste removal",
};

export function emptyLineItem(description = ""): LineItem {
  return { id: newId(), partNo: "", description, quantity: 1, unitPrice: 0, warranty: false, condition: "new" };
}

export function blankInvoice(existingCount = 0): Invoice {
  return {
    id: newId(),
    invoiceNumber: String(1001 + existingCount),
    date: localDate(),
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerCityStateZip: "",
    altName: "",
    altPhone: "",
    customerOrderNo: "",
    receivedAt: "",
    promisedAt: "",
    writtenBy: "",
    bikeDescriptions: [""],
    bikeSerials: [""],
    bikeBrands: [""],
    services: [],
    serviceNotes: [""],
    lineItems: [emptyLineItem()],
    labor: 0,
    laborBasis: "flat",
    charges: { miscMerchandise: 0, sublet: 0, storage: 0, wasteRemoval: 0 },
    taxRate: 0,
    estimateChoice: "",
    estimateAmount: 0,
    partsDisposition: "",
    guaranteeUntil: "",
    authorizedBy: "",
    sentAt: "",
    paidAt: "",
    paymentMethod: "",
  };
}

/** "Trek 820 (S/N WTU123)" for each bike that has a brand or model. */
export function bikeLabels(invoice: Invoice): string[] {
  return invoice.bikeDescriptions
    .map((b, i) => {
      const serial = invoice.bikeSerials[i]?.trim();
      return b.trim() ? (serial ? `${b.trim()} (S/N ${serial})` : b.trim()) : "";
    })
    .filter(Boolean);
}

/** Fills fields missing from invoices saved by older versions of the app. */
export function normalizeInvoice(raw: Partial<Invoice> & { serialNumber?: string }): Invoice {
  const base = blankInvoice();
  const { serialNumber: legacySerial, ...rest } = raw;
  const bikeDescriptions = raw.bikeDescriptions?.length ? raw.bikeDescriptions : base.bikeDescriptions;
  // Older versions had one serial # for the whole invoice; it belongs to the first bike.
  const serials = Array.isArray(raw.bikeSerials) ? raw.bikeSerials : [legacySerial ?? ""];
  const bikeSerials = bikeDescriptions.map((_, i) => serials[i] ?? "");
  const bikeBrands = bikeDescriptions.map((_, i) => raw.bikeBrands?.[i] ?? "");
  // Older versions kept accessories as one lump charge; carry it over as a line item.
  const { accessories: legacyAccessories, ...charges } = { ...base.charges, ...raw.charges } as Invoice["charges"] & {
    accessories?: number;
  };
  // Parts and accessories used to be kept apart by a `kind`; they are one list now.
  const lineItems = (raw.lineItems?.length ? raw.lineItems : base.lineItems).map((li) => {
    const { kind: _, ...item } = li as LineItem & { kind?: string };
    return { ...emptyLineItem(), ...item };
  });
  if (legacyAccessories) lineItems.push({ ...emptyLineItem("Accessories"), unitPrice: legacyAccessories });
  return {
    ...base,
    ...rest,
    charges,
    lineItems,
    services: Array.isArray(raw.services) ? raw.services : [],
    bikeDescriptions,
    bikeSerials,
    bikeBrands,
    serviceNotes: raw.serviceNotes?.length ? raw.serviceNotes : base.serviceNotes,
  };
}

const STORAGE_KEY = "bike-invoices";
const SHOP_KEY = "bike-shop";
const OWNER_KEY = "bike-owner";
const NUMBER_KEY = "bike-invoice-high-water";

function numericInvoiceNumber(value: string): number {
  const number = /^\d+$/.test(value) ? Number(value) : 0;
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function highestInvoiceNumber(invoices: Invoice[], storage: Storage): number {
  return invoices.reduce(
    (highest, invoice) => Math.max(highest, numericInvoiceNumber(invoice.invoiceNumber)),
    Math.max(1000, numericInvoiceNumber(storage.getItem(NUMBER_KEY) ?? "")),
  );
}

export function newInvoice(storage: Storage = localStorage): Invoice {
  const highest = highestInvoiceNumber(loadInvoices(storage), storage);
  if (highest >= Number.MAX_SAFE_INTEGER) throw new Error("Invoice number limit reached");
  return { ...blankInvoice(), invoiceNumber: String(highest + 1) };
}

export function loadInvoices(storage: Storage = localStorage): Invoice[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeInvoice) : [];
  } catch {
    return [];
  }
}

export function saveInvoice(invoice: Invoice, storage: Storage = localStorage): Invoice[] {
  const all = loadInvoices(storage);
  const idx = all.findIndex((i) => i.id === invoice.id);
  const next = idx >= 0 ? all.map((i) => (i.id === invoice.id ? invoice : i)) : [...all, invoice];
  storage.setItem(NUMBER_KEY, String(highestInvoiceNumber(next, storage)));
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteInvoice(id: string, storage: Storage = localStorage): Invoice[] {
  const all = loadInvoices(storage);
  // Preserve legacy numbers before removing even the highest remaining invoice.
  storage.setItem(NUMBER_KEY, String(highestInvoiceNumber(all, storage)));
  const next = all.filter((i) => i.id !== id);
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export const DEFAULT_SHOP: ShopInfo = {
  name: "Neighborhood Bike Repair",
  address: "3601 Matterhorn Dr",
  cityStateZip: "Plano, TX 75075",
  phone: "(408) 569-4378",
  zelle: "",
  paymentLink: "",
};

export function loadShop(storage: Storage = localStorage): ShopInfo {
  try {
    const raw = storage.getItem(SHOP_KEY);
    return { ...DEFAULT_SHOP, ...(raw ? (JSON.parse(raw) as Partial<ShopInfo>) : {}) };
  } catch {
    return DEFAULT_SHOP;
  }
}

export function saveShop(shop: ShopInfo, storage: Storage = localStorage): void {
  storage.setItem(SHOP_KEY, JSON.stringify(shop));
}

export const DEFAULT_OWNER: OwnerSettings = { pin: "", incomeTaxRate: 0 };

export function loadOwner(storage: Storage = localStorage): OwnerSettings {
  try {
    const raw = storage.getItem(OWNER_KEY);
    return { ...DEFAULT_OWNER, ...(raw ? (JSON.parse(raw) as Partial<OwnerSettings>) : {}) };
  } catch {
    return DEFAULT_OWNER;
  }
}

export function saveOwner(owner: OwnerSettings, storage: Storage = localStorage): void {
  storage.setItem(OWNER_KEY, JSON.stringify(owner));
}
