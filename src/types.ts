export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  shopName: string;
  customerName: string;
  customerPhone: string;
  bikeDescriptions: string[];
  serviceNotes: string[];
  lineItems: LineItem[];
  taxRate: number;
}

export interface Totals {
  subtotal: number;
  tax: number;
  total: number;
}
