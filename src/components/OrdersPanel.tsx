import { useState } from "react";
import type { Invoice } from "../types";
import { calculateTotals, formatMoney } from "../invoice";
import { orderStatus, searchOrders } from "../orders";
import { AnswerView, useAsk } from "./AskBox";

interface Props {
  orders: Invoice[];
  onOpen: (inv: Invoice) => void;
  onDelete: (id: string) => void;
}

export default function OrdersPanel({ orders, onOpen, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const { asking, answer, error, ask, clear } = useAsk(orders);

  // An answer shows the orders it names; otherwise the box filters the list as you type.
  const fromAnswer = answer?.invoiceNumbers.length ? new Set(answer.invoiceNumbers) : null;
  const shown = fromAnswer
    ? [...orders].reverse().filter((inv) => fromAnswer.has(inv.invoiceNumber))
    : searchOrders(orders, query);

  return (
    <div className="card orders">
      <form
        className="searchask"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(query);
        }}
      >
        <label htmlFor="order-search">Search or ask</label>
        <div className="row">
          <input
            id="order-search"
            type="search"
            enterKeyHint="search"
            placeholder="Name, phone, bike… or “Who hasn't paid?”"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              clear();
            }}
          />
          <button type="submit" className="askbtn" disabled={asking || !query.trim()}>
            {asking ? "Asking…" : "Ask"}
          </button>
        </div>
        <p className="hint">Typing filters the list. Tap Ask to have Apple Intelligence answer on this phone.</p>
      </form>

      <AnswerView answer={answer} error={error}>
        {fromAnswer && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              clear();
              setQuery("");
            }}
          >
            Show all orders
          </button>
        )}
      </AnswerView>

      <ul className="saved">
        {orders.length === 0 && <li>No orders yet.</li>}
        {orders.length > 0 && shown.length === 0 && <li>No orders match.</li>}
        {shown.map((inv) => (
          <li key={inv.id}>
            <button className="link" onClick={() => onOpen(inv)}>
              #{inv.invoiceNumber} · {inv.customerName || "No name"} · {formatMoney(calculateTotals(inv).total)}
            </button>
            <span className={`badge ${orderStatus(inv).toLowerCase()}`}>{orderStatus(inv)}</span>
            <button
              className="icon"
              aria-label={`Delete invoice ${inv.invoiceNumber}`}
              onClick={() => onDelete(inv.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
