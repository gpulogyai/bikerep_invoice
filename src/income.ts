import type { Invoice } from "./types";
import { calculateTotals, localDate, round2 } from "./invoice";

export interface IncomeSummary {
  paidCount: number;
  /** Everything customers paid, sales tax included. */
  collected: number;
  /** Sales tax collected, owed to the state. */
  salesTax: number;
  /** Collected minus sales tax: the shop's income before expenses. */
  netSales: number;
  /** Parts and accessories. */
  parts: number;
  labor: number;
  other: number;
  /** Estimated income tax to put aside from net sales at the owner's rate. */
  incomeTax: number;
  afterIncomeTax: number;
  unpaidCount: number;
  unpaid: number;
}

export type Period = "month" | "year" | "lastYear" | "all";

export function periodRange(period: Period, today = new Date()): { from: string; to: string } {
  const y = today.getFullYear();
  switch (period) {
    case "month":
      return { from: localDate(new Date(y, today.getMonth(), 1)), to: localDate(new Date(y, today.getMonth() + 1, 0)) };
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "lastYear":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default:
      return { from: "0000-01-01", to: "9999-12-31" };
  }
}

const inRange = (day: string, from: string, to: string) => day >= from && day <= to;

/** Paid invoices count on the day they were paid; unpaid ones are sent invoices dated in the range. */
export function summarizeIncome(invoices: Invoice[], from: string, to: string, incomeTaxRate: number): IncomeSummary {
  const s: IncomeSummary = {
    paidCount: 0,
    collected: 0,
    salesTax: 0,
    netSales: 0,
    parts: 0,
    labor: 0,
    other: 0,
    incomeTax: 0,
    afterIncomeTax: 0,
    unpaidCount: 0,
    unpaid: 0,
  };
  for (const inv of invoices) {
    const t = inv.paidAt ? inv.paymentTotals ?? calculateTotals(inv) : calculateTotals(inv);
    if (inv.paidAt) {
      if (!inRange(localDate(new Date(inv.paidAt)), from, to)) continue;
      s.paidCount += 1;
      s.collected += t.total;
      s.salesTax += t.tax;
      s.parts += t.parts;
      s.labor += t.labor;
      s.other += t.other;
    } else if (inv.sentAt && inRange(inv.date, from, to)) {
      s.unpaidCount += 1;
      s.unpaid += t.total;
    }
  }
  for (const k of ["collected", "salesTax", "parts", "labor", "other", "unpaid"] as const) {
    s[k] = round2(s[k]);
  }
  s.netSales = round2(s.collected - s.salesTax);
  const rate = Number.isFinite(incomeTaxRate) ? Math.max(0, incomeTaxRate) : 0;
  s.incomeTax = round2((s.netSales * rate) / 100);
  s.afterIncomeTax = round2(s.netSales - s.incomeTax);
  return s;
}

/** One row per month of `year` with what was collected. */
export function monthlyIncome(invoices: Invoice[], year: number, incomeTaxRate: number) {
  return Array.from({ length: 12 }, (_, m) => {
    const { from, to } = periodRange("month", new Date(year, m, 1));
    return { month: new Date(year, m, 1).toLocaleString("en-US", { month: "short" }), ...summarizeIncome(invoices, from, to, incomeTaxRate) };
  });
}
