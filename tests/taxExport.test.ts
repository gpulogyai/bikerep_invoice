import { describe, expect, it } from "vitest";
import { blankInvoice, calculateTotals, DEFAULT_SHOP, emptyLineItem } from "../src/invoice";
import { createTaxReport, csvCell, taxCSV, taxPDF } from "../src/taxExport";
import type { Invoice } from "../src/types";

function paid(fields: Partial<Invoice> = {}): Invoice {
  return { ...blankInvoice(), date: "2024-12-01", paidAt: new Date(2025, 0, 2, 12).toISOString(),
    lineItems: [{ ...emptyLineItem(), quantity: 2, unitPrice: 10 }], labor: 30, taxRate: 10, ...fields };
}
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

describe("tax-year reports", () => {
  it("uses local payment dates, including both year boundaries, not invoice dates", () => {
    const invoices = [
      paid({ invoiceNumber: "1001", paidAt: new Date(2025, 0, 1, 0, 0, 0).toISOString() }),
      paid({ invoiceNumber: "1002", paidAt: new Date(2025, 11, 31, 23, 59, 59).toISOString() }),
      paid({ invoiceNumber: "1003", paidAt: new Date(2024, 11, 31, 23, 59, 59).toISOString() }),
      paid({ invoiceNumber: "1004", paidAt: new Date(2026, 0, 1, 0, 0, 0).toISOString() }),
      paid({ invoiceNumber: "1005", paidAt: "", sentAt: "2025-02-01T12:00:00Z", date: "2025-02-01" }),
      paid({ invoiceNumber: "1006", paidAt: "" }),
    ];
    const report = createTaxReport(invoices, 2025, DEFAULT_SHOP);
    expect(report.rows.map(r => [r.number, r.paidDate])).toEqual([["1001", "2025-01-01"], ["1002", "2025-12-31"]]);
    expect(report.summary).toMatchObject({ paidCount: 2, parts: 40, labor: 60, netSales: 100, salesTax: 10, collected: 110 });
    expect(report.months).toHaveLength(12);
    expect(report.months[0].paidCount).toBe(1);
    expect(report.months[11].paidCount).toBe(1);
    expect(report.months.reduce((s, m) => s + m.collected, 0)).toBe(report.summary.collected);
  });

  it("preserves payment snapshots and labels legacy recalculated amounts", () => {
    const original = paid();
    const report = createTaxReport([
      paid({ invoiceNumber: "1001", labor: 900, paymentTotals: calculateTotals(original) }),
      paid({ invoiceNumber: "1002", labor: 10 }),
    ], 2025, DEFAULT_SHOP);
    expect(report.rows[0]).toMatchObject({ labor: 30, netSales: 50, salesTax: 5, collected: 55, source: "Payment snapshot" });
    expect(report.rows[1]).toMatchObject({ labor: 10, netSales: 30, salesTax: 3, collected: 33, source: "Current invoice (legacy)" });
    expect(report.summary).toMatchObject({ netSales: 80, salesTax: 8, collected: 88 });
  });

  it("exports an empty year without inventing income or income-tax liability", () => {
    const report = createTaxReport([], 2025, DEFAULT_SHOP);
    expect(report.rows).toEqual([]);
    expect(report.summary.collected).toBe(0);
    expect(report.months.every(m => m.collected === 0)).toBe(true);
    expect(taxCSV(report)).toContain('"2025","0","0.00"');
    expect(taxCSV(report)).not.toContain("Set aside");
  });

  it("rejects invalid tax years", () => {
    for (const year of [NaN, 0, 1899, 10000, 2025.5]) expect(() => createTaxReport([], year, DEFAULT_SHOP)).toThrow("valid tax year");
  });

  it("quotes CSV and neutralizes spreadsheet formulas including leading whitespace", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    for (const value of ["=1+1", "+SUM(A1)", "-1+1", "@SUM(A1)", "\t=1", "\r=1", "  =1"]) {
      expect(csvCell(value)).toBe(`"'${value}"`);
    }
    expect(csvCell(42)).toBe('"42"');
    const csv = taxCSV(createTaxReport([paid({ invoiceNumber: '=HYPERLINK("bad")' })], 2025, { ...DEFAULT_SHOP, name: "=1+1" }));
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Business","\'=1+1"');
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain("\r\n");
  });

  it("omits customer details and repair notes in both formats and produces paginated PDF", async () => {
    const invoice = paid({ customerName: "PRIVATE_CUSTOMER", customerPhone: "PRIVATE_PHONE", customerAddress: "PRIVATE_ADDRESS",
      altName: "PRIVATE_ALT", bikeSerials: ["PRIVATE_SERIAL"], serviceNotes: ["PRIVATE_NOTES"],
      lineItems: [{ ...emptyLineItem("PRIVATE_PART"), quantity: 2, unitPrice: 10 }] });
    const report = createTaxReport(Array.from({ length: 50 }, (_, n) => ({ ...invoice, invoiceNumber: String(1001 + n) })), 2025, DEFAULT_SHOP);
    const blob = taxPDF(report);
    const pdf = await readBlob(blob);
    expect(blob.type).toBe("application/pdf");
    expect(pdf.startsWith("%PDF-")).toBe(true);
    expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(pdf).toContain("Tax-year sales report");
    expect(pdf).toContain("#1050");
    expect(pdf).toContain("Page 1 of");
    for (const text of [taxCSV(report), pdf]) {
      expect(text).not.toContain("PRIVATE_");
      expect(text).toContain("Not a tax return");
    }
  });
});
