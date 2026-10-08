import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PluginListenerHandle } from "@capacitor/core";
import App from "../src/App";
import { FaceID, authenticateIncome, faceIDStatus } from "../src/faceID";
import { loadOwner, saveOwner } from "../src/invoice";

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: vi.fn(() => "ios"), isNativePlatform: () => true },
  registerPlugin: () => ({ availability: vi.fn(), authenticate: vi.fn(), cancel: vi.fn(async () => undefined),
    acknowledgeLock: vi.fn(async () => undefined), addListener: vi.fn() }),
}));
import { Capacitor } from "@capacitor/core";
let onLock: (event: { epoch: number }) => void;
let remove: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");
  vi.mocked(FaceID.availability).mockResolvedValue({ available: true, reason: "" });
  vi.mocked(FaceID.authenticate).mockResolvedValue({ authenticated: true });
  remove = vi.fn(async () => undefined);
  vi.mocked(FaceID.addListener).mockImplementation(async (_event, listener) => {
    onLock = listener;
    return { remove } as PluginListenerHandle;
  });
});
const openIncome = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("tab", { name: "Income" }));
};
const unlock = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Unlock with Face ID" }));
};

describe("Face ID access", () => {
  beforeEach(() => saveOwner({ incomeTaxRate: 0, faceIDEnabled: true }));
  it("fails closed in browsers and does not call the native plugin", async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue("web");
    expect((await faceIDStatus()).available).toBe(false);
    await expect(authenticateIncome()).rejects.toThrow(/installed iPhone/);
    expect(FaceID.authenticate).not.toHaveBeenCalled();
  });
  it("never accepts a false authentication result", async () => {
    vi.mocked(FaceID.authenticate).mockResolvedValue({ authenticated: false });
    await expect(authenticateIncome()).rejects.toThrow(/did not authenticate/);
  });
  it("keeps income and AI controls unmounted on failure, then allows a retry", async () => {
    vi.mocked(FaceID.authenticate).mockRejectedValueOnce(new Error("Face ID is locked."));
    const user = userEvent.setup(); render(<App />); await openIncome(user); await unlock(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Face ID is locked");
    expect(screen.queryByTestId("collected")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/PIN/)).not.toBeInTheDocument();
    await unlock(user); expect(await screen.findByTestId("collected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lock now" }));
    expect(screen.queryByTestId("collected")).not.toBeInTheDocument();
  });
  it("ignores successful authentication arriving after navigation", async () => {
    let resolve!: (result: { authenticated: boolean }) => void;
    vi.mocked(FaceID.authenticate).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const user = userEvent.setup(); render(<App />); await openIncome(user); await unlock(user);
    expect(screen.getByRole("button", { name: "Checking Face ID…" })).toBeDisabled();
    await user.click(screen.getByRole("tab", { name: "Settings" }));
    await act(async () => { resolve({ authenticated: true }); });
    expect(screen.queryByLabelText("Set aside for income tax (%)")).not.toBeInTheDocument();
    await openIncome(user); expect(screen.queryByTestId("collected")).not.toBeInTheDocument();
  });
  it("locks on native background events and acknowledges only the locked render", async () => {
    const user = userEvent.setup(); const view = render(<App />); await openIncome(user); await unlock(user);
    expect(await screen.findByTestId("collected")).toBeInTheDocument();
    act(() => onLock({ epoch: 1 }));
    expect(screen.queryByTestId("collected")).not.toBeInTheDocument();
    await waitFor(() => expect(FaceID.acknowledgeLock).toHaveBeenCalledWith({ epoch: 1 }));
    view.unmount(); expect(remove).toHaveBeenCalled();
  });
  it("ignores authentication completed after a background event", async () => {
    let resolve!: (result: { authenticated: boolean }) => void;
    vi.mocked(FaceID.authenticate).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const user = userEvent.setup(); render(<App />); await openIncome(user); await unlock(user);
    act(() => onLock({ epoch: 2 }));
    await act(async () => { resolve({ authenticated: true }); });
    expect(screen.queryByTestId("collected")).not.toBeInTheDocument();
  });
  it("keeps Settings available but protects the tax rate, and persists changes", async () => {
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.getByLabelText("Shop name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export invoice backup" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Set aside for income tax (%)")).not.toBeInTheDocument();
    await unlock(user); const rate = await screen.findByLabelText("Set aside for income tax (%)");
    await user.clear(rate); await user.type(rate, "30");
    expect(loadOwner().incomeTaxRate).toBe(30);
    await openIncome(user); expect(screen.queryByTestId("collected")).not.toBeInTheDocument();
    await unlock(user); expect(await screen.findByTestId("incomeTax")).toHaveTextContent("$0.00");
  });
});

describe("optional Face ID setting", () => {
  const openSettings = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("tab", { name: "Settings" }));
    return screen.getByRole("switch", { name: "Require Face ID for Income" });
  };
  it("defaults off and opens Income and tax settings without authentication", async () => {
    expect(loadOwner()).toEqual({ incomeTaxRate: 0, faceIDEnabled: false });
    const user = userEvent.setup(); render(<App />); await openIncome(user);
    expect(screen.getByTestId("collected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lock now" })).not.toBeInTheDocument();
    expect(await openSettings(user)).not.toBeChecked();
    expect(screen.getByLabelText("Set aside for income tax (%)")).toBeInTheDocument();
    expect(FaceID.authenticate).not.toHaveBeenCalled();
  });
  it("verifies before enabling, persists across remounts, and requires a fresh match to disable", async () => {
    const user = userEvent.setup(); const view = render(<App />);
    await user.click(await openSettings(user));
    await waitFor(() => expect(loadOwner().faceIDEnabled).toBe(true));
    expect(screen.queryByLabelText("Set aside for income tax (%)")).not.toBeInTheDocument();
    view.unmount(); render(<App />); await openIncome(user);
    expect(screen.queryByTestId("collected")).not.toBeInTheDocument();
    const toggle = await openSettings(user); expect(toggle).toBeChecked();
    vi.mocked(FaceID.authenticate).mockRejectedValueOnce(new Error("Face ID was cancelled."));
    await user.click(toggle);
    expect(await screen.findByRole("alert")).toHaveTextContent("cancelled");
    expect(loadOwner().faceIDEnabled).toBe(true);
    await user.click(toggle);
    await waitFor(() => expect(loadOwner().faceIDEnabled).toBe(false));
    await openIncome(user); expect(screen.getByTestId("collected")).toBeInTheDocument();
    expect(FaceID.authenticate).toHaveBeenCalledTimes(3);
  });
  it("keeps protection off when opting in is cancelled", async () => {
    vi.mocked(FaceID.authenticate).mockRejectedValueOnce(new Error("Face ID was cancelled."));
    const user = userEvent.setup(); render(<App />); await user.click(await openSettings(user));
    expect(await screen.findByRole("alert")).toHaveTextContent("cancelled");
    expect(loadOwner().faceIDEnabled).toBe(false);
    expect(screen.getByLabelText("Set aside for income tax (%)")).toBeInTheDocument();
  });
  it.each(["navigation", "background"])("ignores a late opt-in after %s", async reason => {
    let resolve!: (result: { authenticated: boolean }) => void;
    vi.mocked(FaceID.authenticate).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const user = userEvent.setup(); render(<App />); const toggle = await openSettings(user);
    await user.click(toggle); expect(toggle).toBeDisabled();
    expect(screen.getByLabelText("Set aside for income tax (%)")).toBeDisabled();
    if (reason === "navigation") await openIncome(user);
    else act(() => onLock({ epoch: 3 }));
    await act(async () => { resolve({ authenticated: true }); });
    expect(loadOwner().faceIDEnabled).toBe(false);
    if (reason === "navigation") expect(screen.getByTestId("collected")).toBeInTheDocument();
  });
  it("does not change the preference if saving fails", async () => {
    const user = userEvent.setup(); render(<App />); const toggle = await openSettings(user);
    const setItem = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (key === "bike-owner") throw new Error("Storage full");
      setItem(key, value);
    });
    try {
      await user.click(toggle);
      expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
      expect(toggle).not.toBeChecked(); expect(loadOwner().faceIDEnabled).toBe(false);
    } finally { spy.mockRestore(); }
  });
  it("keeps the switch off in browsers with no native authentication", async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue("web");
    const user = userEvent.setup(); render(<App />); const toggle = await openSettings(user);
    await user.click(toggle);
    expect(await screen.findByRole("alert")).toHaveTextContent("installed iPhone");
    expect(toggle).not.toBeChecked(); expect(FaceID.authenticate).not.toHaveBeenCalled();
  });
});

describe("owner settings migration", () => {
  it("removes the old plaintext PIN and preserves the tax rate", () => {
    localStorage.setItem("bike-owner", JSON.stringify({ pin: "4321", incomeTaxRate: 25 }));
    localStorage.setItem("bike-invoices", "[]");
    expect(loadOwner()).toEqual({ incomeTaxRate: 25, faceIDEnabled: false });
    expect(JSON.parse(localStorage.getItem("bike-owner")!)).toEqual({ incomeTaxRate: 25, faceIDEnabled: false });
    expect(localStorage.getItem("bike-invoices")).toBe("[]");
    saveOwner({ incomeTaxRate: 30, faceIDEnabled: false });
    expect(localStorage.getItem("bike-owner")).not.toContain("pin");
  });
  it.each([null, [], { incomeTaxRate: "25" }, { incomeTaxRate: -10 }, { incomeTaxRate: 200 }])("normalizes owner settings %j", value => {
    localStorage.setItem("bike-owner", JSON.stringify(value));
    const rate = loadOwner().incomeTaxRate;
    expect(Number.isFinite(rate)).toBe(true); expect(rate).toBeGreaterThanOrEqual(0); expect(rate).toBeLessThanOrEqual(100);
  });
});
