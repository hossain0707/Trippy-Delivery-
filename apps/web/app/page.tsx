"use client";
import { useEffect, useState } from "react";
import { commerceApi, type Configuration } from "@/lib/commerce";
import Link from "next/link";
import { DeliveryBanner } from "@/components/DeliveryBanner";

export default function Home() {
  const [bn, setBangla] = useState(false);
  const [config,setConfig]=useState<Configuration|null>(null);
  useEffect(()=>{commerceApi<Configuration>("/commerce/configuration").then(setConfig).catch(()=>{});},[]);
  const t = (en: string, bangla: string) => bn ? bangla : en;
  return <div lang={bn ? "bn" : "en"}>
    <header className="site-header"><div className="wrap bar">
      <a href="#" className="wordmark">TRIPPY<span> Delivery</span></a>
      <nav aria-label={t("Main navigation", "প্রধান নেভিগেশন")}>
        <a href="/parcels">{t("Parcels", "পার্সেল")}</a><a href="/groceries">{t("Groceries", "বাজার")}</a>
        <a href="/cart">{t("Basket", "ঝুড়ি")}</a><a href="/account">{t("My account", "আমার অ্যাকাউন্ট")}</a>
        <button type="button" onClick={() => setBangla(!bn)}>{bn ? "English" : "বাংলা"}</button>
      </nav>
    </div></header>
    <main className="wrap">
      {config&&<p className="launch-notice">{bn?config.pilot.banner_bn:config.pilot.banner_en} <Link href="/support">{bn?"সাহায্য":"Support"}</Link></p>}
      <div className="campaign-layout">
        <aside className="service-rail"><img src="/products/rohu.webp" alt="" /><h2>{t("Prepared your way", "আপনার পছন্দমতো প্রস্তুতি")}</h2>
          <p>{t("Choose whole, cleaned, or cut on eligible Fresh items.", "তাজা পণ্যে আস্ত, পরিষ্কার বা কাটা বেছে নিন।")}</p><a href="/groceries">{t("Shop Fresh", "তাজা পণ্য দেখুন")} →</a></aside>
        <DeliveryBanner bn={bn}/>
        <aside className="service-rail"><img src="/delivery-hero.webp" alt="" /><h2>{t("Pack. Quote. Send.", "প্যাক করুন। খরচ দেখুন। পাঠান।")}</h2>
          <p>{t("Measure your packed parcel, then choose pickup and delivery areas.", "প্যাক করা পার্সেল মেপে পিকআপ ও গন্তব্য এলাকা বেছে নিন।")}</p><a href="/parcels">{t("Estimate delivery", "খরচ দেখুন")} →</a></aside>
      </div>
      <div className="service-entry">
        <a href="/parcels"><p className="kicker">{t("PARCEL DELIVERY", "পার্সেল ডেলিভারি")}</p><h2>{t("Send a parcel across Dhaka", "ঢাকার মধ্যে পার্সেল পাঠান")}</h2><span>{t("Get a delivery estimate", "আনুমানিক খরচ দেখুন")} →</span></a>
        <a href="/groceries"><p className="kicker">{t("TRIPPY GROCERIES", "ট্রিপি বাজার")}</p><h2>{t("Fresh market and kitchen essentials", "তাজা বাজার ও রান্নাঘরের প্রয়োজনীয় পণ্য")}</h2><span>{t("Explore the grocery shop", "বাজার দেখুন")} →</span></a>
      </div>
    </main>
    <footer className="site-footer"><div className="wrap"><strong>TRIPPY Delivery</strong><p>{t("Preview · Customer orders and payments are disabled.", "প্রিভিউ · গ্রাহকের অর্ডার ও পেমেন্ট বন্ধ আছে।")}</p></div></footer>
  </div>;
}
