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
  const normalized = {
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
  if (normalized.paidAt && !normalized.paymentTotals) normalized.paymentTotals = calculateTotals(normalized);
  return normalized;
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

function readRecords(storage: Storage): { invoices: Invoice[]; damaged: boolean } {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return { invoices: [], damaged: false };
  try {
    const records: unknown = JSON.parse(raw);
    if (!Array.isArray(records)) throw new Error("Expected invoice array");
    const invoices: Invoice[] = [];
    let damaged = false;
    for (const record of records) {
      try {
        if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Invalid record");
        const raw = record as Partial<Invoice>;
        if (typeof raw.id !== "string" || !raw.id || typeof raw.invoiceNumber !== "string" || !raw.invoiceNumber.trim()) throw new Error("Invalid identity");
        if (raw.lineItems !== undefined && (!Array.isArray(raw.lineItems) || raw.lineItems.some(li => !li || typeof li !== "object"))) throw new Error("Invalid items");
        if (raw.charges !== undefined && (!raw.charges || typeof raw.charges !== "object")) throw new Error("Invalid charges");
        const inv = normalizeInvoice(raw);
        if (typeof inv.id !== "string" || !inv.id || typeof inv.invoiceNumber !== "string") throw new Error("Invalid identity");
        for (const key of ["bikeDescriptions", "bikeSerials", "bikeBrands", "services", "serviceNotes"] as const)
          if (!Array.isArray(inv[key]) || inv[key].some(v => typeof v !== "string")) throw new Error("Invalid list");
        for (const key of Object.keys(blankInvoice()) as (keyof Invoice)[]) {
          const base = blankInvoice()[key];
          if (typeof base === "string" && typeof inv[key] !== "string") throw new Error("Invalid text");
          if (typeof base === "number" && (typeof inv[key] !== "number" || !Number.isFinite(inv[key]))) throw new Error("Invalid amount");
        }
        if (inv.lineItems.some(li => !li || typeof li.description !== "string" || !Number.isFinite(li.quantity) || !Number.isFinite(li.unitPrice))) throw new Error("Invalid item");
        if (CHARGE_KEYS.some(key => !Number.isFinite(inv.charges[key]))) throw new Error("Invalid charge");
        if (inv.paymentTotals && ["parts", "labor", "other", "subtotal", "tax", "total"].some(key => !Number.isFinite(inv.paymentTotals![key as keyof Totals]))) throw new Error("Invalid payment");
        if (invoices.some(i => i.id === inv.id)) throw new Error("Duplicate identity");
        invoices.push(inv);
      } catch { damaged = true; }
    }
    return { invoices, damaged };
  } catch { return { invoices: [], damaged: true }; }
}

export function storageDamaged(storage: Storage = localStorage): boolean { return readRecords(storage).damaged; }
export function loadInvoices(storage: Storage = localStorage): Invoice[] { return readRecords(storage).invoices; }
function writableInvoices(storage: Storage): Invoice[] {
  const result = readRecords(storage);
  if (result.damaged) throw new Error("Invoice storage is damaged. Export a backup before recovery; saving and deleting are blocked.");
  return result.invoices;
}

/** All production mutations share this origin-wide lock, including deletion and import.
 * Fail closed if locking is unavailable rather than risk a lost update.
 */
export async function withInvoiceLock<T>(operation: () => T): Promise<T> {
  if (!globalThis.navigator?.locks) throw new Error("Safe saving requires a browser with Web Locks support. No data was changed.");
  return navigator.locks.request("bike-invoice-write", operation);
}
export function saveInvoiceSafely(invoice: Invoice): Promise<Invoice[]> {
  return withInvoiceLock(() => saveInvoice(invoice));
}
export function deleteInvoiceSafely(id: string): Promise<Invoice[]> {
  return withInvoiceLock(() => deleteInvoice(id));
}
export function exportInvoiceBackup(storage: Storage = localStorage): string {
  return storage.getItem(STORAGE_KEY) ?? "[]";
}
export function importInvoiceBackup(text: string, storage: Storage = localStorage): Promise<Invoice[]> {
  return withInvoiceLock(() => {
    const fake = { getItem: (key: string) => key === STORAGE_KEY ? text : null } as unknown as Storage;
    const incoming = readRecords(fake);
    if (incoming.damaged) throw new Error("Backup contains invalid records; nothing imported.");
    const all = writableInvoices(storage);
    const merged = [...all];
    for (const invoice of incoming.invoices) {
      if (merged.some(i => i.id === invoice.id)) throw new Error("Backup overlaps existing records; import into an empty store to avoid overwriting.");
      if (merged.some(i => i.invoiceNumber === invoice.invoiceNumber)) throw new Error("Backup has duplicate invoice numbers; nothing imported.");
      merged.push(invoice);
    }
    storage.setItem(NUMBER_KEY, String(highestInvoiceNumber(merged, storage)));
    storage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  });
}

export function saveInvoice(invoice: Invoice, storage: Storage = localStorage): Invoice[] {
  const candidate = readRecords({ getItem: () => JSON.stringify([invoice]) } as unknown as Storage);
  if (candidate.damaged) throw new Error("Invoice contains invalid fields; nothing saved.");
  invoice = candidate.invoices[0];
  const all = writableInvoices(storage);
  const idx = all.findIndex((i) => i.id === invoice.id);
  const previous = all[idx];
  if (previous?.paidAt && invoice.paidAt) invoice = { ...invoice, paidAt: previous.paidAt, paymentMethod: previous.paymentMethod, paymentTotals: previous.paymentTotals ?? calculateTotals(previous) };
  else invoice = { ...invoice, paymentTotals: invoice.paidAt ? calculateTotals(invoice) : undefined };
  if (all.some(i => i.id !== invoice.id && i.invoiceNumber === invoice.invoiceNumber)) {
    if (idx >= 0) throw new Error(`Invoice #${invoice.invoiceNumber} already exists. Choose a different number.`);
    // New invoice whose pre-assigned number was taken since (e.g. two tabs opened New):
    // allocate the next free number here, inside the lock, so both saves succeed.
    const highest = highestInvoiceNumber(all, storage);
    if (highest >= Number.MAX_SAFE_INTEGER) throw new Error("Invoice number limit reached");
    invoice = { ...invoice, invoiceNumber: String(highest + 1) };
  }
  const next = idx >= 0 ? all.map((i) => (i.id === invoice.id ? invoice : i)) : [...all, invoice];
  storage.setItem(NUMBER_KEY, String(highestInvoiceNumber(next, storage)));
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteInvoice(id: string, storage: Storage = localStorage): Invoice[] {
  const all = writableInvoices(storage);
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
