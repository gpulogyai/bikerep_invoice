import { useState, useRef, useEffect } from "react";
import type { AIAnswer } from "../askAI";
import { askAboutOrders, explainAIError } from "../askAI";
import type { Invoice } from "../types";

/** Asking state shared by the Orders search box and the Income tab's Ask button. */
export function useAsk(orders: Invoice[], context = "") {
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AIAnswer | null>(null);
  const [error, setError] = useState("");

  const ask = async (question: string) => {
    if (!question.trim() || asking) return;
    const id = ++request.current;
    setAsking(true);
    setError("");
    setAnswer(null);
    try {
      const result = await askAboutOrders(question.trim(), orders, context);
      if (id === request.current) setAnswer(result);
    } catch (e) {
      if (id === request.current) setError(explainAIError(e));
    } finally {
      if (id === request.current) setAsking(false);
    }
  };
  const clear = () => {
    request.current++;
    setAsking(false);
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
