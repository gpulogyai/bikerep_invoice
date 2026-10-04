import { registerPlugin } from "@capacitor/core";
import type { Invoice } from "./types";
import { localDate } from "./invoice";
import { orderForAI, unpaidSummary } from "./orders";

export interface AIAnswer {
  answer: string;
  /** Orders the answer is about, so the list can show just those. */
  invoiceNumbers: string[];
}

interface AppleIntelligencePlugin {
  availability(): Promise<{ available: boolean; reason: string }>;
  ask(options: { instructions: string; prompt: string }): Promise<AIAnswer>;
}

/** Apple Intelligence's on-device model, via the app's own plugin (ios/App/App/AppleIntelligencePlugin.swift). */
export const AppleIntelligence = registerPlugin<AppleIntelligencePlugin>("AppleIntelligence");

const INSTRUCTIONS = `You help the owner of a bicycle repair shop look through their repair orders.
Answer the owner's question using only the information provided. Totals are already worked out; use them rather than recomputing prices.
Keep the answer short and plain: a sentence or two, or a short list. Give money as $12.34.
List the invoice number of every order your answer refers to. If the information doesn't contain what the question needs, say so.`;

/** The on-device model reads about 4,000 tokens in all, so orders beyond this many characters are left out. */
export const ORDER_CHAR_BUDGET = 7000;

function ordersText(invoices: Invoice[], budget: number): { text: string; included: number } {
  const blocks: string[] = [];
  let used = 0;
  // Newest first, so the orders that fit are the recent ones.
  for (const inv of [...invoices].reverse()) {
    const block = orderForAI(inv);
    if (used + block.length + 2 > budget) continue;
    blocks.push(block);
    used += block.length + 2;
  }
  return { text: blocks.join("\n\n"), included: blocks.length };
}

export function buildPrompt(question: string, invoices: Invoice[], context = "", budget = ORDER_CHAR_BUDGET): string {
  budget = Math.max(200, budget);
  question = question.slice(0, Math.floor(budget / 5));
  context = context.slice(0, Math.floor(budget / 5));
  const summary = invoices.length ? unpaidSummary(invoices).slice(0, Math.floor(budget / 5)) : "";
  const { text, included } = ordersText(invoices, Math.max(0, budget - question.length - context.length - summary.length - 200));
  const note =
    invoices.length === 0
      ? "(no orders saved yet)"
      : included < invoices.length
        ? `(the ${included} most recent of ${invoices.length} orders)\n${text}`
        : text;

  return [`Today is ${localDate()}.`, `Orders:\n${note}`, context, summary, `Question: ${question}`]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Asks Apple Intelligence on the phone. `context` adds figures already worked out (the Income tab's totals).
 * If the orders don't fit the model's window, asks again with fewer of them.
 */
export async function askAboutOrders(question: string, invoices: Invoice[], context = ""): Promise<AIAnswer> {
  let budget = ORDER_CHAR_BUDGET;
  for (;;) {
    try {
      const reply = await AppleIntelligence.ask({
        instructions: INSTRUCTIONS,
        prompt: buildPrompt(question, invoices, context, budget),
      });
      return {
        answer: reply.answer,
        invoiceNumbers: (reply.invoiceNumbers ?? []).map(n => ordersIdentifier(n, invoices)),
      };
    } catch (e) {
      if ((e as { code?: string }).code !== "context" || budget < 1000) throw e;
      budget = Math.floor(budget / 2);
    }
  }
}

/** A message the owner can act on. */
export function explainAIError(error: unknown): string {
  const { code, message } = (error ?? {}) as {
    code?: string;
    message?: string;
  };
  // In a web browser there is no native plugin to call.
  if (code === "UNIMPLEMENTED") return "Asking questions needs the iPhone app with Apple Intelligence turned on.";
  return message || "Something went wrong asking Apple Intelligence.";
}

function ordersIdentifier(value: string, invoices: Invoice[]): string {
  const trimmed = value.trim();
  return invoices.some(i => i.invoiceNumber === trimmed) ? trimmed : trimmed.replace(/^#/, "");
}
