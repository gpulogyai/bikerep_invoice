import type { Invoice } from "./types";
import { bikeLabels, calculateTotals, formatMoney } from "./invoice";

export const orderStatus = (inv: Invoice) => (inv.paidAt ? "Paid" : inv.sentAt ? "Sent" : "Draft");

const digits = (s: string) => s.replace(/\D/g, "");

/** Everything on an order a search can match: customer, phone, bikes, work, parts, status, date. */
function searchText(inv: Invoice): string {
  return [
    inv.invoiceNumber,
    inv.date,
    inv.customerName,
    inv.customerPhone,
    inv.customerAddress,
    inv.customerCityStateZip,
    inv.altName,
    inv.altPhone,
    inv.customerOrderNo,
    inv.writtenBy,
    ...bikeLabels(inv),
    ...inv.services,
    ...inv.serviceNotes,
    ...inv.lineItems.flatMap((li) => [li.description, li.partNo]),
    orderStatus(inv),
    inv.paymentMethod,
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * Orders matching every word of the query, newest first. A word made of digits also matches phone
 * numbers however they were typed, so "8285828" finds "(347) 828-5828".
 */
export function searchOrders(invoices: Invoice[], query: string): Invoice[] {
  const words = query.toLowerCase().replace(/#/g, " ").split(/\s+/).filter(Boolean);
  const newestFirst = [...invoices].reverse();
  if (words.length === 0) return newestFirst;
  return newestFirst.filter((inv) => {
    const text = searchText(inv);
    const phones = digits(`${inv.customerPhone} ${inv.altPhone}`);
    return words.every((w) => text.includes(w) || (/^\d{3,}$/.test(w) && phones.includes(w)));
  });
}

/** One order as plain lines, with totals already worked out, for the AI to read. */
export function orderForAI(inv: Invoice): string {
  const t = calculateTotals(inv);
  const lines = [
    // Spelled out, because the on-device model doesn't work out that "Sent" means not paid.
    `Invoice #${inv.invoiceNumber} | date ${inv.date} | ` +
      (inv.paidAt
        ? `Paid (${inv.paymentMethod || "paid"} on ${inv.paidAt.slice(0, 10)})`
        : `NOT PAID (${inv.sentAt ? `texted ${inv.sentAt.slice(0, 10)}` : "draft, not texted yet"})`),
    `Customer: ${inv.customerName || "(no name)"} ${inv.customerPhone} ${inv.customerCityStateZip}`.trim(),
  ];
  const bikes = bikeLabels(inv);
  if (bikes.length) lines.push(`Bikes: ${bikes.join("; ")}`);
  const work = [...inv.services, ...inv.serviceNotes.filter((n) => n.trim())];
  if (work.length) lines.push(`Work: ${work.join("; ")}`);
  const items = inv.lineItems.filter((li) => li.description.trim());
  if (items.length)
    lines.push(`Parts & accessories: ${items.map((li) => `${li.quantity} × ${li.description} @ ${formatMoney(li.unitPrice)}`).join("; ")}`);
  if (inv.promisedAt) lines.push(`Promised: ${inv.promisedAt}`);
  lines.push(
    `Parts ${formatMoney(t.parts)}, labor ${formatMoney(t.labor)}, other ${formatMoney(t.other)}, tax ${formatMoney(t.tax)}, total ${formatMoney(t.total)}, ` +
      (inv.paidAt ? "nothing owed" : `owed ${formatMoney(t.total)}`),
  );
  return lines.join("\n");
}

/** Which orders are unpaid and what they add up to, worked out here so the AI doesn't have to. */
export function unpaidSummary(invoices: Invoice[]): string {
  const unpaid = invoices.filter((inv) => !inv.paidAt);
  if (unpaid.length === 0) return "Every order is paid; nothing is owed.";
  const owed = unpaid.reduce((sum, inv) => sum + calculateTotals(inv).total, 0);
  const list = unpaid.map((inv) => `#${inv.invoiceNumber} ${formatMoney(calculateTotals(inv).total)}`).join(", ");
  return `Not paid yet: ${list}. Owed in all: ${formatMoney(owed)}. All other orders are paid.`;
}
