import { useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { CHARGE_KEYS } from "../types";
import type { Invoice, LineItem, PartCondition } from "../types";
import { CHARGE_LABELS, emptyLineItem } from "../invoice";
import { COMMON_ACCESSORIES, COMMON_PARTS, joinBike, splitBike, typedBikeModel } from "../catalog";
import { canPickContact, pickContact } from "../contacts";
import { addToList, allBrands, allModels, allServices, includesName, isListed } from "../customLists";
import type { CustomLists, Target } from "../customLists";

interface Props {
  invoice: Invoice;
  setInvoice: Dispatch<SetStateAction<Invoice>>;
  lists: CustomLists;
  onLists: (lists: CustomLists) => void;
}

type ListKey = "serviceNotes";
type TextKey = {
  [K in keyof Invoice]: Invoice[K] extends string ? K : never;
}[keyof Invoice];

const OTHER = "__other";
const LIST_NAMES = { brands: "brands", models: "models", services: "services", items: "parts & accessories" } as const;

/** Shown beside a typed-in entry that isn't in its pick list yet; saves it there for every later invoice. */
function AddToList({ value, target, lists, onAdd }: { value: string; target: Target; lists: CustomLists; onAdd: (v: string) => void }) {
  const v = value.trim();
  if (!v || isListed(lists, target, v)) return null;
  return (
    <button
      type="button"
      className="secondary small addlist"
      aria-label={`Add ${v} to ${LIST_NAMES[target.list]} list`}
      onClick={() => onAdd(v)}
    >
      + Add to list
    </button>
  );
}

/** Brand, then a model list for that brand only, then the bike's serial #. */
function BikeFields({
  index,
  description,
  serial,
  typedBrand,
  lists,
  onAdd,
  onBike,
  onDescription,
  onSerial,
  onRemove,
}: {
  index: number;
  description: string;
  serial: string;
  typedBrand: string;
  lists: CustomLists;
  onAdd: (target: Target, value: string) => void;
  onBike: (description: string, typedBrand: string) => void;
  onDescription: (v: string) => void;
  onSerial: (v: string) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const brands = allBrands(lists);
  const split = splitBike(description, brands);
  // Typing is for models not on the list, and for bikes whose brand isn't listed either.
  const [typing, setTyping] = useState(split.model.trim() !== "" && !includesName(allModels(split.brand, lists), split.model));
  const [brandTyping, setBrandTyping] = useState(!split.brand && description.trim() !== "");
  // While a new brand is being typed, don't snap to a listed brand it starts with (e.g. "GT" in "GTX").
  const { brand, model } = brandTyping ? { brand: "", model: description } : split;
  const models = allModels(brand, lists);
  const listed = includesName(models, model);
  // The typed brand is saved on the invoice, so it survives switching tabs; the box keeps spaces while typing.
  const [newBrand, setNewBrand] = useState(typedBrand);
  const typedModel = brand ? model : typedBikeModel(description, typedBrand);
  const setTyped = (b: string, m: string) => onBike([b.trim(), m].filter((s) => s.trim()).join(" "), b.trim());
  const setTypedBrand = (b: string) => {
    setNewBrand(b);
    setTyped(b, typedModel);
  };

  return (
    <div className="bike">
      <div className="bikehead">
        <span>Bike {n}</span>
        <button type="button" className="icon" aria-label={`Remove bike ${n}`} onClick={onRemove}>
          ✕
        </button>
      </div>
      <div className="grid2">
        <select
          aria-label={`Bike ${n} brand`}
          value={brand || (brandTyping ? OTHER : "")}
          onChange={(e) => {
            const other = e.target.value === OTHER;
            setBrandTyping(other);
            setNewBrand("");
            setTyping(!other && !brand && typedModel.trim() !== "");
            if (other) onBike(typedModel.trim(), "");
            else onBike(joinBike(e.target.value, brand ? "" : typedModel), "");
          }}
        >
          <option value="">Brand…</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
          <option value={OTHER}>Other (type it in)</option>
        </select>
        <select
          aria-label={`Bike ${n} model`}
          disabled={!brand}
          value={typing ? OTHER : listed ? (models.find((m) => includesName([m], model)) ?? "") : ""}
          onChange={(e) => {
            const other = e.target.value === OTHER;
            setTyping(other);
            onDescription(joinBike(brand, other ? "" : e.target.value));
          }}
        >
          <option value="">{brand ? "Model…" : "Pick brand first"}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value={OTHER}>Other (type it in)</option>
        </select>
      </div>
      {brandTyping && (
        <div className="row">
          <input
            aria-label={`Bike ${n} new brand`}
            placeholder="Brand name"
            value={newBrand}
            onChange={(e) => setTypedBrand(e.target.value)}
          />
          <AddToList
            value={newBrand}
            target={{ list: "brands" }}
            lists={lists}
            onAdd={(v) => {
              onAdd({ list: "brands" }, v);
              setBrandTyping(false);
              setTyping(typedModel.trim() !== "");
              onBike(joinBike(v, typedModel), "");
            }}
          />
        </div>
      )}
      {(brandTyping || (brand && typing)) && (
        <div className="row">
          <input
            aria-label={`Bike ${n}`}
            placeholder={brand ? `${brand} model` : "Model"}
            value={typedModel}
            onChange={(e) =>
              onDescription(
                brand ? joinBike(brand, e.target.value) : [typedBrand, e.target.value].filter((s) => s.trim()).join(" "),
              )
            }
          />
          {brand && (
            <AddToList
              value={model}
              target={{ list: "models", brand }}
              lists={lists}
              onAdd={(v) => {
                onAdd({ list: "models", brand }, v);
                setTyping(false);
                onDescription(joinBike(brand, v));
              }}
            />
          )}
        </div>
      )}
      <label>
        Serial #
        <input aria-label={`Bike ${n} serial #`} value={serial} onChange={(e) => onSerial(e.target.value)} />
      </label>
    </div>
  );
}

const CONDITIONS: { value: PartCondition; label: string }[] = [
  { value: "new", label: "New" },
  { value: "used", label: "U - Used" },
  { value: "rebuilt", label: "R - Rebuilt" },
  { value: "reconditioned", label: "RC - Reconditioned" },
];

export default function InvoiceForm({ invoice, setInvoice, lists, onLists }: Props) {
  const addTo = (target: Target, value: string) => onLists(addToList(lists, target, value));
  const update = (patch: Partial<Invoice>) => setInvoice((d) => ({ ...d, ...patch }));
  const [contactError, setContactError] = useState("");

  const fromContacts = async (who: "customer" | "alt") => {
    setContactError("");
    try {
      const c = await pickContact();
      if (!c) return;
      if (who === "alt") {
        update({ altName: c.name, altPhone: c.phone });
      } else {
        setInvoice((d) => ({
          ...d,
          customerName: c.name,
          customerPhone: c.phone,
          customerAddress: c.address || d.customerAddress,
          customerCityStateZip: c.cityStateZip || d.customerCityStateZip,
        }));
      }
    } catch (e) {
      setContactError(
        `${e instanceof Error ? e.message : "Could not open contacts."} Allow contacts for Bike Invoices in Settings.`,
      );
    }
  };
  const contactButton = (who: "customer" | "alt", ariaLabel: string) =>
    canPickContact() && (
      <button type="button" className="secondary small" aria-label={ariaLabel} onClick={() => void fromContacts(who)}>
        Choose from contacts
      </button>
    );

  const toggleService = (service: string, on: boolean) =>
    setInvoice((d) => ({
      ...d,
      services: on ? [...d.services.filter((s) => s !== service), service] : d.services.filter((s) => s !== service),
    }));

  const setBike = (index: number, patch: { description?: string; serial?: string; brand?: string }) =>
    setInvoice((d) => {
      const pick = <T,>(key: keyof typeof patch, list: T[], fallback: T) =>
        d.bikeDescriptions.map((_, i) => (i === index && patch[key] !== undefined ? (patch[key] as T) : (list[i] ?? fallback)));
      return {
        ...d,
        bikeDescriptions: pick("description", d.bikeDescriptions, ""),
        bikeSerials: pick("serial", d.bikeSerials, ""),
        bikeBrands: pick("brand", d.bikeBrands, ""),
      };
    });
  const addBike = () =>
    setInvoice((d) => ({
      ...d,
      bikeDescriptions: [...d.bikeDescriptions, ""],
      bikeSerials: [...d.bikeSerials, ""],
      bikeBrands: [...d.bikeDescriptions.map((_, i) => d.bikeBrands[i] ?? ""), ""],
    }));
  const removeBike = (index: number) =>
    setInvoice((d) => {
      const keep = (_: string, i: number) => i !== index;
      const bikeDescriptions = d.bikeDescriptions.filter(keep);
      return bikeDescriptions.length
        ? {
            ...d,
            bikeDescriptions,
            bikeSerials: d.bikeSerials.filter(keep),
            bikeBrands: d.bikeDescriptions.map((_, i) => d.bikeBrands[i] ?? "").filter(keep),
          }
        : { ...d, bikeDescriptions: [""], bikeSerials: [""], bikeBrands: [""] };
    });

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
  /** A picked item fills the first untouched blank row, otherwise gets a new row. */
  const addLine = (description = "") =>
    setInvoice((d) => {
      const blank = description ? d.lineItems.find((li) => !li.description.trim() && !li.partNo && !li.unitPrice) : undefined;
      return blank
        ? { ...d, lineItems: d.lineItems.map((li) => (li === blank ? { ...li, description } : li)) }
        : { ...d, lineItems: [...d.lineItems, emptyLineItem(description)] };
    });
  const removeLine = (id: string) =>
    setInvoice((d) => {
      const next = d.lineItems.filter((li) => li.id !== id);
      // Keep one blank row to type into.
      return { ...d, lineItems: next.length ? next : [emptyLineItem()] };
    });
  /** Moves a typed-in service note into the checklist for good, checked on this invoice. */
  const noteToList = (index: number, service: string) => {
    addTo({ list: "services" }, service);
    setInvoice((d) => {
      const serviceNotes = d.serviceNotes.filter((_, i) => i !== index);
      const listedAs = allServices(lists).find((s) => includesName([s], service)) ?? service;
      return {
        ...d,
        services: includesName(d.services, listedAs) ? d.services : [...d.services, listedAs],
        serviceNotes: serviceNotes.length ? serviceNotes : [""],
      };
    });
  };

  const text = (key: TextKey, label: string, type = "text", extra: { inputMode?: "tel" } = {}) => (
    <label>
      {label}
      <input type={type} {...extra} value={invoice[key]} onChange={(e) => update({ [key]: e.target.value })} />
    </label>
  );
  const money = (label: string, value: number, onChange: (n: number) => void) => (
    <label>
      {label}
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
  const radios = <K extends "laborBasis" | "estimateChoice" | "partsDisposition">(
    key: K,
    title: string,
    options: [Invoice[K], string][],
  ): ReactNode => (
    <div role="radiogroup" aria-label={title} className="choices">
      <span>{title}</span>
      {options.map(([value, label]) => (
        <label key={value} className="choice">
          <input
            type="radio"
            name={key}
            checked={invoice[key] === value}
            onChange={() => update({ [key]: value } as Partial<Invoice>)}
          />
          {label}
        </label>
      ))}
    </div>
  );

  const listSection = (
    key: ListKey,
    title: string,
    singular: string,
    placeholder: string,
    after?: ReactNode,
    before?: ReactNode,
    rowExtra?: (value: string, index: number) => ReactNode,
  ) => (
    <fieldset>
      <legend>{title}</legend>
      {before}
      {invoice[key].map((value, i) => (
        <div className="row" key={`${key}-${i}`}>
          <input
            aria-label={`${singular} ${i + 1}`}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setListItem(key, i, e.target.value)}
          />
          {rowExtra?.(value, i)}
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
      {after}
    </fieldset>
  );

  return (
    <form className="card" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>Invoice</legend>
        <div className="grid2">
          {text("invoiceNumber", "Invoice #")}
          {text("date", "Date", "date")}
          {text("customerOrderNo", "Customer's order no.")}
          {text("writtenBy", "Written by")}
        </div>
      </fieldset>

      <fieldset>
        <legend>Customer</legend>
        <div className="row">{contactButton("customer", "Choose from contacts")}</div>
        {contactError && <p className="warn">{contactError}</p>}
        {text("customerName", "Name")}
        {text("customerPhone", "Phone", "tel", { inputMode: "tel" })}
        {text("customerAddress", "Address")}
        {text("customerCityStateZip", "City, state, ZIP")}
      </fieldset>

      <fieldset>
        <legend>2nd authorized contact</legend>
        <div className="row">{contactButton("alt", "Choose 2nd contact from contacts")}</div>
        <div className="grid2">
          {text("altName", "2nd authorized name")}
          {text("altPhone", "2nd authorized phone", "tel", { inputMode: "tel" })}
        </div>
      </fieldset>

      <fieldset>
        <legend>Bikes</legend>
        {invoice.bikeDescriptions.map((description, i) => (
          <BikeFields
            // Re-mount after a removal so each row's typing state matches its bike.
            key={`${i}-${invoice.bikeDescriptions.length}`}
            index={i}
            description={description}
            serial={invoice.bikeSerials[i] ?? ""}
            typedBrand={invoice.bikeBrands[i] ?? ""}
            onBike={(description, brand) => setBike(i, { description, brand })}
            onDescription={(v) => setBike(i, { description: v })}
            onSerial={(v) => setBike(i, { serial: v })}
            lists={lists}
            onAdd={addTo}
            onRemove={() => removeBike(i)}
          />
        ))}
        <button type="button" className="secondary" onClick={addBike}>
          + Add bike
        </button>
        <div className="after">
          {text("receivedAt", "Received", "datetime-local")}
          {text("promisedAt", "Promised", "datetime-local")}
        </div>
      </fieldset>
      {listSection(
        "serviceNotes",
        "Service performed",
        "Note",
        "Other service, type it in",
        undefined,
        <div className="checks" role="group" aria-label="Common services">
          {allServices(lists).map((service) => (
            <label key={service} className="choice">
              <input
                type="checkbox"
                checked={invoice.services.includes(service)}
                onChange={(e) => toggleService(service, e.target.checked)}
              />
              {service}
            </label>
          ))}
        </div>,
        (value, i) => (
          <AddToList value={value} target={{ list: "services" }} lists={lists} onAdd={(v) => noteToList(i, v)} />
        ),
      )}

      <fieldset>
        <legend>Parts &amp; accessories</legend>
        {invoice.lineItems.map((li, i) => (
          <div className="part" key={li.id}>
            <div className="row">
              <input
                aria-label={`Item ${i + 1} description`}
                placeholder="Part or accessory"
                value={li.description}
                onChange={(e) => setLine(li.id, { description: e.target.value })}
              />
              <AddToList value={li.description} target={{ list: "items" }} lists={lists} onAdd={(v) => addTo({ list: "items" }, v)} />
              <button
                type="button"
                className="icon"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => removeLine(li.id)}
              >
                ✕
              </button>
            </div>
            <div className="partgrid">
              <input
                aria-label={`Item ${i + 1} part number`}
                placeholder="Part no."
                value={li.partNo}
                onChange={(e) => setLine(li.id, { partNo: e.target.value })}
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
              <select
                aria-label={`Item ${i + 1} condition`}
                value={li.condition}
                onChange={(e) => setLine(li.id, { condition: e.target.value as PartCondition })}
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label className="choice">
                <input
                  type="checkbox"
                  aria-label={`Item ${i + 1} warranty`}
                  checked={li.warranty}
                  onChange={(e) => setLine(li.id, { warranty: e.target.checked })}
                />
                Warranty
              </label>
            </div>
          </div>
        ))}
        <select
          aria-label="Add part or accessory"
          value=""
          onChange={(e) => {
            if (e.target.value) addLine(e.target.value === OTHER ? "" : e.target.value);
          }}
        >
          <option value="">+ Add part or accessory…</option>
          <optgroup label="Parts">
            {COMMON_PARTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </optgroup>
          <optgroup label="Accessories">
            {COMMON_ACCESSORIES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </optgroup>
          {lists.items.length > 0 && (
            <optgroup label="Added by you">
              {lists.items.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </optgroup>
          )}
          <option value={OTHER}>Other (type it in)</option>
        </select>
      </fieldset>

      <fieldset>
        <legend>Labor &amp; charges</legend>
        {money("Labor", invoice.labor, (labor) => update({ labor }))}
        {radios("laborBasis", "Basis", [
          ["flat", "Flat rate"],
          ["hourly", "Hourly"],
          ["both", "Both"],
        ])}
        <div className="grid2">
          {CHARGE_KEYS.map((k) => (
            <div key={k}>
              {money(CHARGE_LABELS[k], invoice.charges[k], (n) =>
                setInvoice((d) => ({ ...d, charges: { ...d.charges, [k]: n } })),
              )}
            </div>
          ))}
        </div>
        {money("Tax rate (%)", invoice.taxRate, (taxRate) => update({ taxRate }))}
      </fieldset>

      <fieldset>
        <legend>Estimate &amp; authorization</legend>
        {radios("estimateChoice", "Estimate", [
          ["written", "Customer requests a written estimate"],
          ["limit", "No written estimate, as long as cost doesn't exceed"],
          ["none", "No written estimate"],
        ])}
        {invoice.estimateChoice !== "none" &&
          invoice.estimateChoice !== "" &&
          money("Estimated cost / limit", invoice.estimateAmount, (estimateAmount) => update({ estimateAmount }))}
        {radios("partsDisposition", "Replaced parts", [
          ["retain", "Retain parts"],
          ["destroy", "Destroy parts"],
        ])}
        <div className="grid2">
          {text("guaranteeUntil", "Guarantee until", "date")}
          {text("authorizedBy", "Authorized by")}
        </div>
      </fieldset>
    </form>
  );
}
