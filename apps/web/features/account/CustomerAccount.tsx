"use client";
import { useEffect, useState } from "react";
import { GoogleAccess } from "./GoogleAccess";

const stops = ["Pickup", "Sorting", "In transit", "Delivered"];
const storageKey = "trippy-preview-display-name";

export function CustomerAccount() {
  const [name, setName] = useState("");
  const [saved, setSaved] = useState("");
  const [stage, setStage] = useState(-1);
  useEffect(() => {
    try { setName(localStorage.getItem(storageKey) ?? ""); } catch { /* Browser storage is optional. */ }
  }, []);
  useEffect(() => {
    if (stage < 0 || stage >= stops.length - 1) return;
    const timer = window.setTimeout(() => setStage(stage + 1), 2400);
    return () => window.clearTimeout(timer);
  }, [stage]);
  return <><header className="site-header"><div className="wrap bar"><a className="wordmark" href="/">TRIPPY Delivery</a><nav><a href="/parcels">Parcels</a><a href="/groceries">Groceries</a></nav></div></header>
    <main className="wrap service account"><p className="kicker">CUSTOMER PREVIEW</p><h1>My TRIPPY</h1>
      <p>Sign in with Google to view your profile. Parcel tracking below uses sample data.</p>
      <GoogleAccess />
      <div className="account-grid"><section className="panel"><h2>Parcel tracking demo</h2><p>Sample route · Mirpur to Dhanmondi</p>
        <div className="tracking-track" aria-hidden="true"><span style={{ width: (Math.max(0, stage) / (stops.length - 1) * 100) + "%" }}/></div>
        <ol className="tracking-stops">{stops.map((stop, i) => <li key={stop} aria-current={i === stage ? "step" : undefined}>{stop}</li>)}</ol>
        <p role="status">{stage < 0 ? "Ready to simulate" : "Sample status · " + stops[stage]}</p>
        <button type="button" className="primary" onClick={() => setStage(stage >= 0 && stage < stops.length - 1 ? -1 : 0)}>{stage >= 0 && stage < stops.length - 1 ? "Stop demo" : "Start tracking demo"}</button>
      </section><section className="panel"><h2>Display preferences</h2>
        <form onSubmit={e => {
          e.preventDefault();
          try { localStorage.setItem(storageKey, name.trim()); setSaved("Saved on this device."); }
          catch { setSaved("This browser couldn’t save your preferences."); }
        }}><label>Display name<input maxLength={60} autoComplete="off" value={name} onChange={e => { setName(e.target.value); setSaved(""); }} /></label>
          <p>This preference is stored on this device.</p><button className="primary">Save preference</button><p role="status">{saved}</p></form>
      </section></div>
      <div className="service-entry account-links"><a href="/parcels"><h2>Send a parcel</h2><span>Get a quote →</span></a><a href="/groceries"><h2>TRIPPY Groceries</h2><span>Browse the market →</span></a></div>
    </main></>;
}
