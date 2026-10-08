import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";
vi.mock("../src/faceID", () => ({
  supportsNativeFaceID: () => false,
  faceIDStatus: vi.fn(async () => ({ available: true, reason: "" })),
  authenticateIncome: vi.fn(async () => undefined),
}));
import { blankInvoice, emptyLineItem, saveInvoice, normalizeInvoice } from "../src/invoice";
import { orderForAI, searchOrders, unpaidSummary } from "../src/orders";
import { askAboutOrders } from "../src/askAI";
import type { Invoice } from "../src/types";

vi.mock("../src/askAI", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/askAI")>()),
  askAboutOrders: vi.fn(),
}));

const order = (n: number, fields: Partial<Invoice>): Invoice => ({
  ...blankInvoice(n),
  ...fields,
});

const jordan = order(0, {
  customerName: "Jordan Lee",
  customerPhone: "(347) 828-5828",
  bikeDescriptions: ["Trek FX 2"],
  bikeSerials: ["WTU123"],
  services: ["Flat tire repair"],
  lineItems: [{ ...emptyLineItem("Rear brake pads"), quantity: 2, unitPrice: 8 }],
  labor: 20,
  taxRate: 10,
  paidAt: "2026-09-10T15:00:00.000Z",
  paymentMethod: "zelle",
});
const rhythm = order(1, {
  customerName: "Rhythm",
  customerPhone: "19723028232",
  services: ["Brake adjustment"],
});

describe("searchOrders", () => {
  it("lists newest first when the query is empty", () => {
    expect(searchOrders([normalizeInvoice(jordan), normalizeInvoice(rhythm)], "").map((o) => o.invoiceNumber)).toEqual(["1002", "1001"]);
  });

  it("matches name, invoice #, bike, serial, service, part and status, all words required", () => {
    const all = [jordan, rhythm];
    expect(searchOrders(all, "jordan")).toEqual([jordan]);
    expect(searchOrders(all, "#1002")).toEqual([rhythm]);
    expect(searchOrders(all, "trek wtu123")).toEqual([jordan]);
    expect(searchOrders(all, "brake")).toEqual([rhythm, jordan]);
    expect(searchOrders(all, "brake paid")).toEqual([jordan]);
    expect(searchOrders(all, "draft")).toEqual([rhythm]);
    expect(searchOrders(all, "jordan draft")).toEqual([]);
  });

  it("finds a phone number however it was typed", () => {
    expect(searchOrders([jordan, rhythm], "8285828")).toEqual([jordan]);
    expect(searchOrders([jordan, rhythm], "302-8232")).toEqual([]);
    expect(searchOrders([jordan, rhythm], "3028232")).toEqual([rhythm]);
  });
});

describe("orderForAI", () => {
  it("gives the AI the order with its totals already worked out", () => {
    const text = orderForAI(jordan);
    expect(text).toContain("Invoice #1001");
    expect(text).toContain("Paid (zelle on 2026-09-10)");
    expect(text).toContain("Jordan Lee (347) 828-5828");
    expect(text).toContain("Bikes: Trek FX 2 (S/N WTU123)");
    expect(text).toContain("2 × Rear brake pads @ $8.00");
    expect(text).toContain("tax $3.60, total $39.60, nothing owed");
  });

  it("spells out an unpaid order and what's owed, so the on-device model can't read Sent as paid", () => {
    const sent = { ...rhythm, labor: 25, sentAt: "2026-09-12T10:00:00.000Z" };
    expect(orderForAI(sent)).toContain("NOT PAID (texted 2026-09-12)");
    expect(orderForAI(sent)).toContain("total $25.00, owed $25.00");
    expect(orderForAI(rhythm)).toContain("NOT PAID (draft, not texted yet)");
    expect(unpaidSummary([jordan, sent])).toBe("Not paid yet: #1002 $25.00. Owed in all: $25.00. All other orders are paid.");
    expect(unpaidSummary([jordan])).toBe("Every order is paid; nothing is owed.");
  });
});

describe("Orders tab", () => {
  it("replaces Saved, and one box both searches and asks Apple Intelligence without any key", async () => {
    saveInvoice(jordan);
    saveInvoice(rhythm);
    vi.mocked(askAboutOrders).mockResolvedValue({
      answer: "Rhythm hasn't paid yet.",
      invoiceNumbers: ["1002"],
    });
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole("tab", { name: /Saved/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Orders (2)" }));
    const box = screen.getByLabelText("Search or ask");
    await user.type(box, "trek");
    expect(screen.getByRole("button", { name: /#1001 · Jordan Lee/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /#1002/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.clear(box);
    await user.type(box, "Who hasn't paid?");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(askAboutOrders).toHaveBeenCalledWith("Who hasn't paid?", [normalizeInvoice(jordan), normalizeInvoice(rhythm)], "");
    expect(within(screen.getByLabelText("AI answer")).getByText("Rhythm hasn't paid yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /#1002 · Rhythm/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /#1001/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show all orders" }));
    expect(screen.getByRole("button", { name: /#1001 · Jordan Lee/ })).toBeInTheDocument();

    expect(box).toHaveValue("");

    // Changing the box after an answer goes back to searching.
    await user.type(box, "Who hasn't paid?{Enter}");
    expect(screen.getByLabelText("AI answer")).toBeInTheDocument();
    await user.clear(box);
    expect(screen.queryByLabelText("AI answer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /#1001 · Jordan Lee/ })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.queryByText(/API key/i)).not.toBeInTheDocument();
  });

  it("pressing Enter in the box asks, and shows what went wrong when asking fails", async () => {
    vi.mocked(askAboutOrders).mockRejectedValue(
      new Error("Turn on Apple Intelligence in Settings › Apple Intelligence & Siri to ask questions."),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Orders (0)" }));
    await user.type(screen.getByLabelText("Search or ask"), "anything{Enter}");
    expect(askAboutOrders).toHaveBeenCalledWith("anything", [], "");
    expect(screen.getByRole("alert")).toHaveTextContent("Turn on Apple Intelligence");
  });
});

describe("Income tab Ask", () => {
  it("shows only an Ask button until tapped, then asks with the income figures", async () => {
    saveInvoice(jordan);
    vi.mocked(askAboutOrders).mockResolvedValue({
      answer: "You made $36.00 this month.",
      invoiceNumbers: ["1001"],
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Income" }));
    expect(screen.queryByRole("button", { name: "Unlock with Face ID" })).not.toBeInTheDocument();

    expect(screen.queryByLabelText("Ask about your income")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ask" }));
    const box = screen.getByLabelText("Ask about your income");
    await user.type(box, "What did I make?");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    const [question, orders, context] =
      vi.mocked(askAboutOrders).mock.calls[vi.mocked(askAboutOrders).mock.calls.length - 1];
    expect(question).toBe("What did I make?");
    expect(orders).toEqual([normalizeInvoice(jordan)]);
    expect(context).toContain("All time: 1 paid, net sales $36.00");
    expect(within(screen.getByLabelText("AI answer")).getByText("You made $36.00 this month.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByLabelText("Ask about your income")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ask" })).toBeInTheDocument();
  });
});
