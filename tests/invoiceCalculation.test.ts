import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHOP,
  blankInvoice,
  calculateTotals,
  deleteInvoice,
  emptyLineItem,
  lineTotal,
  loadInvoices,
  loadShop,
  saveInvoice,
  saveShop,
} from "../src/invoice";
import { invoiceMessage, paymentLinkFor, smsHref, smsNumber } from "../src/message";
import { BIKE_BRANDS, BIKE_MODELS, joinBike, splitBike, typedBikeModel } from "../src/catalog";
import { summarizeIncome } from "../src/income";
import { addToList, allBrands, allModels, emptyLists, loadLists, removeFromList, saveLists } from "../src/customLists";
import type { Invoice, LineItem } from "../src/types";

const item = (description: string, quantity: number, unitPrice: number): LineItem => ({
  ...emptyLineItem(),
  description,
  quantity,
  unitPrice,
});

/** The shop's paper slip: parts $99.00 + labor $60.00 = $159.00, no tax. */
const slip = (): Invoice => ({
  ...blankInvoice(),
  invoiceNumber: "1001",
  customerName: "Nuruddin Ahmed",
  customerPhone: "347 828-5828",
  bikeDescriptions: ["Specialized Expedition", "Hyper Explorer"],
  serviceNotes: ["Adjusted rear brakes", "Lubed chain"],
  lineItems: [item("Tires", 2, 25), item("Rear brake pads", 1, 8), item("Tubes", 2, 20.5)],
  labor: 60,
});

describe("invoice calculations", () => {
  it("multiplies quantity by unit price per line", () => {
    expect(lineTotal({ quantity: 2, unitPrice: 8.5 })).toBe(17);
  });

  it("sums lines and applies tax rounded to cents", () => {
    const totals = calculateTotals({
      taxRate: 8.25,
      lineItems: [item("Tune-up", 1, 65), item("Brake pads", 2, 12.99), item("Chain lube", 1, 0.1)],
    });
    expect(totals.subtotal).toBe(91.08);
    expect(totals.tax).toBe(7.51);
    expect(totals.total).toBe(98.59);
  });

  it("matches the paper slip: parts + labor + other charges", () => {
    expect(calculateTotals(slip())).toEqual({ parts: 99, labor: 60, other: 0, subtotal: 159, tax: 0, total: 159 });
    const withCharges = { ...slip(), charges: { ...slip().charges, storage: 5, wasteRemoval: 2.5 }, taxRate: 10 };
    expect(calculateTotals(withCharges)).toMatchObject({ other: 7.5, subtotal: 166.5, tax: 16.65, total: 183.15 });
  });

  it("counts accessories together with parts", () => {
    const inv = { ...slip(), lineItems: [...slip().lineItems, item("Helmet", 1, 40)] };
    expect(calculateTotals(inv)).toMatchObject({ parts: 139, subtotal: 199, total: 199 });
    expect(invoiceMessage(DEFAULT_SHOP, inv)).toContain("Parts & accessories $139.00 | Labor $60.00");
  });

  it("treats NaN inputs as zero instead of poisoning the total", () => {
    const totals = calculateTotals({
      taxRate: Number.NaN,
      labor: Number.NaN,
      lineItems: [item("Labour", Number.NaN, 40), item("Cable", 1, 5)],
    });
    expect(totals).toMatchObject({ subtotal: 5, tax: 0, total: 5 });
  });
});

describe("text message to the customer", () => {
  it("normalises US numbers for sms:", () => {
    expect(smsNumber("347 828-5828")).toBe("+13478285828");
    expect(smsNumber("1 (347) 828-5828")).toBe("+13478285828");
  });

  it("includes the total, Zelle contact and a payment link with the amount filled in", () => {
    const shop = { ...DEFAULT_SHOP, zelle: "(408) 569-4378", paymentLink: "https://paypal.me/nbr/{amount}?ref={invoice}" };
    const msg = invoiceMessage(shop, slip());
    expect(msg).toContain("Neighborhood Bike Repair - Invoice #1001");
    expect(msg).toContain("Hi Nuruddin");
    expect(msg).toContain("Bike: Specialized Expedition, Hyper Explorer");
    expect(msg).toContain("Parts & accessories $99.00 | Labor $60.00");
    expect(msg).toContain("TOTAL DUE: $159.00");
    expect(msg).toContain("Pay with Zelle to (408) 569-4378 (memo: Invoice 1001)");
    expect(msg).toContain("Or pay online: https://paypal.me/nbr/159.00?ref=1001");
    expect(paymentLinkFor(shop, slip())).toBe("https://paypal.me/nbr/159.00?ref=1001");

    const href = smsHref(shop, slip());
    expect(href.startsWith("sms:+13478285828?&body=")).toBe(true);
    expect(decodeURIComponent(href.split("body=")[1])).toBe(msg);
  });

  it("leaves out payment lines the shop has not set up", () => {
    const msg = invoiceMessage(DEFAULT_SHOP, slip());
    expect(msg).not.toContain("Zelle");
    expect(msg).not.toContain("online");
  });
});

describe("pick lists", () => {
  it("splits a listed brand from the model and leaves unlisted brands alone", () => {
    expect(splitBike("Specialized Expedition")).toEqual({ brand: "Specialized", model: "Expedition" });
    expect(typedBikeModel("GTX Cycles Roamer 3", "GTX Cycles")).toBe("Roamer 3");
    expect(typedBikeModel("GTX Cycles", "GTX Cycles")).toBe("");
    expect(typedBikeModel("Roamer 3", "")).toBe("Roamer 3");
    expect(typedBikeModel("Roamer 3", "GTX")).toBe("Roamer 3");
    expect(splitBike("Rad Power Bikes RadWagon")).toEqual({ brand: "Rad Power Bikes", model: "RadWagon" });
    expect(splitBike("Livestrong")).toEqual({ brand: "", model: "Livestrong" });
    expect(joinBike("Trek", " 820")).toBe("Trek 820");
    expect(joinBike("Trek", "")).toBe("Trek ");
  });

  it("has a model list for every brand", () => {
    for (const brand of BIKE_BRANDS) expect(BIKE_MODELS[brand].length, brand).toBeGreaterThan(0);
  });

  it("lists checked services before typed notes in the text", () => {
    const inv = { ...slip(), services: ["Flat tire repair", "Wheel truing"], serviceNotes: ["Lubed chain"] };
    expect(invoiceMessage(DEFAULT_SHOP, inv)).toContain("Work: Flat tire repair; Wheel truing; Lubed chain");
  });
});

describe("owner income", () => {
  const paid = (total: number, taxRate: number, paidAt: string, date = paidAt.slice(0, 10)): Invoice => ({
    ...blankInvoice(),
    date,
    lineItems: [item("Service", 1, total)],
    taxRate,
    sentAt: paidAt,
    paidAt,
  });

  it("adds up paid invoices in the period, separates sales tax, and estimates income tax", () => {
    const invoices = [
      paid(100, 8.25, "2026-09-02T15:00:00"),
      paid(159, 0, "2026-09-10T15:00:00"),
      paid(500, 8.25, "2026-08-31T15:00:00"), // previous month
      { ...paid(80, 0, "2026-09-05T15:00:00"), paidAt: "" }, // sent, not paid
      { ...paid(60, 0, "2026-09-06T15:00:00"), paidAt: "", sentAt: "" }, // draft
    ];
    const s = summarizeIncome(invoices, "2026-09-01", "2026-09-30", 20);
    expect(s).toMatchObject({
      paidCount: 2,
      collected: 267.25,
      salesTax: 8.25,
      netSales: 259,
      incomeTax: 51.8,
      afterIncomeTax: 207.2,
      unpaidCount: 1,
      unpaid: 80,
    });
  });
});

describe("invoice storage", () => {
  it("saves, updates in place, and deletes", () => {
    const inv = blankInvoice();
    saveInvoice(inv);
    saveInvoice({ ...inv, customerName: "Ana" });
    expect(loadInvoices()).toHaveLength(1);
    expect(loadInvoices()[0].customerName).toBe("Ana");
    expect(deleteInvoice(inv.id)).toEqual([]);
  });

  it("returns an empty list for corrupt storage", () => {
    localStorage.setItem("bike-invoices", "{not json");
    expect(loadInvoices()).toEqual([]);
  });

  it("loads invoices saved by the previous version with the new fields filled in", () => {
    const legacy = {
      id: "old",
      invoiceNumber: "1001",
      date: "2026-09-13",
      shopName: "Bicycle Repair Shop",
      customerName: "Jordan",
      customerPhone: "",
      bikeDescriptions: ["Trek"],
      serviceNotes: [""],
      lineItems: [{ id: "a", description: "Tube", quantity: 2, unitPrice: 8 }],
      taxRate: 0,
    };
    localStorage.setItem("bike-invoices", JSON.stringify([legacy]));
    const [inv] = loadInvoices();
    expect(inv.charges.storage).toBe(0);
    expect(inv.lineItems[0]).toMatchObject({ id: "a", description: "Tube", condition: "new", warranty: false });
    expect(calculateTotals(inv).total).toBe(16);
    expect(inv.services).toEqual([]);
    expect(inv.bikeSerials).toEqual([""]);
  });

  it("moves the old single serial # onto the first bike", () => {
    const { bikeSerials: _, ...legacy } = { ...blankInvoice(), bikeDescriptions: ["Trek 820", "Huffy"], serialNumber: "WTU1" };
    localStorage.setItem("bike-invoices", JSON.stringify([legacy]));
    const [inv] = loadInvoices();
    expect(inv.bikeSerials).toEqual(["WTU1", ""]);
    expect(inv).not.toHaveProperty("serialNumber");
    expect(invoiceMessage(DEFAULT_SHOP, inv)).toContain("Bike: Trek 820 (S/N WTU1), Huffy");
  });

  it("turns the old lump accessories charge and accessory lines into ordinary line items", () => {
    const legacy = {
      ...blankInvoice(),
      lineItems: [{ ...item("Bell", 1, 6), kind: "accessory" }],
      charges: { accessories: 25, storage: 5 },
    };
    localStorage.setItem("bike-invoices", JSON.stringify([legacy]));
    const [inv] = loadInvoices();
    expect(inv.charges).not.toHaveProperty("accessories");
    expect(inv.lineItems[0]).not.toHaveProperty("kind");
    expect(inv.lineItems[1]).toMatchObject({ description: "Accessories", unitPrice: 25 });
    expect(calculateTotals(inv)).toMatchObject({ parts: 31, other: 5, total: 36 });
  });

  it("remembers the shop's payment settings", () => {
    expect(loadShop()).toEqual(DEFAULT_SHOP);
    saveShop({ ...DEFAULT_SHOP, zelle: "shop@example.com" });
    expect(loadShop().zelle).toBe("shop@example.com");
  });
});

describe("pick lists the shop adds to", () => {
  it("adds trimmed entries once, ignoring case and anything already built in", () => {
    let lists = addToList(emptyLists(), { list: "brands" }, "  Tern  ");
    lists = addToList(lists, { list: "brands" }, "tern");
    lists = addToList(lists, { list: "brands" }, "trek");
    lists = addToList(lists, { list: "models", brand: "Trek" }, "Marlin");
    lists = addToList(lists, { list: "models", brand: "Trek" }, "Marlin 7 Gen 3");
    lists = addToList(lists, { list: "items" }, "helmet");
    lists = addToList(lists, { list: "services" }, "");
    expect(lists).toEqual({ brands: ["Tern"], models: { Trek: ["Marlin 7 Gen 3"] }, services: [], items: [] });
    expect(allBrands(lists)).toContain("Tern");
    expect(allModels("Trek", lists)).toEqual(expect.arrayContaining(["Marlin", "Marlin 7 Gen 3"]));
  });

  it("saves, loads and removes entries, and survives corrupt storage", () => {
    const lists = addToList(addToList(emptyLists(), { list: "models", brand: "Tern" }, "GSD"), { list: "items" }, "Bar ends");
    saveLists(lists);
    expect(loadLists()).toEqual(lists);
    expect(removeFromList(lists, { list: "models", brand: "Tern" }, "GSD").models).toEqual({});
    expect(removeFromList(lists, { list: "items" }, "Bar ends").items).toEqual([]);
    localStorage.setItem("bike-custom-lists", "{oops");
    expect(loadLists()).toEqual(emptyLists());
  });

  it("recognises an added brand when splitting a bike description", () => {
    expect(splitBike("Tern GSD", allBrands(addToList(emptyLists(), { list: "brands" }, "Tern")))).toEqual({ brand: "Tern", model: "GSD" });
    expect(splitBike("Tern GSD")).toEqual({ brand: "", model: "Tern GSD" });
  });
});
