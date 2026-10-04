import { Capacitor } from "@capacitor/core";
import { Contacts, PhoneType } from "@capacitor-community/contacts";

export interface PickedContact {
  name: string;
  phone: string;
  address: string;
  cityStateZip: string;
}

/** The Contact Picker API some Android browsers expose; iOS uses the native plugin instead. */
type WebContacts = {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<
    { name?: string[]; tel?: string[]; address?: { addressLine?: string[]; city?: string; region?: string; postalCode?: string }[] }[]
  >;
};
const webContacts = () => (globalThis.navigator as Navigator & { contacts?: WebContacts } | undefined)?.contacts;

export const canPickContact = () => Capacitor.isNativePlatform() || typeof webContacts()?.select === "function";

const cityLine = (city?: string | null, region?: string | null, zip?: string | null) =>
  [[city, region].filter(Boolean).join(", "), zip].filter(Boolean).join(" ");

/**
 * Opens the phone's contact picker. Rejects if contacts access was denied. On iOS a cancelled picker never
 * settles, so callers must not lock the UI while waiting.
 */
export async function pickContact(): Promise<PickedContact | null> {
  if (Capacitor.isNativePlatform()) {
    const { contact } = await Contacts.pickContact({
      projection: { name: true, phones: true, postalAddresses: true },
    });
    if (!contact) return null;
    const phones = contact.phones ?? [];
    const phone = phones.find((p) => (p.type === PhoneType.Mobile || String(p.type).toLowerCase() === "iphone")) ?? phones.find((p) => p.isPrimary) ?? phones[0];
    const addr = contact.postalAddresses?.[0];
    const name =
      contact.name?.display || [contact.name?.given, contact.name?.family].filter(Boolean).join(" ");
    return {
      name: name ?? "",
      phone: phone?.number ?? "",
      address: addr?.street ?? "",
      cityStateZip: cityLine(addr?.city, addr?.region, addr?.postcode),
    };
  }
  const [c] = (await webContacts()?.select(["name", "tel", "address"]).catch(() => [])) ?? [];
  if (!c) return null;
  const addr = c.address?.[0];
  return {
    name: c.name?.[0] ?? "",
    phone: c.tel?.[0] ?? "",
    address: addr?.addressLine?.join(", ") ?? "",
    cityStateZip: cityLine(addr?.city, addr?.region, addr?.postalCode),
  };
}
