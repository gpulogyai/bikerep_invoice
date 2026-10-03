import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App";

vi.mock("../src/contacts", () => ({
  canPickContact: () => true,
  pickContact: vi.fn(async () => ({
    name: "Nuruddin Ahmed",
    phone: "(347) 828-5828",
    address: "12 Elm St",
    cityStateZip: "Plano, TX 75075",
  })),
}));

const setNumber = async (user: ReturnType<typeof userEvent.setup>, label: string, value: string) => {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, value);
};

describe("invoice app", () => {
  it("adds two bikes, removes the first, and the preview shows the remaining one", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("Bike 1 brand"), "Specialized");
    await user.selectOptions(screen.getByLabelText("Bike 1 model"), "Expedition");
    await user.click(screen.getByRole("button", { name: "+ Add bike" }));
    await user.selectOptions(screen.getByLabelText("Bike 2 brand"), "Hyper");
    await user.selectOptions(screen.getByLabelText("Bike 2 model"), "Explorer");
    await user.type(screen.getByLabelText("Bike 2 serial #"), "HX-778");
    await user.click(screen.getByRole("button", { name: "Remove bike 1" }));

    expect(screen.getByLabelText("Bike 1 brand")).toHaveValue("Hyper");
    expect(screen.getByLabelText("Bike 1 model")).toHaveValue("Explorer");
    expect(screen.getByLabelText("Bike 1 serial #")).toHaveValue("HX-778");
    expect(screen.queryByLabelText("Bike 2 brand")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Send" }));
    expect(screen.getByText("Bike: Hyper Explorer (S/N HX-778)")).toBeInTheDocument();
  });

  it("offers only the chosen brand's models, and lets an unlisted model be typed", async () => {
    const user = userEvent.setup();
    render(<App />);

    const model = screen.getByLabelText("Bike 1 model");
    expect(model).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Bike 1 brand"), "Trek");
    const options = within(model).getAllByRole("option").map((o) => o.textContent);
    expect(options).toContain("Marlin");
    expect(options).not.toContain("Rockhopper");

    await user.selectOptions(screen.getByLabelText("Bike 1 brand"), "Specialized");
    expect(within(model).getAllByRole("option").map((o) => o.textContent)).toContain("Rockhopper");
    expect(within(model).queryByRole("option", { name: "Marlin" })).not.toBeInTheDocument();

    await user.selectOptions(model, "Other (type it in)");
    await user.type(screen.getByLabelText("Bike 1"), "Rockhopper Comp 29");
    await user.click(screen.getByRole("tab", { name: "Send" }));
    expect(screen.getByText("Bike: Specialized Rockhopper Comp 29")).toBeInTheDocument();
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
    await user.selectOptions(screen.getByLabelText("Add part or accessory"), "Other (type it in)");
    await user.type(screen.getByLabelText("Item 2 description"), "Tube");
    const qty2 = screen.getByLabelText("Item 2 quantity");
    await user.clear(qty2);
    await user.type(qty2, "2");
    const price2 = screen.getByLabelText("Item 2 unit price");
    await user.clear(price2);
    await user.type(price2, "7.5");
    const labor = screen.getByLabelText("Labor");
    await user.clear(labor);
    await user.type(labor, "20");
    const tax = screen.getByLabelText("Tax rate (%)");
    await user.clear(tax);
    await user.type(tax, "10");

    await user.click(screen.getByRole("tab", { name: "Send" }));
    const preview = screen.getByRole("region", { name: "Invoice preview" });
    expect(within(preview).getByText("Lube chain")).toBeInTheDocument();
    expect(within(preview).getByText("Align derailleur hanger")).toBeInTheDocument();
    expect(within(preview).getByTestId("subtotal")).toHaveTextContent("$85.00");
    expect(within(preview).getByTestId("parts")).toHaveTextContent("$65.00");
    expect(within(preview).getByTestId("labor")).toHaveTextContent("$20.00");
    expect(within(preview).getByTestId("tax")).toHaveTextContent("$8.50");
    expect(within(preview).getByTestId("total")).toHaveTextContent("$93.50");
  });

  it("saves an invoice and lists it under Orders", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Name"), "Jordan");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved invoice #1001");

    await user.click(screen.getByRole("tab", { name: "Orders (1)" }));
    expect(screen.getByRole("button", { name: /#1001 · Jordan/ })).toBeInTheDocument();
  });

  it("texts the invoice to the customer's phone with Zelle and link, then records payment", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "Shop" }));
    await user.type(screen.getByLabelText("Zelle phone or email"), "(408) 569-4378");
    await user.type(screen.getByLabelText("Payment link"), "https://pay.example/nbr?amt={{amount}");

    await user.click(screen.getByRole("tab", { name: "Edit" }));
    await user.type(screen.getByLabelText("Name"), "Nuruddin Ahmed");
    await user.type(screen.getByLabelText("Phone"), "347 828-5828");
    await user.type(screen.getByLabelText("Item 1 description"), "Tires");
    const price = screen.getByLabelText("Item 1 unit price");
    await user.clear(price);
    await user.type(price, "99");
    const labor = screen.getByLabelText("Labor");
    await user.clear(labor);
    await user.type(labor, "60");

    await user.click(screen.getByRole("tab", { name: "Send" }));
    const send = screen.getByRole("link", { name: /Text invoice \(\$159\.00\) to 347 828-5828/ });
    const href = send.getAttribute("href")!;
    expect(href.startsWith("sms:+13478285828?&body=")).toBe(true);
    const body = decodeURIComponent(href.split("body=")[1]);
    expect(body).toContain("TOTAL DUE: $159.00");
    expect(body).toContain("Pay with Zelle to (408) 569-4378");
    expect(body).toContain("Or pay online: https://pay.example/nbr?amt=159.00");

    send.addEventListener("click", (e) => e.preventDefault());
    await user.click(send);
    expect(screen.getByRole("status")).toHaveTextContent("Texted invoice #1001");

    await user.selectOptions(screen.getByLabelText("Payment method"), "zelle");
    await user.click(screen.getByRole("button", { name: "Mark paid" }));
    expect(screen.getByRole("note")).toHaveTextContent("Paid by Zelle");

    await user.click(screen.getByRole("tab", { name: "Orders (1)" }));
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("blocks sending until the customer has a phone number", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Send" }));
    expect(screen.getByText("Add the customer's phone number on the Edit tab.")).toBeInTheDocument();
    expect(screen.getByText(/Text invoice/).closest("a")).not.toHaveAttribute("href");
  });

  it("fills the customer from phone contacts", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Choose from contacts" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Nuruddin Ahmed");
    expect(screen.getByLabelText("Phone")).toHaveValue("(347) 828-5828");
    expect(screen.getByLabelText("City, state, ZIP")).toHaveValue("Plano, TX 75075");
  });

  it("picks bike brands for several bikes, checks services and adds parts and accessories from one list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("Bike 1 brand"), "Specialized");
    await user.selectOptions(screen.getByLabelText("Bike 1 model"), "Expedition");
    await user.click(screen.getByRole("button", { name: "+ Add bike" }));
    await user.selectOptions(screen.getByLabelText("Bike 2 brand"), "Trek");
    await user.selectOptions(screen.getByLabelText("Bike 2 model"), "820");
    expect(screen.getByLabelText("Bike 1 model")).toHaveValue("Expedition");

    await user.click(screen.getByLabelText("Flat tire repair"));
    await user.click(screen.getByLabelText("Brake adjustment"));
    await user.click(screen.getByLabelText("Wheel truing"));
    await user.click(screen.getByLabelText("Wheel truing")); // unchecked again

    await user.selectOptions(screen.getByLabelText("Add part or accessory"), "Helmet");
    await user.selectOptions(screen.getByLabelText("Add part or accessory"), "Chain");
    expect(screen.getByLabelText("Item 1 description")).toHaveValue("Helmet");
    await setNumber(user, "Item 1 unit price", "40");
    await setNumber(user, "Item 2 quantity", "2");
    await setNumber(user, "Item 2 unit price", "6");
    await setNumber(user, "Labor", "20");

    await user.click(screen.getByRole("tab", { name: "Send" }));
    const preview = screen.getByRole("region", { name: "Invoice preview" });
    expect(within(preview).getByText("Bike: Specialized Expedition, Trek 820")).toBeInTheDocument();
    expect(within(preview).getByText("Flat tire repair")).toBeInTheDocument();
    expect(within(preview).getByText("Brake adjustment")).toBeInTheDocument();
    expect(within(preview).queryByText("Wheel truing")).not.toBeInTheDocument();
    expect(within(preview).getByText("Helmet")).toBeInTheDocument();
    expect(within(preview).getByText("Chain")).toBeInTheDocument();
    expect(within(preview).getByTestId("parts")).toHaveTextContent("$52.00");
    expect(within(preview).getByTestId("total")).toHaveTextContent("$72.00");
  });

  it("shows the owner income and tax behind a PIN that relocks when leaving the tab", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Phone"), "347 828-5828");
    await user.type(screen.getByLabelText("Item 1 description"), "Tires");
    await setNumber(user, "Item 1 unit price", "100");
    await setNumber(user, "Tax rate (%)", "8.25");
    await user.click(screen.getByRole("tab", { name: "Send" }));
    await user.click(screen.getByRole("button", { name: "Mark paid" }));

    await user.click(screen.getByRole("tab", { name: "Income" }));
    const income = screen.getByRole("region", { name: "Income" });
    expect(within(income).getByTestId("collected")).toHaveTextContent("$108.25");
    expect(within(income).getByTestId("salesTax")).toHaveTextContent("$8.25");
    expect(within(income).getByTestId("net")).toHaveTextContent("$100.00");
    await setNumber(user, "Set aside for income tax (%)", "25");
    expect(within(income).getByTestId("incomeTax")).toHaveTextContent("$25.00");

    await user.type(screen.getByLabelText("Set a PIN to hide this tab"), "4321");
    await user.click(screen.getByRole("button", { name: "Save PIN" }));
    await user.click(screen.getByRole("tab", { name: "Edit" }));
    await user.click(screen.getByRole("tab", { name: "Income" }));
    expect(screen.queryByRole("region", { name: "Income" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Owner PIN"), "1111");
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    expect(screen.getByText("Wrong PIN.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Owner PIN"), "4321");
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    expect(screen.getByTestId("incomeTax")).toHaveTextContent("$25.00");
  });

  it("adds a typed-in brand and model to the pick lists for later invoices", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("Bike 1 brand"), "Other (type it in)");
    await user.type(screen.getByLabelText("Bike 1 new brand"), "GTX Cycles");
    await user.type(screen.getByLabelText("Bike 1"), "Roamer 3");
    // Typing "GT" must not jump to the listed GT brand.
    expect(screen.getByLabelText("Bike 1 new brand")).toHaveValue("GTX Cycles");
    await user.click(screen.getByRole("button", { name: "Add GTX Cycles to brands list" }));

    expect(screen.getByLabelText("Bike 1 brand")).toHaveValue("GTX Cycles");
    expect(screen.getByLabelText("Bike 1")).toHaveValue("Roamer 3");
    await user.click(screen.getByRole("button", { name: "Add Roamer 3 to models list" }));
    expect(screen.getByLabelText("Bike 1 model")).toHaveValue("Roamer 3");
    expect(screen.queryByLabelText("Bike 1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Send" }));
    expect(screen.getByText("Bike: GTX Cycles Roamer 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "New" }));
    await user.selectOptions(screen.getByLabelText("Bike 1 brand"), "GTX Cycles");
    await user.selectOptions(screen.getByLabelText("Bike 1 model"), "Roamer 3");
    expect(JSON.parse(localStorage.getItem("bike-custom-lists")!)).toMatchObject({
      brands: ["GTX Cycles"],
      models: { "GTX Cycles": ["Roamer 3"] },
    });
  });

  it("keeps a typed-in brand and model in their own boxes after switching tabs", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("Bike 1 brand"), "Other (type it in)");
    await user.type(screen.getByLabelText("Bike 1"), "Roamer 3");
    await user.type(screen.getByLabelText("Bike 1 new brand"), "GTX Cycles");
    await user.click(screen.getByRole("tab", { name: "Send" }));
    expect(screen.getByText("Bike: GTX Cycles Roamer 3")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Edit" }));

    expect(screen.getByLabelText("Bike 1 new brand")).toHaveValue("GTX Cycles");
    expect(screen.getByLabelText("Bike 1")).toHaveValue("Roamer 3");
    await user.clear(screen.getByLabelText("Bike 1 new brand"));
    await user.type(screen.getByLabelText("Bike 1 new brand"), "   ");
    expect(screen.getByLabelText("Bike 1")).toHaveValue("Roamer 3");
  });

  it("turns a typed-in service into a checked checklist entry", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Note 1"), "Kickstand install");
    await user.click(screen.getByRole("button", { name: "Add Kickstand install to services list" }));
    expect(screen.getByLabelText("Kickstand install")).toBeChecked();
    expect(screen.getByLabelText("Note 1")).toHaveValue("");

    await user.type(screen.getByLabelText("Note 1"), "brake adjustment");
    expect(screen.queryByRole("button", { name: /to services list/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Send" }));
    const preview = screen.getByRole("region", { name: "Invoice preview" });
    expect(within(preview).getByText("Kickstand install")).toBeInTheDocument();
  });

  it("keeps a typed-in part in the parts & accessories list until removed in Shop", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("Item 1 description"), "Bar ends");
    await user.click(screen.getByRole("button", { name: "Add Bar ends to parts & accessories list" }));
    expect(screen.queryByRole("button", { name: /Add Bar ends/ })).not.toBeInTheDocument();
    const picker = screen.getByLabelText("Add part or accessory");
    expect(within(within(picker).getByRole("group", { name: "Added by you" })).getByRole("option", { name: "Bar ends" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Shop" }));
    await user.click(screen.getByRole("button", { name: "Remove Bar ends from list" }));
    await user.click(screen.getByRole("tab", { name: "Edit" }));
    expect(within(screen.getByLabelText("Add part or accessory")).queryByRole("option", { name: "Bar ends" })).not.toBeInTheDocument();
  });
});
