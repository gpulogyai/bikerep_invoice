import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { shareReport } from "../src/shareReport";

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: vi.fn() } }));
vi.mock("@capacitor/filesystem", () => ({ Directory: { Cache: "CACHE" }, Filesystem: { writeFile: vi.fn(), deleteFile: vi.fn() } }));
vi.mock("@capacitor/share", () => ({ Share: { share: vi.fn() } }));
const blob = () => new Blob(["test report"], { type: "text/csv" });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: "file:///cache/report.csv" });
  vi.mocked(Filesystem.deleteFile).mockResolvedValue();
  vi.mocked(Share.share).mockResolvedValue({ activityType: "" });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("report sharing", () => {
  it("writes base64 into native cache, shares the URI, and cleans up only after sharing finishes", async () => {
    let complete!: (value: { activityType: string }) => void;
    vi.mocked(Share.share).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const result = shareReport(blob(), "report.csv");
    await vi.waitFor(() => expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({ files: ["file:///cache/report.csv"] })));
    const write = vi.mocked(Filesystem.writeFile).mock.calls[0][0];
    expect(write).toMatchObject({ directory: Directory.Cache, data: btoa("test report"), recursive: true });
    expect(write.path).toMatch(/^tax-reports\/[^/]+\/report.csv$/);
    expect(Filesystem.deleteFile).not.toHaveBeenCalled();
    complete({ activityType: "mail" });
    expect(await result).toBe("shared");
    expect(Filesystem.deleteFile).toHaveBeenCalledWith({ directory: Directory.Cache, path: write.path });
  });

  it("treats native cancellation as cancellation and removes the temporary report", async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error("Share canceled"));
    expect(await shareReport(blob(), "report.csv")).toBe("cancelled");
    expect(Filesystem.deleteFile).toHaveBeenCalledOnce();
  });

  it("surfaces native errors and still cleans up the financial file", async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error("Share unavailable"));
    await expect(shareReport(blob(), "report.csv")).rejects.toThrow("Share unavailable");
    expect(Filesystem.deleteFile).toHaveBeenCalledOnce();
  });

  it("does not open sharing when writing fails", async () => {
    vi.mocked(Filesystem.writeFile).mockRejectedValue(new Error("Disk full"));
    await expect(shareReport(blob(), "report.csv")).rejects.toThrow("Disk full");
    expect(Share.share).not.toHaveBeenCalled();
  });

  it("uses web file sharing when supported", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { canShare: vi.fn().mockReturnValue(true), share });
    expect(await shareReport(blob(), "report.csv")).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "Tax-year sales report", files: [expect.objectContaining({ name: "report.csv", type: "text/csv" })] });
    expect(Filesystem.writeFile).not.toHaveBeenCalled();
  });

  it("handles web share cancellation without starting a download", async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.stubGlobal("navigator", { canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException("dismissed", "AbortError")) });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    expect(await shareReport(blob(), "report.csv")).toBe("cancelled");
    expect(click).not.toHaveBeenCalled();
  });

  it("downloads when file sharing is unavailable and revokes the URL afterwards", async () => {
    vi.useFakeTimers();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.stubGlobal("navigator", {});
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: vi.fn().mockReturnValue("blob:report"), revokeObjectURL });
    let download = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { download = this.download; });
    expect(await shareReport(blob(), "report.csv")).toBe("downloaded");
    expect(download).toBe("report.csv");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
  });
});
