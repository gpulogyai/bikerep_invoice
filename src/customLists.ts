import { BIKE_BRANDS, COMMON_ACCESSORIES, COMMON_PARTS, COMMON_SERVICES, modelsFor } from "./catalog";

/** Entries the shop typed in under "Other" and chose to keep in the pick lists. */
export interface CustomLists {
  brands: string[];
  /** Keyed by brand, listed or added. */
  models: Record<string, string[]>;
  services: string[];
  /** Parts and accessories share one list. */
  items: string[];
}

export type Target = { list: "brands" | "services" | "items" } | { list: "models"; brand: string };

const LISTS_KEY = "bike-custom-lists";

export const emptyLists = (): CustomLists => ({ brands: [], models: {}, services: [], items: [] });

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const includesName = (list: readonly string[], value: string) => list.some((s) => same(s, value));
const byName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });

export function loadLists(storage: Storage = localStorage): CustomLists {
  try {
    const raw = JSON.parse(storage.getItem(LISTS_KEY) ?? "{}");
    const models: Record<string, string[]> = {};
    for (const [brand, list] of Object.entries(raw.models ?? {})) models[brand] = strings(list);
    return { brands: strings(raw.brands), models, services: strings(raw.services), items: strings(raw.items) };
  } catch {
    return emptyLists();
  }
}

export function saveLists(lists: CustomLists, storage: Storage = localStorage): void {
  storage.setItem(LISTS_KEY, JSON.stringify(lists));
}

export const allBrands = (lists: CustomLists): string[] => [...BIKE_BRANDS, ...lists.brands].sort(byName);

export const allModels = (brand: string, lists: CustomLists): string[] =>
  [...modelsFor(brand), ...(lists.models[brand] ?? [])].sort(byName);

export const allServices = (lists: CustomLists): string[] => [...COMMON_SERVICES, ...lists.services];

export const allItems = (lists: CustomLists): string[] => [...COMMON_PARTS, ...COMMON_ACCESSORIES, ...lists.items];

/** The built-in and added entries for a list, to check whether a typed value is already there. */
function current(lists: CustomLists, target: Target): string[] {
  switch (target.list) {
    case "brands":
      return allBrands(lists);
    case "models":
      return allModels(target.brand, lists);
    case "services":
      return allServices(lists);
    case "items":
      return allItems(lists);
  }
}

export const isListed = (lists: CustomLists, target: Target, value: string) => includesName(current(lists, target), value);

/** Adds a trimmed value unless it is blank or already listed (ignoring case). */
export function addToList(lists: CustomLists, target: Target, value: string): CustomLists {
  const v = value.trim().replace(/\s+/g, " ");
  if (!v || isListed(lists, target, v)) return lists;
  if (target.list === "models") {
    return { ...lists, models: { ...lists.models, [target.brand]: [...(lists.models[target.brand] ?? []), v] } };
  }
  return { ...lists, [target.list]: [...lists[target.list], v] };
}

export function removeFromList(lists: CustomLists, target: Target, value: string): CustomLists {
  if (target.list === "models") {
    const left = (lists.models[target.brand] ?? []).filter((s) => s !== value);
    const { [target.brand]: _, ...models } = lists.models;
    return { ...lists, models: left.length ? { ...models, [target.brand]: left } : models };
  }
  return { ...lists, [target.list]: lists[target.list].filter((s) => s !== value) };
}
