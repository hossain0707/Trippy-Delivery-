"use client";
import { useState } from "react";
import { previewCatalog } from "../groceries/previewCatalog";

export function OperationsPreview() {
  const [view, setView] = useState<"parcels" | "inventory" | "activity">("parcels");
  const [parcels, setParcels] = useState([{ id: "DEMO-01", route: "Mirpur → Dhanmondi", status: "Awaiting pickup" }, { id: "DEMO-02", route: "Uttara → Gulshan", status: "In transit" }]);
  const [inventory, setInventory] = useState(() => previewCatalog.map(p => ({ ...p, stock: Number(p.stock_qty) })));
  const [activity, setActivity] = useState<string[]>([]);
  return <div className="panel">
    <nav aria-label="Operations sections" className="tabs">{(["parcels", "inventory", "activity"] as const).map(v =>
      <button key={v} type="button" aria-pressed={v === view} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</nav>
    {view === "parcels" && <div className="cards">{parcels.map(parcel => <article key={parcel.id}>
      <h2>{parcel.id}</h2><p>{parcel.route}</p><label>Simulated status
      <select value={parcel.status} onChange={e => {
        const status = e.target.value;
        setParcels(old => old.map(p => p.id === parcel.id ? { ...p, status } : p));
        setActivity(old => [parcel.id + " changed to " + status, ...old]);
      }}>{["Awaiting pickup", "In transit", "Delivered"].map(s => <option key={s}>{s}</option>)}</select></label>
    </article>)}</div>}
    {view === "inventory" && <div className="cards">{inventory.map(p => <article key={p.sku}><h3>{p.name_en}</h3>
      <p>{p.category === "fresh" ? "Fresh" : "Dry"} · ৳{p.price_bdt}/{p.unit}</p>
      <label>Sample stock ({p.unit})<input type="number" min="0" step="1" defaultValue={p.stock} onBlur={e => {
        const stock = e.currentTarget.valueAsNumber;
        if (!e.currentTarget.validity.valid || !Number.isFinite(stock) || stock === p.stock) {
          e.currentTarget.value = String(p.stock);
          return;
        }
        setInventory(old => old.map(item => item.sku === p.sku ? { ...item, stock } : item));
        setActivity(old => [p.sku + " stock changed to " + stock, ...old]);
      }} /></label>
    </article>)}</div>}
    {view === "activity" && (activity.length ? <ol>{activity.map((item, i) => <li key={i}>{item}</li>)}</ol> : <p>No activity in this session.</p>)}
    <p>Edits reset when this page reloads.</p>
  </div>;
}
