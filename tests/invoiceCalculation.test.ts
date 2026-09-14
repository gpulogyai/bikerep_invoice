import { describe, expect, it } from "vitest";
import { blankInvoice, calculateTotals, deleteInvoice, lineTotal, loadInvoices, saveInvoice } from "../src/invoice";

describe("invoice calculations", () => {
  it("multiplies quantity by unit price per line", () => {
    expect(lineTotal({ id: "a", description: "Tube", quantity: 2, unitPrice: 8.5 })).toBe(17);
  });

  it("sums lines and applies tax rounded to cents", () => {
    const totals = calculateTotals({
      taxRate: 8.25,
      lineItems: [
        { id: "1", description: "Tune-up", quantity: 1, unitPrice: 65 },
        { id: "2", description: "Brake pads", quantity: 2, unitPrice: 12.99 },
        { id: "3", description: "Chain lube", quantity: 1, unitPrice: 0.1 },
      ],
    });
    expect(totals.subtotal).toBe(91.08);
    expect(totals.tax).toBe(7.51);
    expect(totals.total).toBe(98.59);
  });

  it("treats NaN inputs as zero instead of poisoning the total", () => {
    const totals = calculateTotals({
      taxRate: Number.NaN,
      lineItems: [
        { id: "1", description: "Labour", quantity: Number.NaN, unitPrice: 40 },
        { id: "2", description: "Cable", quantity: 1, unitPrice: 5 },
      ],
    });
    expect(totals).toEqual({ subtotal: 5, tax: 0, total: 5 });
  });
});

describe("invoice storage", () => {
  it("saves, updates in place, and deletes", () => {
    const inv = blankInvoice();
    saveInvoice(inv);
    saveInvoice({ ...inv, customerName: "Ana" });
    expect(loadInvoices()).toHaveLength(1);
    expect(loadInvoices()[0].customerName).toBe("Ana");
    expect(deleteInvoice(inv.id)).toEqual([]);
  });

  it("returns an empty list for corrupt storage", () => {
    localStorage.setItem("bike-invoices", "{not json");
    expect(loadInvoices()).toEqual([]);
  });
});
