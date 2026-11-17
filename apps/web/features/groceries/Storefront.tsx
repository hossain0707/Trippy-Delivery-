"use client";
import { useState } from "react";
import { GroceryCatalog } from "./GroceryCatalog";

export function Storefront() {
  const [bn, setBangla] = useState(false);
  const t = (en: string, bangla: string) => bn ? bangla : en;
  return <div className="store" lang={bn ? "bn" : "en"}>
    <header className="site-header"><div className="wrap bar">
      <a href="/" className="wordmark">TRIPPY<span> Groceries</span></a>
      <nav aria-label={t("Shop navigation", "দোকানের নেভিগেশন")}>
        <a href="/parcels">{t("Parcel delivery", "পার্সেল ডেলিভারি")}</a>
        <a href="#basket">{t("Basket", "ঝুড়ি")}</a>
        <button type="button" onClick={() => setBangla(!bn)}>{bn ? "English" : "বাংলা"}</button>
      </nav>
    </div></header>
    <main className="wrap">
      <section className="store-hero">
        <p className="kicker">{t("TRIPPY MARKET · DHAKA", "ট্রিপি বাজার · ঢাকা")}</p>
        <h1>{t("The Bangladeshi kitchen starts here.", "বাংলার রান্নাঘরের বাজার এখানেই।")}</h1>
        <p>{t("Shop the produce, fish, meat and pantry staples you use every day.", "প্রতিদিনের সবজি, মাছ, মাংস ও নিত্যপ্রয়োজনীয় পণ্য খুঁজুন।")}</p>
        <a className="primary" href="#shop">{t("Browse the market", "বাজার দেখুন")} ↓</a>
      </section>
      <section className="service" id="shop"><h2>{t("Shop by department", "বিভাগ অনুযায়ী বাজার করুন")}</h2><GroceryCatalog bn={bn}/></section>
    </main>
    <footer className="site-footer"><div className="wrap"><strong>TRIPPY Groceries</strong>
      <p>{t("Dhaka market preview · Orders and payments are disabled.", "ঢাকা বাজার প্রিভিউ · অর্ডার ও পেমেন্ট বন্ধ আছে।")}</p></div></footer>
  </div>;
}
