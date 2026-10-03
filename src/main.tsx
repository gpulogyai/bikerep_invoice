import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { askAboutOrders, explainAIError } from "./askAI";
import { loadInvoices } from "./invoice";

// Lets a debug iPhone build ask Apple Intelligence about the saved orders without tapping the screen
// (launched with ASK_SELF_TEST set, see ios/App/App/BridgeViewController.swift).
(window as unknown as { bikeInvoicesAsk: (question: string) => Promise<unknown> }).bikeInvoicesAsk = async (question) => {
  try {
    return await askAboutOrders(question, loadInvoices());
  } catch (e) {
    return { error: explainAIError(e), code: (e as { code?: string }).code };
  }
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
