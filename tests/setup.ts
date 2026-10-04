import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Node 25+ ships its own global `localStorage`, which is undefined unless Node is started with
// --localstorage-file, and it shadows jsdom's. Fall back to an in-memory Storage when that happens.
if (typeof globalThis.localStorage?.setItem !== "function") {
  const data = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
  Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom has no LockManager. Serialize all test mutations like the production Web Lock.
let tail: Promise<unknown> = Promise.resolve();
Object.defineProperty(navigator, "locks", { configurable: true, value: {
  request: (_name: string, callback: () => unknown) => {
    const result = tail.then(callback);
    tail = result.catch(() => undefined);
    return result;
  },
}});
beforeEach(() => { vi.spyOn(window, "confirm").mockReturnValue(true); });
