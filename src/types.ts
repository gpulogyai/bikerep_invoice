export type PartCondition = "new" | "used" | "rebuilt" | "reconditioned";

export interface LineItem {
  id: string;
  partNo: string;
  description: string;
  quantity: number;
  unitPrice: number;
  warranty: boolean;
  condition: PartCondition;
}

export const CHARGE_KEYS = ["miscMerchandise", "sublet", "storage", "wasteRemoval"] as const;
export type ChargeKey = (typeof CHARGE_KEYS)[number];

export type PaymentMethod = "zelle" | "link" | "cash" | "card";

export interface ShopInfo {
  name: string;
  address: string;
  cityStateZip: string;
  phone: string;
  /** Phone number or email the shop receives Zelle payments on. */
  zelle: string;
  /** Square / PayPal / Stripe link. `{amount}` and `{invoice}` are filled in when sent. */
  paymentLink: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerCityStateZip: string;
  altName: string;
  altPhone: string;
  customerOrderNo: string;
  receivedAt: string;
  promisedAt: string;
  writtenBy: string;
  bikeDescriptions: string[];
  /** Serial # of each bike, same order as bikeDescriptions. */
  bikeSerials: string[];
  /** Brand typed in under "Other" for each bike, same order; "" when the brand was picked from the list. */
  bikeBrands: string[];
  /** Checked from the common-services list. */
  services: string[];
  /** Other work, typed in. */
  serviceNotes: string[];
  lineItems: LineItem[];
  labor: number;
  laborBasis: "flat" | "hourly" | "both";
  charges: Record<ChargeKey, number>;
  taxRate: number;
  estimateChoice: "" | "written" | "limit" | "none";
  estimateAmount: number;
  partsDisposition: "" | "retain" | "destroy";
  guaranteeUntil: string;
  authorizedBy: string;
  sentAt: string;
  paidAt: string;
  /** Immutable totals captured when payment is recorded. */
  paymentTotals?: Totals;
  paymentMethod: "" | PaymentMethod;
}

export interface Totals {
  /** Parts and accessories together. */
  parts: number;
  labor: number;
  other: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface OwnerSettings {
  /** 4+ digit code that hides the Income tab from customers looking at the phone. Empty = no lock. */
  pin: string;
  /** Share of net income (after sales tax) the owner sets aside for income tax, in percent. */
  incomeTaxRate: number;
}
