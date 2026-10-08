import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type ShareResult = "shared" | "downloaded" | "cancelled";
function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not prepare report."));
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(blob);
  });
}
export async function shareReport(blob: Blob, filename: string): Promise<ShareResult> {
  try {
    if (Capacitor.isNativePlatform()) {
      const path = `tax-reports/${crypto.randomUUID()}/${filename}`;
      const { uri } = await Filesystem.writeFile({ path, directory: Directory.Cache, data: await base64(blob), recursive: true });
      try {
        await Share.share({ title: "Tax-year sales report", files: [uri], dialogTitle: "Export & share" });
        return "shared";
      } finally {
        // The native share operation has finished; do not retain financial exports in cache.
        await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
      }
    }
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({ files: [file], title: "Tax-year sales report" });
      return "shared";
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return "downloaded";
  } catch (error) {
    // DOMException need not inherit from this realm's Error (notably Web Share).
    const failure = error as { name?: string; message?: string } | null;
    if (failure?.name === "AbortError" || /cancel/i.test(String(failure?.message ?? error))) return "cancelled";
    throw error;
  }
}
