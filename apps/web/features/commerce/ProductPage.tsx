"use client";
import { useState } from "react";
import Link from "next/link";
import { Market } from "./Market";
export function ProductPage() {
  const [bn, setBn] = useState(false);
  return (
    <main className="wrap commerce-page">
      <nav className="market-nav">
        <Link className="wordmark" href="/">
          TRIPPY Delivery
        </Link>
        <Link href="/groceries">
          {bn ? "বাজারে ফিরুন" : "Back to the market"}
        </Link>
        <Link href="/cart">{bn ? "ঝুড়ি" : "Basket"}</Link>
        <button onClick={() => setBn(!bn)}>{bn ? "English" : "বাংলা"}</button>
      </nav>
      <Market bn={bn} detail />
    </main>
  );
}
