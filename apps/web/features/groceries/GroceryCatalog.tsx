"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

type Product = {
  sku: string;
  name_en: string;
  name_bn: string;
  category: "fresh" | "dry";
  unit: string;
  price_bdt: number;
  processing_fee_bdt: number;
  stock_qty: number;
};

export function GroceryCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"all" | "fresh" | "dry">("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Product[]>("/api/v1/groceries/products")
      .then(setProducts)
      .catch(e => setError(e instanceof Error ? e.message : "Unable to load catalog"))
      .finally(() => setLoading(false));
  }, []);
  const shown = products.filter(p => filter === "all" || p.category === filter);

  return <section className="feature-card">
    <div className="section-eyebrow">TRIPPY GROCERIES</div>
    <h2>Fresh from the source. Essentials for every home.</h2>
    <p>TRIPPY is the primary grocery vendor. Fresh products can be ordered raw, cleaned, or cut where available.</p>
    <div className="filter-row" role="group" aria-label="Grocery type">
      {(["all", "fresh", "dry"] as const).map(value => <button key={value} type="button"
        className={filter === value ? "filter active" : "filter"} onClick={() => setFilter(value)}>
        {value === "all" ? "All groceries" : value === "fresh" ? "Fresh groceries" : "Dry groceries"}
      </button>)}
    </div>
    {loading && <p className="muted">Loading live catalog…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {!loading && !error && shown.length === 0 && <p className="muted">No products published yet. Use the local example seed for a development preview.</p>}
    <div className="product-grid">
      {shown.map(p => <article className="product-card" key={p.sku}>
        <div className="product-emoji" aria-hidden="true">{p.category === "fresh" ? "🥬" : "🛒"}</div>
        <div className="product-meta">{p.category === "fresh" ? "FRESH · PREPARATION AVAILABLE" : "DRY · ESSENTIALS"}</div>
        <h3>{p.name_en}</h3><p lang="bn">{p.name_bn}</p>
        <strong>৳{p.price_bdt} <small>/ {p.unit}</small></strong>
        <div className="stock">Stock: {p.stock_qty} {p.unit}</div>
      </article>)}
    </div>
    <div className="demo-note">Checkout UI, payment capture, delivery-slot capacity and live operations are still release gates.</div>
  </section>;
}
