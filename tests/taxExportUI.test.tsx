import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TaxExport from "../src/components/TaxExport";
import IncomePanel from "../src/components/IncomePanel";
import { blankInvoice, DEFAULT_OWNER, DEFAULT_SHOP } from "../src/invoice";
import { shareReport } from "../src/shareReport";
vi.mock("../src/shareReport", () => ({ shareReport: vi.fn() }));
beforeEach(() => { vi.mocked(shareReport).mockReset().mockResolvedValue("downloaded"); });

describe("Export & share", () => {
  it("selects a tax year independently of Income period and exports CSV and PDF", async () => {
    const user = userEvent.setup();
    const year = new Date().getFullYear() - 1;
    const invoice = { ...blankInvoice(), paidAt: new Date(year, 0, 2, 12).toISOString(), labor: 25 };
    render(<IncomePanel invoices={[invoice]} owner={DEFAULT_OWNER} shop={{ ...DEFAULT_SHOP, name: "Export Shop" }} />);
    await user.click(screen.getByRole("button", { name: "This month" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Export tax year" }), String(year));
    expect(screen.getByText(new RegExp(`1 paid invoice in ${year}`))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export CSV (accountant / Excel)" }));
    await waitFor(() => expect(shareReport).toHaveBeenCalledWith(expect.objectContaining({ type: "text/csv;charset=utf-8" }), `bike-sales-tax-${year}.csv`));
    expect(await screen.findByRole("status")).toHaveTextContent("Report downloaded");
    await user.click(screen.getByRole("button", { name: "Export PDF sales report" }));
    await waitFor(() => expect(shareReport).toHaveBeenLastCalledWith(expect.objectContaining({ type: "application/pdf" }), `bike-sales-tax-${year}.pdf`));
  });

  it("supports empty years with an explicit zero-totals message", async () => {
    render(<TaxExport invoices={[]} shop={DEFAULT_SHOP} />);
    expect(screen.getByText(/Reports will show zero totals/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    await waitFor(() => expect(shareReport).toHaveBeenCalledOnce());
  });

  it("blocks exporting if storage contains unreadable records", () => {
    localStorage.setItem("bike-invoices", "[null]");
    render(<TaxExport invoices={[]} shop={DEFAULT_SHOP} />);
    expect(screen.getByRole("alert")).toHaveTextContent("stored records are unreadable");
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Export PDF/ })).toBeDisabled();
    expect(shareReport).not.toHaveBeenCalled();
  });

  it("disables duplicate exports until sharing completes and reports cancellation", async () => {
    let finish!: (result: "cancelled") => void;
    vi.mocked(shareReport).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<TaxExport invoices={[]} shop={DEFAULT_SHOP} />);
    await userEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Export PDF/ })).toBeDisabled();
    expect(screen.getByRole("combobox")).toBeDisabled();
    finish("cancelled");
    expect(await screen.findByText(/Sharing cancelled/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export CSV/ })).toBeEnabled();
  });

  it("shows a sharing failure and allows retry without claiming delivery", async () => {
    vi.mocked(shareReport).mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce("shared");
    render(<TaxExport invoices={[]} shop={DEFAULT_SHOP} />);
    await userEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be exported or shared");
    await userEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("Check your chosen app for delivery");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
