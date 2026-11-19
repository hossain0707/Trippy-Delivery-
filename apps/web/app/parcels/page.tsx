"use client";
import Link from "next/link";
import { useState } from "react";
import { ParcelQuote } from "@/features/parcels/ParcelQuote";

export default function Page() {
  const [bn, setBangla] = useState(false);
  return <div lang={bn ? "bn" : "en"}>
    <header className="site-header"><div className="wrap bar"><Link href="/" className="wordmark">TRIPPY Delivery</Link><nav>
      <Link href="/groceries">{bn ? "বাজার" : "Groceries"}</Link><button type="button" onClick={() => setBangla(!bn)}>{bn ? "English" : "বাংলা"}</button>
    </nav></div></header>
    <main className="wrap service"><p className="kicker">{bn ? "ঢাকা · প্রিভিউ" : "DHAKA · PREVIEW"}</p>
      <h1>{bn ? "পার্সেল পাঠান" : "Send a parcel"}</h1><p>{bn ? "ঢাকার মধ্যে ডেলিভারির আনুমানিক খরচ দেখুন।" : "Get a delivery estimate in Dhaka."}</p><ParcelQuote bn={bn}/></main>
  </div>;
}
