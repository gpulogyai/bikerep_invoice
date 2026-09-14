import type { Dispatch, SetStateAction } from "react";
import type { Invoice, LineItem } from "../types";
import { emptyLineItem } from "../invoice";

interface Props {
  invoice: Invoice;
  setInvoice: Dispatch<SetStateAction<Invoice>>;
}

type ListKey = "bikeDescriptions" | "serviceNotes";

export default function InvoiceForm({ invoice, setInvoice }: Props) {
  const update = (patch: Partial<Invoice>) => setInvoice((d) => ({ ...d, ...patch }));

  const setListItem = (key: ListKey, index: number, value: string) =>
    setInvoice((d) => ({ ...d, [key]: d[key].map((v, i) => (i === index ? value : v)) }));
  const addListItem = (key: ListKey) => setInvoice((d) => ({ ...d, [key]: [...d[key], ""] }));
  const removeListItem = (key: ListKey, index: number) =>
    setInvoice((d) => {
      const next = d[key].filter((_, i) => i !== index);
      return { ...d, [key]: next.length ? next : [""] };
    });

  const setLine = (id: string, patch: Partial<LineItem>) =>
    setInvoice((d) => ({
      ...d,
      lineItems: d.lineItems.map((li) => (li.id === id ? { ...li, ...patch } : li)),
    }));
  const addLine = () => setInvoice((d) => ({ ...d, lineItems: [...d.lineItems, emptyLineItem()] }));
  const removeLine = (id: string) =>
    setInvoice((d) => {
      const next = d.lineItems.filter((li) => li.id !== id);
      return { ...d, lineItems: next.length ? next : [emptyLineItem()] };
    });

  const listSection = (key: ListKey, title: string, singular: string, placeholder: string) => (
    <fieldset>
      <legend>{title}</legend>
      {invoice[key].map((value, i) => (
        <div className="row" key={`${key}-${i}`}>
          <input
            aria-label={`${singular} ${i + 1}`}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setListItem(key, i, e.target.value)}
          />
          <button
            type="button"
            className="icon"
            aria-label={`Remove ${singular.toLowerCase()} ${i + 1}`}
            onClick={() => removeListItem(key, i)}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="secondary" onClick={() => addListItem(key)}>
        + Add {singular.toLowerCase()}
      </button>
    </fieldset>
  );

  return (
    <form className="card" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>Invoice</legend>
        <label>
          Shop name
          <input value={invoice.shopName} onChange={(e) => update({ shopName: e.target.value })} />
        </label>
        <div className="grid2">
          <label>
            Invoice #
            <input
              value={invoice.invoiceNumber}
              onChange={(e) => update({ invoiceNumber: e.target.value })}
            />
          </label>
          <label>
            Date
            <input type="date" value={invoice.date} onChange={(e) => update({ date: e.target.value })} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Customer</legend>
        <label>
          Name
          <input
            value={invoice.customerName}
            onChange={(e) => update({ customerName: e.target.value })}
          />
        </label>
        <label>
          Phone
          <input
            type="tel"
            inputMode="tel"
            value={invoice.customerPhone}
            onChange={(e) => update({ customerPhone: e.target.value })}
          />
        </label>
      </fieldset>

      {listSection("bikeDescriptions", "Bikes", "Bike", "e.g. Specialized Expedition")}
      {listSection("serviceNotes", "Service notes", "Note", "e.g. Lube chain, align hanger")}

      <fieldset>
        <legend>Parts &amp; labour</legend>
        {invoice.lineItems.map((li, i) => (
          <div className="line" key={li.id}>
            <input
              aria-label={`Item ${i + 1} description`}
              placeholder="Description"
              value={li.description}
              onChange={(e) => setLine(li.id, { description: e.target.value })}
            />
            <input
              aria-label={`Item ${i + 1} quantity`}
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={li.quantity}
              onChange={(e) => setLine(li.id, { quantity: Number(e.target.value) })}
            />
            <input
              aria-label={`Item ${i + 1} unit price`}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={li.unitPrice}
              onChange={(e) => setLine(li.id, { unitPrice: Number(e.target.value) })}
            />
            <button
              type="button"
              className="icon"
              aria-label={`Remove item ${i + 1}`}
              onClick={() => removeLine(li.id)}
            >
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="secondary" onClick={addLine}>
          + Add item
        </button>
        <label>
          Tax rate (%)
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={invoice.taxRate}
            onChange={(e) => update({ taxRate: Number(e.target.value) })}
          />
        </label>
      </fieldset>
    </form>
  );
}
