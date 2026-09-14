import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

describe("invoice app", () => {
  it("adds two bikes, removes the first, and the preview shows the remaining one", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Bike 1"), "Specialized Expedition");
    await user.click(screen.getByRole("button", { name: "+ Add bike" }));
    await user.type(screen.getByLabelText("Bike 2"), "Hyper Explorer");
    await user.click(screen.getByRole("button", { name: "Remove bike 1" }));

    expect(screen.getByLabelText("Bike 1")).toHaveValue("Hyper Explorer");
    expect(screen.queryByLabelText("Bike 2")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByText("Bike: Hyper Explorer")).toBeInTheDocument();
  });

  it("shows service notes and computes totals in the preview", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Note 1"), "Lube chain");
    await user.click(screen.getByRole("button", { name: "+ Add note" }));
    await user.type(screen.getByLabelText("Note 2"), "Align derailleur hanger");

    await user.type(screen.getByLabelText("Item 1 description"), "Tune-up");
    const price = screen.getByLabelText("Item 1 unit price");
    await user.clear(price);
    await user.type(price, "50");
    await user.click(screen.getByRole("button", { name: "+ Add item" }));
    await user.type(screen.getByLabelText("Item 2 description"), "Tube");
    const qty2 = screen.getByLabelText("Item 2 quantity");
    await user.clear(qty2);
    await user.type(qty2, "2");
    const price2 = screen.getByLabelText("Item 2 unit price");
    await user.clear(price2);
    await user.type(price2, "7.5");
    const tax = screen.getByLabelText("Tax rate (%)");
    await user.clear(tax);
    await user.type(tax, "10");

    await user.click(screen.getByRole("tab", { name: "Preview" }));
    const preview = screen.getByRole("region", { name: "Invoice preview" });
    expect(within(preview).getByText("Lube chain")).toBeInTheDocument();
    expect(within(preview).getByText("Align derailleur hanger")).toBeInTheDocument();
    expect(within(preview).getByTestId("subtotal")).toHaveTextContent("$65.00");
    expect(within(preview).getByTestId("tax")).toHaveTextContent("$6.50");
    expect(within(preview).getByTestId("total")).toHaveTextContent("$71.50");
  });

  it("saves an invoice and lists it under Saved", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Name"), "Jordan");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved invoice #1001");

    await user.click(screen.getByRole("tab", { name: "Saved (1)" }));
    expect(screen.getByRole("button", { name: /#1001 · Jordan/ })).toBeInTheDocument();
  });
});
