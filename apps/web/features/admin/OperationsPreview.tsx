"use client";
import { useState } from "react";
import { previewCatalog } from "../groceries/previewCatalog";

export function OperationsPreview() {
  const [view, setView] = useState<"overview" | "parcels" | "inventory" | "activity">("overview");
  const [parcels, setParcels] = useState([{ id: "DEMO-01", route: "Mirpur → Dhanmondi", courier: "", status: "Awaiting pickup" }, { id: "DEMO-02", route: "Uttara → Gulshan", courier: "Demo courier A", status: "In transit" }]);
  const [inventory, setInventory] = useState(() => previewCatalog.map(p => ({ ...p, stock: Number(p.stock_qty), price: Number(p.price_bdt), fee: Number(p.processing_fee_bdt) })));
  const [activity, setActivity] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "fresh" | "dry">("all");
  const shown = inventory.filter(p => (inventoryFilter === "all" || p.category === inventoryFilter) &&
    (p.sku + " " + p.name_en + " " + p.name_bn).toLowerCase().includes(query.trim().toLowerCase())).slice(0, 18);
  return <div className="panel operations">
    <nav aria-label="Operations sections" className="tabs">{(["overview", "parcels", "inventory", "activity"] as const).map(v =>
      <button key={v} type="button" aria-pressed={v === view} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</nav>
    {view === "overview" && <div className="cards">
      <article><h2>Sample parcels</h2><strong className="amount">{parcels.length}</strong></article>
      <article><h2>Inventory records</h2><strong className="amount">{inventory.length}</strong></article>
      <article><h2>Session changes</h2><strong className="amount">{activity.length}</strong></article>
    </div>}
    {view === "parcels" && <div className="cards">{parcels.map(parcel => <article key={parcel.id}>
      <h2>{parcel.id}</h2><p>{parcel.route}</p><label>Assign sample courier
      <select value={parcel.courier} onChange={e => {
        const courier = e.target.value;
        setParcels(old => old.map(p => p.id === parcel.id ? { ...p, courier } : p));
        setActivity(old => [parcel.id + " courier: " + (courier || "unassigned"), ...old]);
      }}><option value="">Unassigned</option><option>Demo courier A</option><option>Demo courier B</option></select></label><label>Simulated status
      <select value={parcel.status} onChange={e => {
        const status = e.target.value;
        setParcels(old => old.map(p => p.id === parcel.id ? { ...p, status } : p));
        setActivity(old => [parcel.id + " changed to " + status, ...old]);
      }}>{["Awaiting pickup", "In transit", "Delivered"].map(s => <option key={s}>{s}</option>)}</select></label>
    </article>)}</div>}
    {view === "inventory" && <>
      <div className="fields"><label>Search by product or SKU<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <label>Category<select value={inventoryFilter} onChange={e => setInventoryFilter(e.target.value as typeof inventoryFilter)}><option value="all">All</option><option value="fresh">Fresh</option><option value="dry">Dry</option></select></label></div>
      {!shown.length && <p>No matching inventory records.</p>}
      <div className="cards">{shown.map(p => <article key={p.sku}><h3>{p.name_en}</h3><p>{p.sku} · {p.category}</p>
        {([["stock", "Stock (" + p.unit + ")"], ["price", "Unit price (৳)"], ...(p.category === "fresh" ? [["fee", "Preparation fee (৳)"]] : [])] as Array<["stock" | "price" | "fee", string]>).map(([field, label]) =>
          <label key={field}>{label}<input type="number" min="0" max="1000000" step=".01" defaultValue={p[field]} onBlur={e => {
            const value = e.currentTarget.valueAsNumber;
            if (!e.currentTarget.validity.valid || !Number.isFinite(value)) {
              e.currentTarget.value = String(p[field]);
              return;
            }
            if (value === p[field]) return;
            setInventory(old => old.map(item => item.sku === p.sku ? { ...item, [field]: value } : item));
            setActivity(old => [p.sku + " " + field + " changed to " + value, ...old]);
          }} /></label>)}
      </article>)}</div>
      <p>Showing up to 18 records. Use search to find another product.</p>
    </>}
    {view === "activity" && (activity.length ? <ol>{activity.map((item, i) => <li key={i}>{item}</li>)}</ol> : <p>No activity in this session.</p>)}
    <p>Edits reset when this page reloads.</p>
  </div>;
}
