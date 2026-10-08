import { useCallback, useEffect, useRef, useState } from "react";
import { authenticateIncome, FaceID, supportsNativeFaceID } from "./faceID";

/** Grants only the current mounted page access; stale replies can never unlock it. */
export function useIncomeAccess() {
  const [unlocked, setUnlocked] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState("");
  const [lockEvent, setLockEvent] = useState<{ epoch: number }>();
  const generation = useRef(0);
  const pending = useRef(false);
  const lock = useCallback(() => {
    generation.current += 1;
    pending.current = false;
    setUnlocked(false);
    setAuthenticating(false);
    setError("");
    if (supportsNativeFaceID()) void FaceID.cancel().catch(() => undefined);
  }, []);
  useEffect(() => {
    let disposed = false;
    let remove: (() => void) | undefined;
    if (supportsNativeFaceID()) {
      void FaceID.addListener("locked", event => { lock(); setLockEvent(event); }).then(handle => {
        if (disposed) void handle.remove();
        else remove = () => { void handle.remove(); };
      }).catch(() => { lock(); setError("Face ID protection could not start. Reopen the app."); });
    }
    const hidden = () => { if (!supportsNativeFaceID() && document.hidden) lock(); };
    const pageHide = () => lock();
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", pageHide);
    return () => {
      disposed = true;
      generation.current += 1;
      pending.current = false;
      remove?.();
      if (supportsNativeFaceID()) void FaceID.cancel().catch(() => undefined);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", pageHide);
    };
  }, [lock]);

  useEffect(() => {
    if (unlocked || !lockEvent || !supportsNativeFaceID()) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => { void FaceID.acknowledgeLock(lockEvent).catch(() => undefined); });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [unlocked, lockEvent]);

  const unlock = async (): Promise<boolean> => {
    if (pending.current) return false;
    pending.current = true;
    const request = ++generation.current;
    setAuthenticating(true);
    setError("");
    try {
      await authenticateIncome();
      if (generation.current === request) { setUnlocked(true); return true; }
    } catch (e) {
      if (generation.current === request) setError(e instanceof Error ? e.message : "Face ID failed. Income stays locked.");
    } finally {
      if (generation.current === request) { pending.current = false; setAuthenticating(false); }
    }
    return false;
  };
  return { unlocked, authenticating, error, unlock, lock };
}
