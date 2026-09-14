import type { Invoice } from "../types";
import { calculateTotals, formatMoney, lineTotal } from "../invoice";

export default function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const totals = calculateTotals(invoice);
  const bikes = invoice.bikeDescriptions.filter((b) => b.trim());
  const notes = invoice.serviceNotes.filter((n) => n.trim());
  const items = invoice.lineItems.filter((li) => li.description.trim() || lineTotal(li) !== 0);

  return (
    <section className="card preview" aria-label="Invoice preview">
      <header>
        <h2>{invoice.shopName || "—"}</h2>
        <div>
          Invoice #{invoice.invoiceNumber} · {invoice.date}
        </div>
      </header>
      <div>Customer: {invoice.customerName || "—"}</div>
      <div>Phone: {invoice.customerPhone || "—"}</div>
      <div>Bike: {bikes.length ? bikes.join(", ") : "—"}</div>

      {notes.length > 0 && (
        <ul className="notes">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Qty</th>
            <th className="num">Price</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((li) => (
            <tr key={li.id}>
              <td>{li.description || "—"}</td>
              <td className="num">{li.quantity}</td>
              <td className="num">{formatMoney(li.unitPrice)}</td>
              <td className="num">{formatMoney(lineTotal(li))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="totals">
        <dt>Subtotal</dt>
        <dd data-testid="subtotal">{formatMoney(totals.subtotal)}</dd>
        <dt>Tax ({invoice.taxRate.toFixed(2)}%)</dt>
        <dd data-testid="tax">{formatMoney(totals.tax)}</dd>
        <dt>Total</dt>
        <dd data-testid="total">{formatMoney(totals.total)}</dd>
      </dl>
    </section>
  );
}
