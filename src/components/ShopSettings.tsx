import type { ShopInfo } from "../types";
import { removeFromList } from "../customLists";
import type { CustomLists, Target } from "../customLists";

interface Props {
  shop: ShopInfo;
  onChange: (shop: ShopInfo) => void;
  lists: CustomLists;
  onLists: (lists: CustomLists) => void;
}

const FIELDS: { key: keyof ShopInfo; label: string; placeholder?: string; type?: string }[] = [
  { key: "name", label: "Shop name" },
  { key: "address", label: "Shop address" },
  { key: "cityStateZip", label: "Shop city, state, ZIP" },
  { key: "phone", label: "Shop phone", type: "tel" },
  { key: "zelle", label: "Zelle phone or email", placeholder: "e.g. (408) 569-4378" },
  {
    key: "paymentLink",
    label: "Payment link",
    placeholder: "e.g. https://paypal.me/yourshop/{amount}",
    type: "url",
  },
];

export default function ShopSettings({ shop, onChange, lists, onLists }: Props) {
  const added: [string, Target, string][] = [
    ...lists.brands.map((v): [string, Target, string] => ["Brand", { list: "brands" }, v]),
    ...Object.entries(lists.models).flatMap(([brand, models]) =>
      models.map((v): [string, Target, string] => [`${brand} model`, { list: "models", brand }, v]),
    ),
    ...lists.services.map((v): [string, Target, string] => ["Service", { list: "services" }, v]),
    ...lists.items.map((v): [string, Target, string] => ["Part / accessory", { list: "items" }, v]),
  ];
  return (
    <form className="card" onSubmit={(e) => e.preventDefault()}>
      <fieldset>
        <legend>Shop &amp; payments</legend>
        {FIELDS.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              type={f.type ?? "text"}
              placeholder={f.placeholder}
              value={shop[f.key]}
              onChange={(e) => onChange({ ...shop, [f.key]: e.target.value })}
            />
          </label>
        ))}
        <p className="hint">
          Every invoice text includes the Zelle contact and the payment link. In the link, <code>{"{amount}"}</code>{" "}
          becomes the invoice total and <code>{"{invoice}"}</code> the invoice number. Zelle has no payment link of
          its own, so customers send the total to the contact above.
        </p>
      </fieldset>
      <fieldset>
        <legend>Added to pick lists</legend>
        {added.length === 0 ? (
          <p className="hint">Nothing yet. Type an entry under "Other" on the Edit tab and tap "+ Add to list" to keep it.</p>
        ) : (
          <ul className="added">
            {added.map(([kind, target, value]) => (
              <li key={`${kind}-${value}`}>
                <span>
                  <span className="muted">{kind}:</span> {value}
                </span>
                <button
                  type="button"
                  className="icon"
                  aria-label={`Remove ${value} from list`}
                  onClick={() => onLists(removeFromList(lists, target, value))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </form>
  );
}
