import { beforeEach, describe, expect, it, vi } from "vitest";
import { blankInvoice } from "../src/invoice";

const ask = vi.fn();
vi.mock("@capacitor/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@capacitor/core")>()),
  registerPlugin: () => ({ ask }),
}));

const { askAboutOrders, buildPrompt, explainAIError, ORDER_CHAR_BUDGET } = await import("../src/askAI");

const orders = Array.from({ length: 60 }, (_, i) => ({
  ...blankInvoice(i),
  customerName: `Customer ${i}`,
}));

beforeEach(() => {
  ask.mockReset();
});

describe("askAboutOrders (Apple Intelligence)", () => {
  it("sends the question with the newest orders that fit the on-device model", async () => {
    ask.mockResolvedValue({ answer: "ok", invoiceNumbers: ["#1060"] });
    const reply = await askAboutOrders("Who hasn't paid?", orders, "Income: …");
    expect(reply).toEqual({ answer: "ok", invoiceNumbers: ["1060"] });
    const { prompt, instructions } = ask.mock.calls[0][0];
    expect(instructions).toContain("bicycle repair shop");
    expect(prompt).toContain("Income: …");
    expect(prompt).toContain("Customer 59");
    expect(prompt).toMatch(/\(the \d+ most recent of 60 orders\)/);
    expect(prompt.endsWith("Question: Who hasn't paid?")).toBe(true);
    expect(prompt.length).toBeLessThan(ORDER_CHAR_BUDGET + 1000);
  });

  it("asks again with fewer orders when they overflow the model's window", async () => {
    ask.mockRejectedValueOnce(Object.assign(new Error("Too many orders"), { code: "context" }));
    ask.mockResolvedValueOnce({ answer: "ok", invoiceNumbers: [] });
    await askAboutOrders("q", orders);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1][0].prompt.length).toBeLessThan(ask.mock.calls[0][0].prompt.length);
  });

  it("passes other failures straight to the owner", async () => {
    const unavailable = Object.assign(new Error("Turn on Apple Intelligence in Settings"), { code: "unavailable" });
    ask.mockImplementation(async () => {
      throw unavailable;
    });
    const thrown = await askAboutOrders("q", orders).catch((e: unknown) => e);
    expect(thrown).toBe(unavailable);
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("explains errors, including a browser with no native plugin", () => {
    expect(explainAIError(Object.assign(new Error("not implemented"), { code: "UNIMPLEMENTED" }))).toMatch(
      /iPhone app/,
    );
    expect(explainAIError(new Error("Apple Intelligence is busy."))).toBe("Apple Intelligence is busy.");
    expect(buildPrompt("q", [])).toContain("(no orders saved yet)");
  });
});
