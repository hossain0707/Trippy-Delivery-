"use client";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";

type Preparation = "none" | "whole" | "cleaned" | "cut";
type Product = {
  sku: string;
  name_en: string;
  name_bn: string;
  category: "fresh" | "dry";
  unit: string;
  price_bdt: string | number;
  processing_fee_bdt: string | number;
  stock_qty: string | number;
};
type Selected = { quantity: number; preparation: Preparation };

export function GroceryCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"all" | "fresh" | "dry">("all");
  const [selected, setSelected] = useState<Record<string, Selected>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Product[]>("/api/v1/groceries/products")
      .then(setProducts)
      .catch(() => setError("The grocery catalog is temporarily unavailable."))
      .finally(() => setLoading(false));
  }, []);

  const shown = products.filter(p => filter === "all" || p.category === filter);
  const summary = useMemo(() => {
    const lines = products.filter(p => Number(selected[p.sku]?.quantity ?? 0) > 0);
    const total = lines.reduce((sum, p) => {
      const choice = selected[p.sku];
      const fee = choice.preparation === "cleaned" || choice.preparation === "cut"
        ? Number(p.processing_fee_bdt) : 0;
      return sum + choice.quantity * (Number(p.price_bdt) + fee);
    }, 0);
    return { lines, total };
  }, [products, selected]);

  function setChoice(sku: string, value: Partial<Selected>, fresh: boolean) {
    setSelected(previous => {
      const current = previous[sku] || { quantity: 0, preparation: fresh ? "whole" : "none" };
      return { ...previous, [sku]: { ...current, ...value } };
    });
  }

  return <section className="feature-card">
    <div className="section-eyebrow">TRIPPY GROCERIES · FIRST-PARTY INVENTORY</div>
    <h2>Fresh from the source. Essentials for every home.</h2>
    <p>TRIPPY is the main vendor. Choose raw, cleaned, or cut preparation for suitable fresh groceries; dry groceries are a separate category.</p>
    <div className="filter-row" role="group" aria-label="Grocery type">
      {(["all", "fresh", "dry"] as const).map(value => <button key={value} type="button"
        className={filter === value ? "filter active" : "filter"} onClick={() => setFilter(value)}>
        {value === "all" ? "All groceries" : value === "fresh" ? "Fresh groceries" : "Dry groceries"}
      </button>)}
    </div>
    {loading && <p className="muted">Loading catalog…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {!loading && !error && shown.length === 0 && <p className="muted">No products are available right now.</p>}
    <div className="product-grid">
      {shown.map(p => {
        const choice = selected[p.sku] || { quantity: 0, preparation: p.category === "fresh" ? "whole" : "none" };
        return <article className="product-card" key={p.sku}>
          <div className="product-emoji" aria-hidden="true">{p.category === "fresh" ? "🥬" : "🛒"}</div>
          <div className="product-meta">{p.category === "fresh" ? "FRESH · RAW OR PROCESSED" : "DRY · ESSENTIALS"}</div>
          <h3>{p.name_en}</h3><p lang="bn">{p.name_bn}</p>
          <strong>৳{p.price_bdt} <small>/ {p.unit}</small></strong>
          {p.category === "fresh" && <label className="product-option">Preparation
            <select value={choice.preparation} onChange={e => setChoice(p.sku, { preparation: e.target.value as Preparation }, true)}>
              <option value="whole">Unprocessed / whole</option>
              <option value="cleaned">Cleaned</option>
              <option value="cut">Cleaned &amp; cut</option>
            </select>
          </label>}
          <label className="product-option">Quantity ({p.unit})
            <input min="0" max={Number(p.stock_qty)} step={p.unit === "kg" ? "0.5" : "1"} type="number"
              value={choice.quantity} onChange={e => setChoice(p.sku, {
                quantity: Math.min(Number(p.stock_qty), Math.max(0, Number(e.target.value) || 0))
              }, p.category === "fresh")} />
          </label>
          <div className="stock">In stock: {p.stock_qty} {p.unit}</div>
        </article>;
      })}
    </div>
    {summary.lines.length > 0 && <aside className="cart-preview">
      <div><span className="section-eyebrow">SELECTED ITEMS</span><h3>Grocery selection preview</h3></div>
      {summary.lines.map(p => <div className="cart-line" key={p.sku}>
        <span>{p.name_en} · {selected[p.sku].quantity} {p.unit} · {selected[p.sku].preparation}</span>
        <strong>৳{(selected[p.sku].quantity * (Number(p.price_bdt) +
          (["cleaned", "cut"].includes(selected[p.sku].preparation) ? Number(p.processing_fee_bdt) : 0))).toFixed(2)}</strong>
      </div>)}
      <div className="cart-line"><strong>Indicative item total</strong><strong>৳{summary.total.toFixed(2)}</strong></div>
      <p className="muted">Checkout is intentionally disabled until real authentication, payment, packing and delivery-slot capacity pass release review. Prices are local development examples.</p>
    </aside>}
    <div className="demo-note">This catalog is a development preview. Live inventory, delivery fees, taxes, checkout and fulfillment integrations are not yet active.</div>
  </section>;
}
