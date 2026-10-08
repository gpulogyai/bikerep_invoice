import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export interface FaceIDStatus { available: boolean; reason: string }
interface FaceIDPlugin {
  availability(): Promise<FaceIDStatus>;
  authenticate(): Promise<{ authenticated: boolean }>;
  cancel(): Promise<void>;
  acknowledgeLock(options: { epoch: number }): Promise<void>;
  addListener(event: "locked", listener: (event: { epoch: number }) => void): Promise<PluginListenerHandle>;
}
export const FaceID = registerPlugin<FaceIDPlugin>("FaceID");
export const supportsNativeFaceID = () => Capacitor.getPlatform() === "ios";
export async function faceIDStatus(): Promise<FaceIDStatus> {
  if (!supportsNativeFaceID()) return { available: false, reason: "Face ID requires the installed iPhone app. Income stays locked here." };
  return FaceID.availability();
}
export async function authenticateIncome(): Promise<void> {
  if (!supportsNativeFaceID()) throw new Error("Face ID requires the installed iPhone app. Income stays locked here.");
  const result = await FaceID.authenticate();
  if (result.authenticated !== true) throw new Error("Face ID did not authenticate. Income stays locked.");
}
