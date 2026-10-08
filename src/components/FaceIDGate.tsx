import { useEffect, useState } from "react";
import { faceIDStatus } from "../faceID";
import type { FaceIDStatus } from "../faceID";

interface Props { authenticating: boolean; error: string; onUnlock: () => void }
export default function FaceIDGate({ authenticating, error, onUnlock }: Props) {
  const [status, setStatus] = useState<FaceIDStatus>();
  useEffect(() => {
    let active = true;
    void faceIDStatus().then(value => { if (active) setStatus(value); }).catch(e => {
      if (active) setStatus({ available: false, reason: e instanceof Error ? e.message : "Face ID is unavailable." });
    });
    return () => { active = false; };
  }, []);
  return <section className="card" aria-label="Face ID protection">
    <h2>Owner only</h2>
    <p>Use Face ID to view Income and owner settings. No app PIN or passcode fallback.</p>
    {status && !status.available && <p className="hint">{status.reason}</p>}
    <button type="button" disabled={authenticating} onClick={onUnlock}>
      {authenticating ? "Checking Face ID…" : "Unlock with Face ID"}
    </button>
    {error && <p role="alert" className="warn">{error}</p>}
  </section>;
}
