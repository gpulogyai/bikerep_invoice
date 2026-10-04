import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { blankInvoice, saveInvoice, saveInvoiceSafely, loadInvoices, deleteInvoice, exportInvoiceBackup, importInvoiceBackup, storageDamaged, DEFAULT_SHOP } from "../src/invoice";
import { summarizeIncome } from "../src/income";
import { invoiceMessage } from "../src/message";
import App from "../src/App";
import { useAsk } from "../src/components/AskBox";
import { askAboutOrders, buildPrompt } from "../src/askAI";
vi.mock("../src/askAI", async original => ({ ...await original<typeof import("../src/askAI")>(), askAboutOrders: vi.fn() }));
beforeEach(() => { localStorage.clear(); });

describe("storage safety", () => {
  it.each([null, { ...blankInvoice(), lineItems: [null] }, { ...blankInvoice(), paymentTotals: {} }])("keeps good records visible and blocks overwriting damaged data (%j)", bad => {
    const good = blankInvoice(); const raw = JSON.stringify([good, bad]);
    localStorage.setItem("bike-invoices", raw);
    expect(loadInvoices()).toHaveLength(1);
    expect(storageDamaged()).toBe(true);
    expect(() => saveInvoice(blankInvoice())).toThrow(/damaged/);
    expect(() => deleteInvoice(good.id)).toThrow(/damaged/);
    expect(exportInvoiceBackup()).toBe(raw);
  });
  it("allocates the next free number when two tabs save the same new number", async () => {
    const results = await Promise.all([saveInvoiceSafely(blankInvoice()), saveInvoiceSafely(blankInvoice())]);
    expect(loadInvoices()).toHaveLength(2);
    const numbers = results[results.length - 1].map(i => i.invoiceNumber);
    expect(numbers.sort()).toEqual(["1001", "1002"]);
  });
  it("does not lose simultaneous non-conflicting invoices", async () => {
    await Promise.all([saveInvoiceSafely(blankInvoice()), saveInvoiceSafely(blankInvoice(1))]);
    expect(loadInvoices()).toHaveLength(2);
  });
  it("detects existing duplicates but lets an owner resolve them explicitly", () => {
    const a = blankInvoice(), b = blankInvoice();
    localStorage.setItem("bike-invoices", JSON.stringify([a, b]));
    expect(() => saveInvoice(a)).toThrow(/already exists/);
    saveInvoice({ ...b, invoiceNumber: "CUSTOM-2" });
    expect(loadInvoices().map(i => i.invoiceNumber)).toEqual(["1001", "CUSTOM-2"]);
  });
  it("fails closed without locking support", async () => {
    const locks = navigator.locks;
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
    try { await expect(saveInvoiceSafely(blankInvoice())).rejects.toThrow(/Web Locks/); expect(loadInvoices()).toEqual([]); }
    finally { Object.defineProperty(navigator, "locks", { configurable: true, value: locks }); }
  });
  it("imports valid backups and refuses invalid or overlapping imports", async () => {
    const inv = blankInvoice(); await importInvoiceBackup(JSON.stringify([inv]));
    const before = exportInvoiceBackup();
    await expect(importInvoiceBackup(JSON.stringify([inv]))).rejects.toThrow(/overlaps/);
    await expect(importInvoiceBackup('[null]')).rejects.toThrow(/invalid/);
    expect(exportInvoiceBackup()).toBe(before);
  });
});

describe("payments and receipts", () => {
  it("retains payment history after editing amounts, including legacy paid records", () => {
    const inv = { ...blankInvoice(), labor: 100, paidAt: "2026-01-01T12:00:00Z", paymentMethod: "cash" as const };
    localStorage.setItem("bike-invoices", JSON.stringify([inv]));
    const edited = saveInvoice({ ...loadInvoices()[0], labor: 999 });
    expect(summarizeIncome(edited, "0000-01-01", "9999-12-31", 0).collected).toBe(100);
    const message = invoiceMessage({ ...DEFAULT_SHOP, zelle: "pay-me", paymentLink: "https://pay.example" }, edited[0]);
    expect(message).toContain("PAYMENT RECEIVED: $100.00");
    expect(message).toContain("BALANCE DUE: $0.00");
    expect(message).not.toMatch(/TOTAL DUE|Pay with|pay online/);
  });
});

describe("draft and asynchronous guards", () => {
  it("cancelled New preserves unsaved work and reload recovers it", async () => {
    const user = userEvent.setup(); const view = render(<App />);
    await user.type(screen.getByLabelText("Name"), "Recovery customer");
    vi.mocked(window.confirm).mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "New" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Recovery customer");
    view.unmount(); render(<App />);
    expect(screen.getByLabelText("Name")).toHaveValue("Recovery customer");
  });
  it("ignores a reply that arrives after clear", async () => {
    let resolve!: (value: { answer: string; invoiceNumbers: string[] }) => void;
    vi.mocked(askAboutOrders).mockImplementation(() => new Promise(r => { resolve = r; }));
    const { result } = renderHook(() => useAsk([]));
    let pending!: Promise<void>;
    act(() => { pending = result.current.ask("question"); });
    act(() => { result.current.clear(); });
    await act(async () => { resolve({ answer: "stale", invoiceNumbers: [] }); await pending; });
    expect(result.current.answer).toBeNull(); expect(result.current.asking).toBe(false);
  });
  it("bounds the entire prompt even with enormous context and summary", () => {
    const invoices = Array.from({ length: 200 }, (_, n) => ({ ...blankInvoice(n), customerName: n === 199 ? "x".repeat(10000) : "Small order" }));
    const prompt = buildPrompt("q".repeat(10000), invoices, "c".repeat(10000), 2000);
    expect(prompt.length).toBeLessThanOrEqual(2000);
    expect(buildPrompt("q", invoices)).toContain("Small order");
  });
});
