import { useState } from "react";
import type { OwnerSettings, ShopInfo } from "../types";
import type { CustomLists } from "../customLists";
import ShopSettings from "./ShopSettings";
import NumberInput from "./NumberInput";
import FaceIDGate from "./FaceIDGate";
import type { useIncomeAccess } from "../useIncomeAccess";

interface Props {
  shop: ShopInfo; onShop: (shop: ShopInfo) => void;
  lists: CustomLists; onLists: (lists: CustomLists) => void;
  owner: OwnerSettings; onOwner: (owner: OwnerSettings) => void;
  access: ReturnType<typeof useIncomeAccess>;
  onBackup: () => void; onImport: (file?: File) => Promise<void>;
}
export default function SettingsPanel({ shop, onShop, lists, onLists, owner, onOwner, access, onBackup, onImport }: Props) {
  const [saveError, setSaveError] = useState("");
  const changeProtection = async () => {
    setSaveError("");
    // Verify Face ID before opting in, and require a fresh match before disabling it.
    // A cancelled, backgrounded or navigated-away request must never change the preference.
    if (!await access.unlock()) return;
    try { onOwner({ ...owner, faceIDEnabled: !owner.faceIDEnabled }); }
    catch { setSaveError("The privacy setting could not be saved. Nothing changed."); }
    finally { access.lock(); }
  };
  return <div className="settings">
    <section className="card">
      <h2>Settings</h2>
      <h3>Income privacy</h3>
      <label className="check">
        <input type="checkbox" role="switch" aria-label="Require Face ID for Income" checked={owner.faceIDEnabled}
          disabled={access.authenticating} onChange={() => void changeProtection()} />
        Require Face ID for Income
      </label>
      <p>{owner.faceIDEnabled
        ? "Face ID is on. Income and owner tax settings lock when you leave their tab or background the app."
        : "Face ID is off (the default). Income and owner tax settings open without authentication."}</p>
      <p className="hint">Turning this on or off requires Face ID on this iPhone. No app PIN or passcode fallback.</p>
      <p className="hint">Face ID uses the faces enrolled on this iPhone. This is a screen privacy lock, not invoice encryption; orders and backups still contain financial data.</p>
      {saveError && <p role="alert">{saveError}</p>}
      {!owner.faceIDEnabled && access.error && <p role="alert">{access.error}</p>}
      {!owner.faceIDEnabled && access.authenticating && <p role="status">Checking Face ID…</p>}
      {!owner.faceIDEnabled || access.unlocked ? <>
        {owner.faceIDEnabled && access.error && <p role="alert">{access.error}</p>}
        <label>Set aside for income tax (%)
          <NumberInput inputMode="decimal" min="0" max="100" step="0.5" disabled={access.authenticating} value={owner.incomeTaxRate}
            onValueChange={value => onOwner({ ...owner, incomeTaxRate: Math.max(0, Math.min(100, value)) })} />
        </label>
        <p className="hint">An estimate on net sales before expenses. Confirm the rate with your accountant.</p>
        {owner.faceIDEnabled && <button type="button" className="secondary" onClick={access.lock}>Lock owner settings</button>}
      </> : <FaceIDGate authenticating={access.authenticating} error={access.error} onUnlock={() => void access.unlock()} />}
    </section>
    <ShopSettings shop={shop} onChange={onShop} lists={lists} onLists={onLists} />
    <section className="card">
      <h3>Invoice backup</h3>
      <p>These records live on this device, not GitHub. Export regularly. Import merges non-overlapping records; it never overwrites existing invoices.</p>
      <p className="hint">Backups include customer and financial information. Store them securely.</p>
      <button type="button" onClick={onBackup}>Export invoice backup</button>
      <label>Import invoice backup <input aria-label="Import invoice backup" type="file" accept="application/json,.json" onChange={e => { void onImport(e.target.files?.[0]); e.target.value = ""; }} /></label>
    </section>
  </div>;
}
