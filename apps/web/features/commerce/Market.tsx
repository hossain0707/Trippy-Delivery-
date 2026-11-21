"use client";
import Link from "next/link";
import { searchScore } from "@/lib/search.mjs";
import { useEffect, useState } from "react";
import {
  commerceApi,
  money,
  type Product,
  type BasketLine,
} from "@/lib/commerce";
import {
  readBasket,
  writeBasket,
  updateBasket,
  lineTotal,
} from "@/lib/basket.mjs";
export function Market({
  bn = false,
  detail = false,
}: {
  bn?: boolean;
  detail?: boolean;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [sort, setSort] = useState("availability");
  const [selected, setSelected] = useState("");
  const [prep, setPrep] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [visibleCount, setVisibleCount] = useState(24);
  const [basket, setBasket] = useState<BasketLine[]>([]);
  const t = (en: string, b: string) => (bn ? b : en);
  useEffect(() => {
    let active = true;
    setBasket(readBasket());
    setSelected(new URLSearchParams(window.location.search).get("sku") || "");
    commerceApi<Product[]>("/groceries/products")
      .then((p) => {
        if (active) setProducts(p);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  function preparationOptions(p: Product) {
    if (p.category !== "fresh") return [];
    return [
      { id: "whole", name_en: "Whole / raw", name_bn: "আস্ত / কাঁচা" },
      { id: "cleaned", name_en: "Cleaned / washed", name_bn: "পরিষ্কার / ধোয়া" },
      { id: "cut", name_en: "Cut & cleaned", name_bn: "কাটা ও পরিষ্কার" },
      {
        id: "custom",
        name_en: "Custom preparation",
        name_bn: "আপনার নির্দেশনা অনুযায়ী",
      },
    ].map((v) => ({
      ...v,
      enabled: true,
      fee_bdt: "0",
      yield_percent: 100,
      image: "",
      notes:
        "Preparation request; final cost and yield confirmed with your quote.",
    }));
  }
  const names: Record<string, string[]> = {
    vegetables: ["Vegetables & greens", "সবজি ও শাক"],
    fish: ["Fish & seafood", "মাছ ও চিংড়ি"],
    meat: ["Meat & poultry", "মাংস ও মুরগি"],
    fruit: ["Fruits", "ফল"],
    pantry: ["Rice, lentils & grains", "চাল, ডাল ও শস্য"],
    spices: ["Cooking & spices", "রান্না ও মসলা"],
    dairy: ["Dairy & eggs", "দুধ ও ডিম"],
    bakery: ["Bakery", "বেকারি"],
    packaged: ["Packaged groceries", "প্যাকেটজাত পণ্য"],
    essentials: ["Household essentials", "গৃহস্থালি পণ্য"],
  };
  const shown = products
    .filter(
      (p) =>
        (!detail || p.sku === selected) &&
        (department === "all" || p.details.department === department) &&
        searchScore(p, query) > 0,
    )
    .sort((a, b) =>
      query.trim()
        ? searchScore(b, query) - searchScore(a, query)
        : sort === "price"
          ? Number(a.price_bdt) - Number(b.price_bdt)
          : sort === "availability"
            ? Number(b.price_approved) - Number(a.price_approved) ||
              Number(b.stock_qty) - Number(a.stock_qty)
            : (bn ? a.name_bn : a.name_en).localeCompare(
                bn ? b.name_bn : b.name_en,
              ),
    );
  function add(p: Product) {
    const options = preparationOptions(p);
    const line = {
      sku: p.sku,
      quantity: quantities[p.sku] || p.details.minimum_quantity || "1",
      preparation: prep[p.sku] || options.find((o) => o.enabled)?.id || "none",
    };
    const next = updateBasket(readBasket(), line);
    writeBasket(next);
    setBasket(next);
    setNotice(t("Added to your basket.", "ঝুড়িতে যোগ হয়েছে।"));
    setDrawer(true);
  }
  return (
    <section id="shop" className="market-shell">
      {drawer && (
        <aside
          className="basket-drawer"
          aria-label={t("Basket summary", "ঝুড়ির সারাংশ")}
        >
          <button className="text-button" onClick={() => setDrawer(false)}>
            {t("Close", "বন্ধ করুন")}
          </button>
          <h2>{t("Your basket", "আপনার ঝুড়ি")}</h2>
          {basket.map((l) => {
            const p = products.find((p) => p.sku === l.sku);
            return (
              <article key={l.sku}>
                <strong>{p ? (bn ? p.name_bn : p.name_en) : l.sku}</strong>
                <p>
                  {l.quantity} {p?.unit} · {l.preparation} ·{" "}
                  {p ? money(lineTotal(p, l), bn) : ""}
                </p>
              </article>
            );
          })}
          <Link className="primary" href="/cart">
            {t("View basket & checkout", "ঝুড়ি ও চেকআউট দেখুন")}
          </Link>
        </aside>
      )}

      <div className="market-toolbar">
        <div>
          <p className="kicker">TRIPPY MARKET</p>
          <h2>
            {detail
              ? t("From our market", "আমাদের বাজার থেকে")
              : t(
                  "Everyday essentials, thoughtfully prepared.",
                  "প্রতিদিনের বাজার, যত্নের প্রস্তুতি।",
                )}
          </h2>
        </div>
        <Link className="primary" href="/cart">
          {t("Your basket", "আপনার ঝুড়ি")} ({basket.length})
        </Link>
      </div>
      {!detail && (
        <>
          <div className="fields">
            <label>
              {t("Find your groceries", "পণ্য খুঁজুন")}
              <input
                type="search"
                value={query}
                onChange={(e) => (
                  setQuery(e.target.value),
                  setVisibleCount(24)
                )}
                placeholder={t(
                  "Try fish, rice or tomatoes",
                  "মাছ, চাল বা টমেটো খুঁজুন",
                )}
              />
            </label>
            <label>
              {t("Sort by", "সাজান")}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="name">{t("Name", "নাম")}</option>
                <option value="price">
                  {t("Price: low to high", "কম দাম আগে")}
                </option>
                <option value="availability">
                  {t("Priced products first", "প্রাপ্য পণ্য আগে")}
                </option>
              </select>
            </label>
          </div>
          <nav
            className="department-pills"
            aria-label={t("Departments", "বিভাগ")}
          >
            <button
              aria-pressed={department === "all"}
              onClick={() => setDepartment("all")}
            >
              {t("All groceries", "সব পণ্য")}
            </button>
            {Object.entries(names).map(([id, n]) => (
              <button
                key={id}
                aria-pressed={department === id}
                onClick={() => (setDepartment(id), setVisibleCount(24))}
              >
                {n[bn ? 1 : 0]}
              </button>
            ))}
          </nav>
        </>
      )}
      <p role="status">
        {notice ||
          error ||
          (loading ? t("Opening the market…", "পণ্য আসছে…") : "")}
      </p>
      <div className="shopping-note" role="note">
        <strong>
          {t("Order groceries, your way", "আপনার পছন্দে বাজার করুন")}
        </strong>
        <p>
          {t(
            "Choose your groceries and preparation, add delivery details, and submit a request. TRIPPY confirms availability and the final quote. No payment is collected.",
            "পণ্য ও প্রস্তুতি বেছে ডেলিভারির তথ্য দিয়ে অনুরোধ পাঠান। ট্রিপি প্রাপ্যতা ও চূড়ান্ত দাম নিশ্চিত করবে। কোনো পেমেন্ট নেওয়া হচ্ছে না।",
          )}
        </p>
      </div>
      <div className={detail ? "product-detail-grid" : "market-grid"}>
        {shown.slice(0, detail ? 1 : visibleCount).map((p) => {
          const options = preparationOptions(p);
          const choice = options.find(
            (o) => o.id === (prep[p.sku] || options.find((o) => o.enabled)?.id),
          );
          const priced = p.price_approved && Number(p.price_bdt) > 0;
          const available = priced && Number(p.stock_qty) > 0;
          return (
            <article key={p.sku} className="market-product">
              {p.details.image && (
                <Link
                  className="product-photo"
                  href={"/product?sku=" + encodeURIComponent(p.sku)}
                >
                  {p.details.image ? (
                    <img
                      src={p.details.image}
                      alt={bn ? p.name_bn : p.name_en}
                      loading="lazy"
                      width="400"
                      height="320"
                    />
                  ) : (
                    <p className="photo-unavailable">
                      {t(
                        "Product photograph unavailable",
                        "পণ্যের ছবি পাওয়া যাচ্ছে না",
                      )}
                    </p>
                  )}
                  {p.details.seasonal && (
                    <span className="season-tag">{t("Seasonal", "মৌসুমি")}</span>
                  )}
                </Link>
              )}
              {p.details.photo_credit && (
                <p className="photo-credit">
                  <a
                    href={p.details.photo_credit.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {p.details.photo_credit.creator} ·{" "}
                    {p.details.photo_credit.license}
                  </a>
                  <span>
                    {" "}
                    · {t("Representative photograph", "প্রতিনিধিত্বমূলক আলোকচিত্র")}
                  </span>
                </p>
              )}
              <div className="product-content">
                <p className="product-department">
                  {names[p.details.department || "pantry"]?.[bn ? 1 : 0]}
                </p>
                <h3>
                  <Link href={"/product?sku=" + encodeURIComponent(p.sku)}>
                    {bn ? p.name_bn : p.name_en}
                  </Link>
                </h3>
                <p className="product-subtitle">
                  {bn ? p.name_en : p.name_bn} · {p.unit}
                </p>
                <p>
                  {bn ? p.details.description_bn : p.details.description_en}
                </p>
                <p className="price-line">
                  {p.price_approved
                    ? money(p.price_bdt, bn)
                    : t("Ask for today’s price", "আজকের দাম জানতে চান")}{" "}
                  <span>{p.price_approved ? "/ " + p.unit : ""}</span>
                </p>
                <p className={available ? "stock-ready" : "stock-pending"}>
                  {available
                    ? t("Available to reserve", "অর্ডারের জন্য উপলব্ধ")
                    : t(
                        priced
                          ? "Add to your basket; stock confirmation required"
                          : "Price being checked",
                        priced
                          ? "ঝুড়িতে রাখুন; মজুত নিশ্চিত করা প্রয়োজন"
                          : "দাম যাচাই করা হচ্ছে",
                      )}
                </p>
                {p.details.market_price && (
                  <details className="market-price-source">
                    <summary>
                      {t("Market-based price", "বাজারভিত্তিক দাম")} ·{" "}
                      {p.details.market_price.checked_on}
                    </summary>
                    <p>
                      {t(
                        "Retail comparison checked on this date; prices vary by pack and preparation. This is not a live price feed.",
                        "এই তারিখে খুচরা দামের তুলনা করা হয়েছে; প্যাকেট ও প্রস্তুতি অনুযায়ী দাম ভিন্ন। এটি সরাসরি বাজারদরের ফিড নয়।",
                      )}
                    </p>
                    <p>{p.details.market_price.basis}</p>
                    <a
                      href={p.details.market_price.source_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("View price source", "দামের উৎস দেখুন")}
                    </a>
                  </details>
                )}
                {options.length > 0 && (
                  <label>
                    {t("Preparation request", "প্রস্তুতির অনুরোধ")}
                    <select
                      value={choice?.id || "whole"}
                      onChange={(e) =>
                        setPrep({ ...prep, [p.sku]: e.target.value })
                      }
                    >
                      {options.map((o) => (
                        <option key={o.id} value={o.id} disabled={!o.enabled}>
                          {bn ? o.name_bn : o.name_en}
                          {!o.enabled
                            ? t(" — not offered yet", " — এখনো চালু নয়")
                            : ""}{" "}
                          {o.enabled && Number(o.fee_bdt) > 0
                            ? "+ " + money(o.fee_bdt, bn)
                            : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {detail && choice && (
                  <div className="preparation-note">
                    {choice.image && (
                      <img
                        src={choice.image}
                        alt={bn ? choice.name_bn : choice.name_en}
                        width="180"
                        height="120"
                      />
                    )}
                    <p>{choice.notes}</p>
                    <p>
                      {t("Requested quantity", "অনুরোধের পরিমাণ")}:{" "}
                      {(Number(
                        quantities[p.sku] || p.details.minimum_quantity || 1,
                      ) *
                        choice.yield_percent) /
                        100}{" "}
                      {p.unit}.{" "}
                      {t(
                        "Final prepared weight and any preparation charge will be confirmed with your quote.",
                        "প্রস্তুতের পর ওজন এবং প্রস্তুতির খরচ চূড়ান্ত দামের সাথে নিশ্চিত করা হবে।",
                      )}
                    </p>
                  </div>
                )}
                <div className="product-buy">
                  <label>
                    {t("Quantity", "পরিমাণ")}
                    <input
                      type="number"
                      min={p.details.minimum_quantity || 1}
                      step={p.details.quantity_step || 1}
                      max="50"
                      value={
                        quantities[p.sku] || p.details.minimum_quantity || "1"
                      }
                      onChange={(e) =>
                        setQuantities({
                          ...quantities,
                          [p.sku]: e.target.value,
                        })
                      }
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={
                      Number(
                        quantities[p.sku] || p.details.minimum_quantity || 1,
                      ) <= 0 ||
                      Number(
                        quantities[p.sku] || p.details.minimum_quantity || 1,
                      ) > 50
                    }
                    onClick={() => add(p)}
                  >
                    {priced
                      ? t("Add to basket", "ঝুড়িতে রাখুন")
                      : t("Save to shopping list", "বাজারের তালিকায় রাখুন")}
                  </button>
                </div>
                {detail && (
                  <p>
                    {p.details.packaging} {p.details.season}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!loading && !shown.length && (
        <p>
          {t(
            "No products match your search.",
            "এই অনুসন্ধানে কোনো পণ্য পাওয়া যায়নি।",
          )}
        </p>
      )}
      {detail && (
        <aside className="related-products">
          <h2>{t("You may also like", "আরও দেখতে পারেন")}</h2>
          {products
            .filter(
              (p) =>
                p.sku !== selected &&
                p.details.department === shown[0]?.details.department,
            )
            .slice(0, 6)
            .map((p) => (
              <Link
                key={p.sku}
                href={"/product?sku=" + p.sku}
                onClick={() => setSelected(p.sku)}
              >
                {bn ? p.name_bn : p.name_en}
              </Link>
            ))}
        </aside>
      )}
    </section>
  );
}
