import { useState } from "react";
import type { Invoice, OwnerSettings } from "../types";
import { formatMoney } from "../invoice";
import { monthlyIncome, periodRange, summarizeIncome } from "../income";
import type { Period } from "../income";
import { AnswerView, useAsk } from "./AskBox";

interface Props {
  invoices: Invoice[];
  owner: OwnerSettings;
  onOwner: (owner: OwnerSettings) => void;
  unlocked: boolean;
  onUnlock: (unlocked: boolean) => void;
}

const PERIODS: [Period, string][] = [
  ["month", "This month"],
  ["year", "This year"],
  ["lastYear", "Last year"],
  ["all", "All time"],
];

export default function IncomePanel({ invoices, owner, onOwner, unlocked, onUnlock }: Props) {
  const [entered, setEntered] = useState("");
  const [wrong, setWrong] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const { asking, answer, error, ask, clear } = useAsk(invoices, incomeContext(invoices, owner.incomeTaxRate));

  if (owner.pin && !unlocked) {
    return (
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          const ok = entered === owner.pin;
          setWrong(!ok);
          setEntered("");
          if (ok) onUnlock(true);
        }}
      >
        <fieldset>
          <legend>Owner only</legend>
          <div className="pin">
            <label>
              Owner PIN
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={entered}
                onChange={(e) => setEntered(e.target.value)}
              />
            </label>
            <button type="submit">Unlock</button>
          </div>
          {wrong && <p className="warn">Wrong PIN.</p>}
        </fieldset>
      </form>
    );
  }

  const { from, to } = periodRange(period);
  const s = summarizeIncome(invoices, from, to, owner.incomeTaxRate);
  const year = new Date().getFullYear() - (period === "lastYear" ? 1 : 0);
  const months = period === "year" || period === "lastYear" ? monthlyIncome(invoices, year, owner.incomeTaxRate) : [];
  const rows: [string, number, string?][] = [
    ["Parts & accessories", s.parts],
    ["Labor", s.labor],
    ["Other charges", s.other],
    ["Net sales (income before expenses)", s.netSales, "net"],
    ["Sales tax collected (owed to the state)", s.salesTax, "salesTax"],
    ["Total collected", s.collected, "collected"],
  ];

  return (
    <section className="card income" aria-label="Income">
      <div className="periods" role="group" aria-label="Period">
        {PERIODS.map(([p, label]) => (
          <button
            key={p}
            type="button"
            className={period === p ? "" : "secondary"}
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
          >
            {label}
          </button>
        ))}
      </div>

      {askOpen ? (
        <form
          className="askincome"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <label>
            Ask about your income
            <textarea
              rows={2}
              autoFocus
              placeholder="e.g. How much did brake jobs bring in this month?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <div className="row">
            <button type="submit" disabled={asking || !question.trim()}>
              {asking ? "Asking…" : "Ask"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setAskOpen(false);
                setQuestion("");
                clear();
              }}
            >
              Close
            </button>
          </div>
          <AnswerView answer={answer} error={error} />
        </form>
      ) : (
        <button type="button" className="askopen" onClick={() => setAskOpen(true)}>
          Ask
        </button>
      )}

      <p className="muted">
        {s.paidCount} paid invoice{s.paidCount === 1 ? "" : "s"}, counted on the day they were marked paid.
      </p>
      <dl className="totals">
        {rows.map(([label, value, id]) => (
          <Row key={label} label={label} value={value} testId={id} />
        ))}
      </dl>

      <h3>Income tax</h3>
      <label>
        Set aside for income tax (%)
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          value={owner.incomeTaxRate}
          onChange={(e) => onOwner({ ...owner, incomeTaxRate: Number(e.target.value) })}
        />
      </label>
      <dl className="totals">
        <Row label={`Set aside (${owner.incomeTaxRate || 0}% of net sales)`} value={s.incomeTax} testId="incomeTax" />
        <Row label="Left after income tax" value={s.afterIncomeTax} testId="afterIncomeTax" />
      </dl>
      <p className="hint">
        An estimate on sales, before parts cost and other expenses — confirm the rate with your accountant. Sales tax
        comes from the tax rate on each invoice.
      </p>

      {s.unpaidCount > 0 && (
        <p className="warn">
          Not paid yet: {s.unpaidCount} sent invoice
          {s.unpaidCount === 1 ? "" : "s"}, {formatMoney(s.unpaid)}
        </p>
      )}

      {months.length > 0 && (
        <table aria-label={`Monthly income ${year}`}>
          <thead>
            <tr>
              <th>{year}</th>
              <th className="num">Paid</th>
              <th className="num">Net sales</th>
              <th className="num">Sales tax</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <td>{m.month}</td>
                <td className="num">{m.paidCount}</td>
                <td className="num">{formatMoney(m.netSales)}</td>
                <td className="num">{formatMoney(m.salesTax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Owner PIN</h3>
      <div className="pin">
        <label>
          {owner.pin ? "Change PIN" : "Set a PIN to hide this tab"}
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="4+ digits"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <button
          type="button"
          disabled={newPin.length < 4}
          onClick={() => {
            onOwner({ ...owner, pin: newPin });
            setNewPin("");
          }}
        >
          Save PIN
        </button>
      </div>
      {owner.pin && (
        <div className="row after">
          <button type="button" className="secondary" onClick={() => onUnlock(false)}>
            Lock now
          </button>
          <button type="button" className="secondary" onClick={() => onOwner({ ...owner, pin: "" })}>
            Remove PIN
          </button>
        </div>
      )}
    </section>
  );
}

/** The Income tab's own figures, so answers use the same totals the owner sees. */
function incomeContext(invoices: Invoice[], rate: number): string {
  const lines = PERIODS.map(([p, label]) => {
    const { from, to } = periodRange(p);
    const x = summarizeIncome(invoices, from, to, rate);
    return `${label}: ${x.paidCount} paid, net sales ${formatMoney(x.netSales)} (parts & accessories ${formatMoney(x.parts)}, labor ${formatMoney(x.labor)}, other ${formatMoney(x.other)}), sales tax ${formatMoney(x.salesTax)}, collected ${formatMoney(x.collected)}, income tax set aside at ${rate || 0}% ${formatMoney(x.incomeTax)}, unpaid ${x.unpaidCount} (${formatMoney(x.unpaid)})`;
  });
  return `Income (paid invoices count on the day they were paid):\n${lines.join("\n")}`;
}

function Row({ label, value, testId }: { label: string; value: number; testId?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={testId}>{formatMoney(value)}</dd>
    </>
  );
}
