import type { Invoice, ShopInfo } from "./types";
import { bikeLabels, calculateTotals, formatMoney, lineTotal } from "./invoice";

/** Digits for an `sms:` URL; a bare 10-digit US number gets +1. */
export function smsNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}

export function paymentLinkFor(shop: ShopInfo, invoice: Invoice): string {
  const amount = calculateTotals(invoice).total.toFixed(2);
  return shop.paymentLink
    .trim()
    .replaceAll("{amount}", amount)
    .replaceAll("{invoice}", encodeURIComponent(invoice.invoiceNumber));
}

export function invoiceMessage(shop: ShopInfo, invoice: Invoice): string {
  const t = invoice.paidAt ? invoice.paymentTotals ?? calculateTotals(invoice) : calculateTotals(invoice);
  const bikes = bikeLabels(invoice);
  const work = [...invoice.services, ...invoice.serviceNotes.filter((n) => n.trim())];
  const parts = invoice.lineItems.filter((li) => li.description.trim() || lineTotal(li) !== 0);
  const firstName = invoice.customerName.trim().split(/\s+/)[0];

  const lines = [`${shop.name} - Invoice #${invoice.invoiceNumber} (${invoice.date})`];
  lines.push(firstName ? `Hi ${firstName}, here is your invoice.` : "Here is your invoice.");
  if (bikes.length) lines.push(`Bike: ${bikes.join(", ")}`);
  if (work.length) lines.push(`Work: ${work.join("; ")}`);
  for (const li of parts) {
    const qty = li.quantity !== 1 ? ` x${li.quantity}` : "";
    lines.push(`- ${li.description || "Item"}${qty}: ${formatMoney(lineTotal(li))}`);
  }
  lines.push(`Parts & accessories ${formatMoney(t.parts)} | Labor ${formatMoney(t.labor)}`);
  if (t.other) lines.push(`Other charges ${formatMoney(t.other)}`);
  if (t.tax) lines.push(`Tax ${formatMoney(t.tax)}`);
  if (invoice.paidAt) {
    lines.push(`PAYMENT RECEIVED: ${formatMoney(t.total)} (${invoice.paymentMethod || "paid"}, ${invoice.paidAt.slice(0, 10)})`);
    lines.push("BALANCE DUE: $0.00");
  } else lines.push(`TOTAL DUE: ${formatMoney(t.total)}`);
  lines.push("");

  const link = paymentLinkFor(shop, invoice);
  if (!invoice.paidAt && shop.zelle.trim()) {
    lines.push(`Pay with Zelle to ${shop.zelle.trim()} (memo: Invoice ${invoice.invoiceNumber})`);
  }
  if (!invoice.paidAt && link) lines.push(`${shop.zelle.trim() ? "Or pay" : "Pay"} online: ${link}`);
  lines.push(`Thank you! ${shop.phone}`.trim());
  return lines.join("\n");
}

/** Opens Messages addressed to the customer with the invoice text filled in. */
export function smsHref(shop: ShopInfo, invoice: Invoice): string {
  return `sms:${smsNumber(invoice.customerPhone)}?&body=${encodeURIComponent(invoiceMessage(shop, invoice))}`;
}
