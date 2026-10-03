import { CHARGE_KEYS } from "../types";
import type { Invoice, ShopInfo } from "../types";
import { CHARGE_LABELS, bikeLabels, calculateTotals, formatMoney, lineTotal } from "../invoice";

const CONDITION_CODE = { new: "", used: "U", rebuilt: "R", reconditioned: "RC" } as const;
const ESTIMATE_TEXT = {
  "": "",
  written: "Customer requested a written estimate",
  limit: "No written estimate as long as the cost does not exceed",
  none: "Customer did not request a written estimate",
} as const;

const when = (v: string) => (v ? v.replace("T", " ") : "");

export default function InvoicePreview({ invoice, shop }: { invoice: Invoice; shop: ShopInfo }) {
  const totals = calculateTotals(invoice);
  const bikes = bikeLabels(invoice);
  const notes = [...invoice.services, ...invoice.serviceNotes.filter((n) => n.trim())];
  const shown = invoice.lineItems.filter((li) => li.description.trim() || lineTotal(li) !== 0);
  const charges = CHARGE_KEYS.filter((k) => invoice.charges[k]);
  const info: [string, string][] = (
    [
      ["Address", [invoice.customerAddress, invoice.customerCityStateZip].filter(Boolean).join(", ")],
      ["2nd authorized", [invoice.altName, invoice.altPhone].filter(Boolean).join(" · ")],
      ["Order no.", invoice.customerOrderNo],
      ["Received", when(invoice.receivedAt)],
      ["Promised", when(invoice.promisedAt)],
      ["Written by", invoice.writtenBy],
    ] as [string, string][]
  ).filter(([, v]) => v.trim());

  return (
    <section className="card preview" aria-label="Invoice preview">
      <header>
        <h2>{shop.name || "—"}</h2>
        <div className="muted">
          {[shop.address, shop.cityStateZip, shop.phone].filter(Boolean).join(" · ")}
        </div>
        <div>
          Invoice #{invoice.invoiceNumber} · {invoice.date}
          {invoice.paidAt && <strong className="paid"> PAID</strong>}
        </div>
      </header>
      <div>Customer: {invoice.customerName || "—"}</div>
      <div>Phone: {invoice.customerPhone || "—"}</div>
      <div>Bike: {bikes.length ? bikes.join(", ") : "—"}</div>
      {info.map(([k, v]) => (
        <div key={k}>
          {k}: {v}
        </div>
      ))}

      {notes.length > 0 && (
        <>
          <h3>Service performed</h3>
          <ul className="notes">
            {notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </>
      )}

      <table>
        <thead>
          <tr>
            <th className="num">Qty</th>
            <th>Part / accessory</th>
            <th className="num">Price</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((li) => (
            <tr key={li.id}>
              <td className="num">{li.quantity}</td>
              <td>
                {li.description || "—"}
                {li.partNo && <span className="muted"> #{li.partNo}</span>}
                {CONDITION_CODE[li.condition] && <span className="muted"> ({CONDITION_CODE[li.condition]})</span>}
                {li.warranty && <span className="muted"> · warranty</span>}
              </td>
              <td className="num">{formatMoney(li.unitPrice)}</td>
              <td className="num">{formatMoney(lineTotal(li))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="totals">
        <dt>Parts &amp; accessories</dt>
        <dd data-testid="parts">{formatMoney(totals.parts)}</dd>
        <dt>Labor{invoice.labor ? ` (${invoice.laborBasis === "both" ? "flat + hourly" : invoice.laborBasis === "hourly" ? "hourly" : "flat rate"})` : ""}</dt>
        <dd data-testid="labor">{formatMoney(totals.labor)}</dd>
        {charges.map((k) => (
          <FragmentRow key={k} label={CHARGE_LABELS[k]} value={formatMoney(invoice.charges[k])} />
        ))}
        <dt>Subtotal</dt>
        <dd data-testid="subtotal">{formatMoney(totals.subtotal)}</dd>
        <dt>Tax ({invoice.taxRate.toFixed(2)}%)</dt>
        <dd data-testid="tax">{formatMoney(totals.tax)}</dd>
        <dt className="grand">Total</dt>
        <dd className="grand" data-testid="total">
          {formatMoney(totals.total)}
        </dd>
      </dl>

      {(invoice.estimateChoice || invoice.partsDisposition || invoice.guaranteeUntil || invoice.authorizedBy) && (
        <div className="terms">
          {invoice.estimateChoice && (
            <div>
              {ESTIMATE_TEXT[invoice.estimateChoice]}
              {invoice.estimateChoice !== "none" && invoice.estimateAmount ? `: ${formatMoney(invoice.estimateAmount)}` : ""}
            </div>
          )}
          {invoice.partsDisposition && (
            <div>Replaced parts: {invoice.partsDisposition === "retain" ? "retain" : "destroy"}</div>
          )}
          {invoice.guaranteeUntil && <div>Guarantee effective until {invoice.guaranteeUntil}</div>}
          {invoice.authorizedBy && <div>Authorized by {invoice.authorizedBy}</div>}
        </div>
      )}
    </section>
  );
}

function FragmentRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={testId}>{value}</dd>
    </>
  );
}
