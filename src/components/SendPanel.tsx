import { useState } from "react";
import type { Invoice, PaymentMethod, ShopInfo } from "../types";
import { calculateTotals, formatMoney } from "../invoice";
import { invoiceMessage, smsHref, smsNumber } from "../message";

interface Props {
  invoice: Invoice;
  shop: ShopInfo;
  onSent: () => void;
  onPaid: (method: PaymentMethod | "") => void;
}

const METHODS: [PaymentMethod, string][] = [
  ["zelle", "Zelle"],
  ["link", "Payment link"],
  ["cash", "Cash"],
  ["card", "Card"],
];

export default function SendPanel({ invoice, shop, onSent, onPaid }: Props) {
  const [method, setMethod] = useState<PaymentMethod>(invoice.paymentMethod || "zelle");
  const phoneOk = smsNumber(invoice.customerPhone).replace("+", "").length >= 10;
  const payOk = Boolean(shop.zelle.trim() || shop.paymentLink.trim());
  const total = formatMoney((invoice.paidAt ? invoice.paymentTotals ?? calculateTotals(invoice) : calculateTotals(invoice)).total);

  return (
    <section className="card send" aria-label="Send and payment">
      <h3>Send to customer</h3>
      {!phoneOk && <p className="warn">Add the customer's phone number on the Edit tab.</p>}
      {!invoice.paidAt && !payOk && <p className="warn">Add your Zelle contact or a payment link on the Shop tab so the customer knows how to pay.</p>}
      <a
        className={`button${phoneOk ? "" : " disabled"}`}
        href={phoneOk ? smsHref(shop, invoice) : undefined}
        aria-disabled={!phoneOk}
        onClick={(e) => { if (!phoneOk) e.preventDefault(); }}
      >
        Open {invoice.paidAt ? "receipt" : "invoice"} ({total}) in Messages to {invoice.customerPhone || "customer"}
      </a>
      <p className="muted">This opens a draft in Messages; the app cannot tell whether you sent it. After sending, confirm below.</p>
      <button type="button" className="secondary" disabled={!phoneOk} onClick={onSent}>
        Confirm invoice sent
      </button>
      {invoice.sentAt && <p className="muted">Marked sent {new Date(invoice.sentAt).toLocaleString()}</p>}
      <details>
        <summary>Message text</summary>
        <pre data-testid="message">{invoiceMessage(shop, invoice)}</pre>
      </details>

      <h3>Payment</h3>
      {invoice.paidAt ? (
        <div className="row">
          <p className="paid" role="note">
            Paid by {METHODS.find(([m]) => m === invoice.paymentMethod)?.[1] ?? "—"} on{" "}
            {new Date(invoice.paidAt).toLocaleDateString()}
          </p>
          <button type="button" className="secondary" onClick={() => onPaid("")}>
            Undo
          </button>
        </div>
      ) : (
        <div className="row">
          <select aria-label="Payment method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHODS.map(([m, label]) => (
              <option key={m} value={m}>
                {label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => onPaid(method)}>
            Mark paid
          </button>
        </div>
      )}
    </section>
  );
}
