import { useState } from "react";
import type { AIAnswer } from "../askAI";
import { askAboutOrders, explainAIError } from "../askAI";
import type { Invoice } from "../types";

/** Asking state shared by the Orders search box and the Income tab's Ask button. */
export function useAsk(orders: Invoice[], context = "") {
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AIAnswer | null>(null);
  const [error, setError] = useState("");

  const ask = async (question: string) => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setError("");
    setAnswer(null);
    try {
      setAnswer(await askAboutOrders(question.trim(), orders, context));
    } catch (e) {
      setError(explainAIError(e));
    } finally {
      setAsking(false);
    }
  };
  const clear = () => {
    setAnswer(null);
    setError("");
  };
  return { asking, answer, error, ask, clear };
}

export function AnswerView({
  answer,
  error,
  children,
}: {
  answer: AIAnswer | null;
  error: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      {error && (
        <p className="warn" role="alert">
          {error}
        </p>
      )}
      {answer && (
        <div className="answer" aria-label="AI answer">
          <p>{answer.answer}</p>
          {children}
        </div>
      )}
    </>
  );
}
