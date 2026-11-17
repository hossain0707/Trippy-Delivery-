"use client";
import { useState } from "react";
import { ParcelQuote } from "@/features/parcels/ParcelQuote";
import { GroceryCatalog } from "@/features/groceries/GroceryCatalog";

export default function Home() {
  const [bn, setBangla] = useState(false);
  const t = (en: string, bangla: string) => bn ? bangla : en;
  return <div lang={bn ? "bn" : "en"}>
    <header className="site-header"><div className="wrap bar">
      <a href="#" className="wordmark">TRIPPY<span> Delivery</span></a>
      <nav aria-label={t("Main navigation", "প্রধান নেভিগেশন")}>
        <a href="#parcel">{t("Parcels", "পার্সেল")}</a><a href="#groceries">{t("Groceries", "বাজার")}</a>
        <button type="button" onClick={() => setBangla(!bn)}>{bn ? "English" : "বাংলা"}</button>
      </nav>
    </div></header>
    <main className="wrap">
      <section className="hero">
        <div><p className="kicker">{t("DHAKA · SERVICE PREVIEW", "ঢাকা · সেবার প্রিভিউ")}</p>
          <h1>{t("Send a parcel. Shop for home.", "পার্সেল পাঠান। ঘরের বাজার করুন।")}</h1>
          <p>{t("Get an estimate for a delivery across Dhaka, or explore fresh groceries and everyday essentials.", "ঢাকার মধ্যে পার্সেল পাঠানোর আনুমানিক খরচ দেখুন অথবা তাজা ও নিত্যপ্রয়োজনীয় পণ্য খুঁজুন।")}</p>
          <div className="actions"><a className="primary" href="#parcel">{t("Get a parcel quote", "পার্সেলের খরচ দেখুন")}</a><a className="secondary" href="#groceries">{t("Browse groceries", "বাজার দেখুন")}</a></div>
        </div>
        <div className="hero-image" aria-hidden="true" />
      </section>
      <section id="parcel" className="service"><h2>{t("Parcel delivery", "পার্সেল ডেলিভারি")}</h2><ParcelQuote bn={bn}/></section>
      <section id="groceries" className="service"><h2>{t("TRIPPY Groceries", "ট্রিপি বাজার")}</h2><GroceryCatalog bn={bn}/></section>
    </main>
    <footer className="site-footer"><div className="wrap"><strong>TRIPPY Delivery</strong><p>{t("Preview · Customer orders and payments are disabled.", "প্রিভিউ · গ্রাহকের অর্ডার ও পেমেন্ট বন্ধ আছে।")}</p></div></footer>
  </div>;
}
