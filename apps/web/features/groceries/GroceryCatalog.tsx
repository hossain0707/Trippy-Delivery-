"use client";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { departments, type Department } from "./departments";
import { previewCatalog } from "./previewCatalog";

type Product = { sku: string; name_en: string; name_bn: string; category: "fresh" | "dry";
  unit: string; price_bdt: number | string; processing_fee_bdt: number | string; stock_qty: number | string; department?: Department; photo?: string | null };
type Prep = "whole" | "cleaned" | "cut";
type Line = { sku: string; prep: Prep; quantity: number };
const departmentPhotos: Record<Department, string> = { vegetables: "eggplant", fruit: "mango", fish: "rohu", meat: "chicken", pantry: "rice", essentials: "soap" };
const catalogDetails = new Map<string, { department: Department; photo: string | null }>(previewCatalog.map(p => [p.sku, p]));
const preparations = { whole: ["Whole / as sold", "আস্ত / স্বাভাবিক"], cleaned: ["Cleaned", "পরিষ্কার করা"], cut: ["Cleaned and cut", "পরিষ্কার ও কাটা"] } as const;

export function GroceryCatalog({ bn = false }: { bn?: boolean }) {
  const t = (en: string, bangla: string) => bn ? bangla : en;
  const [products, setProducts] = useState<readonly Product[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "sample">("loading");
  const [category, setCategory] = useState<"fresh" | "dry">("fresh");
  const [department, setDepartment] = useState<Department | undefined>("vegetables");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(12);
  const [cart, setCart] = useState<Line[]>([]);
  useEffect(() => {
    let active = true;
    apiGet<Product[]>("/api/v1/groceries/products").then(items => {
      if (active) { setProducts(items); setStatus("live"); }
    }).catch(() => {
      if (active) { setProducts(previewCatalog); setStatus("sample"); }
    });
    return () => { active = false; };
  }, []);
  const money = (value: number) => new Intl.NumberFormat(bn ? "bn-BD" : "en-BD", { style: "currency", currency: "BDT", currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(value);
  const name = (p: Product) => bn ? p.name_bn : p.name_en;
  const unit = (p: Product) => bn && p.unit === "kg" ? "কেজি" : p.unit;
  const prepName = (p: Prep) => preparations[p][bn ? 1 : 0];
  const shown = products.filter(p => (search.trim() ? true : p.category === category && (!department || (p.department ?? catalogDetails.get(p.sku)?.department) === department)) && (p.name_en + " " + p.name_bn).toLowerCase().includes(search.trim().toLowerCase()));
  const priced = cart.flatMap(line => {
    const product = products.find(p => p.sku === line.sku);
    if (!product) return [];
    const fee = line.prep === "whole" ? 0 : Number(product.processing_fee_bdt);
    return [{ ...line, product, fee, total: line.quantity * (Number(product.price_bdt) + fee) }];
  });
  function add(p: Product, prep: Prep) {
    setCart(previous => {
      const quantity = Math.min(1, Number(p.stock_qty) - previous.filter(l => l.sku === p.sku).reduce((sum, l) => sum + l.quantity, 0));
      if (quantity <= 0) return previous;
      if (!previous.some(l => l.sku === p.sku && l.prep === prep)) return [...previous, { sku: p.sku, prep, quantity }];
      return previous.map(l => l.sku === p.sku && l.prep === prep ? { ...l, quantity: l.quantity + quantity } : l);
    });
  }
  return <div className="split">
    <div className="shop-catalog">
      <label>{t("Search groceries", "পণ্য খুঁজুন")}<input type="search" value={search} onChange={e => { setSearch(e.target.value); setLimit(12); }} /></label>
      <div className="tabs"><button aria-pressed={category === "fresh"} onClick={() => { setCategory("fresh"); setDepartment(undefined); setSearch(""); setLimit(12); }}>{t("Fresh groceries", "তাজা পণ্য")}</button>
        <button aria-pressed={category === "dry"} onClick={() => { setCategory("dry"); setDepartment(undefined); setSearch(""); setLimit(12); }}>{t("Dry groceries & essentials", "শুকনা ও নিত্যপ্রয়োজনীয় পণ্য")}</button></div>
      {!search.trim() && <div className="department-tabs" aria-label={t("Departments", "বিভাগ")}>

        {(Object.keys(departments) as Department[]).filter(d => category === "dry" ? d === "pantry" || d === "essentials" : d !== "pantry" && d !== "essentials").map(d =>
          <button type="button" key={d} aria-pressed={department === d} onClick={() => { setDepartment(department === d ? undefined : d); setLimit(12); }}>
            <img src={"/products/" + departmentPhotos[d] + ".webp"} alt="" width={100} height={100} />
            <span>{departments[d][bn ? 1 : 0]}</span></button>)}
      </div>}
      {status === "loading" && <p role="status">{t("Loading groceries…", "পণ্য লোড হচ্ছে…")}</p>}
      {status === "sample" && <p role="status">{t("Sample catalog · Live inventory is temporarily unavailable.", "নমুনা পণ্য · লাইভ স্টক এখন পাওয়া যাচ্ছে না।")}</p>}
      {status !== "loading" && shown.length === 0 && <p>{t("No matching groceries.", "মিলেছে এমন পণ্য নেই।")}</p>}
      {status !== "loading" && shown.length > 0 && <h3 className="shelf-heading">{search.trim() ? t("Search results", "খোঁজার ফলাফল") : department ? departments[department][bn ? 1 : 0] : category === "fresh" ? t("All Fresh groceries", "সব তাজা পণ্য") : t("All Dry groceries & essentials", "সব শুকনা ও নিত্যপ্রয়োজনীয় পণ্য")} <small>{shown.length.toLocaleString(bn ? "bn-BD" : "en-BD")} {t("products", "পণ্য")}</small></h3>}
      <div className="cards">{shown.slice(0, limit).map(p => {
        const canPrepare = p.category === "fresh" && Number(p.processing_fee_bdt) > 0;
        const remaining = Number(p.stock_qty) - cart.filter(l => l.sku === p.sku).reduce((sum, l) => sum + l.quantity, 0);
        const photo = p.photo ?? catalogDetails.get(p.sku)?.photo;
        const group = p.department ?? catalogDetails.get(p.sku)?.department;
        return <article key={p.sku}>
          {photo && <img className="product-photo" src={"/products/" + photo + ".webp"} alt={name(p)} width={280} height={280} loading="lazy" />}
          {group && <p className="product-department">{departments[group][bn ? 1 : 0]}</p>}
          <h3>{name(p)}</h3><p>{money(Number(p.price_bdt))} / {unit(p)}</p>
          <form onSubmit={e => { e.preventDefault(); add(p, canPrepare ? new FormData(e.currentTarget).get("prep") as Prep : "whole"); }}>
            {canPrepare && <label>{t("Preparation", "প্রস্তুতি")}<select name="prep">
              {(["whole", "cleaned", "cut"] as const).map(v => <option value={v} key={v}>{prepName(v)}{v !== "whole" && " +" + money(Number(p.processing_fee_bdt)) + "/" + unit(p)}</option>)}
            </select></label>}
            <button className="primary" type="submit" disabled={remaining <= 0}>{remaining > 0 ? t("Add to basket", "ঝুড়িতে যোগ করুন") : t("Stock limit reached", "স্টকের সীমা পূর্ণ")}</button>
          </form>
        </article>;
      })}</div>
      {shown.length > limit && <button type="button" className="secondary more-products" onClick={() => setLimit(v => v + 12)}>{t("Show more products", "আরও পণ্য দেখুন")}</button>}
    </div>
    <aside id="basket" className="panel summary"><h3>{t("Your basket", "আপনার ঝুড়ি")}</h3>
      {priced.length === 0 && <p>{t("Your basket is empty.", "আপনার ঝুড়ি খালি।")}</p>}
      {priced.map(l => <div className="cart-row" key={l.sku + l.prep}>
        <p>{name(l.product)} · {l.quantity} {unit(l.product)}{l.product.category === "fresh" && " · " + prepName(l.prep)}
          {l.fee > 0 && <><br/>{t("Preparation", "প্রস্তুতি")} +{money(l.fee * l.quantity)}</>}<br/><strong>{money(l.total)}</strong></p>
        <button type="button" className="secondary" aria-label={t("Remove one unit of ", "এক ইউনিট সরান ") + name(l.product)}
          onClick={() => setCart(old => old.flatMap(v => v.sku !== l.sku || v.prep !== l.prep ? [v] : v.quantity > 1 ? [{...v, quantity: v.quantity - 1}] : []))}>−</button>
      </div>)}
      <p aria-live="polite"><strong>{t("Item subtotal", "পণ্যের মোট")} · {money(priced.reduce((sum, line) => sum + line.total, 0))}</strong></p>
      <p>{t("Preview only. Checkout is disabled.", "শুধু প্রিভিউ। চেকআউট বন্ধ আছে।")}</p>
      <details><summary>{t("Proposed delivery windows", "প্রস্তাবিত ডেলিভারি সময়")}</summary>
        <p>{t("Dhaka time: before 1 PM, today by 9 PM. From 1 PM to before 9 PM, tomorrow by 9 AM. From 9 PM, tomorrow by 9 PM.", "ঢাকার সময়: দুপুর ১টার আগে, আজ রাত ৯টার মধ্যে। দুপুর ১টা থেকে রাত ৯টার আগে, আগামীকাল সকাল ৯টার মধ্যে। রাত ৯টা থেকে, আগামীকাল রাত ৯টার মধ্যে।")}</p>
      </details>
    </aside>
  </div>;
}
