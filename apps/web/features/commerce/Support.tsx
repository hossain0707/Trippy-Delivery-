"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { commerceApi, type Configuration } from "@/lib/commerce";
export function Support() {
  const [c, setC] = useState<Configuration | null>(null);
  const [bn, setBn] = useState(false);
  useEffect(() => {
    commerceApi<Configuration>("/commerce/configuration")
      .then(setC)
      .catch(() => {});
  }, []);
  return (
    <main className="wrap commerce-page">
      <nav className="market-nav">
        <Link className="wordmark" href="/">
          TRIPPY Delivery
        </Link>
        <Link href="/account">{bn ? "আমার অ্যাকাউন্ট" : "My account"}</Link>
        <button onClick={() => setBn(!bn)}>{bn ? "English" : "বাংলা"}</button>
      </nav>
      <p className="kicker">TRIPPY CARE</p>
      <h1>
        {bn
          ? "আপনার পাশে, প্রতিটি ধাপে।"
          : "A little help, whenever you need it."}
      </h1>
      <div className="cards">
        <section className="panel">
          <h2>{bn ? "অর্ডার ও পেমেন্ট" : "Orders & payments"}</h2>
          <p>
            {bn
              ? "সাহায্যের জন্য অর্ডার নম্বর ও সমস্যার বিবরণ রাখুন। পিন বা ওটিপি কখনো শেয়ার করবেন না।"
              : "Keep your order number and issue details ready. Never share your PIN or OTP."}
          </p>
          {c?.pilot.contact_phone ? (
            <a href={"tel:" + c.pilot.contact_phone}>{c.pilot.contact_phone}</a>
          ) : (
            <p>
              {bn
                ? "সহায়তার ফোন নম্বর প্রকাশের অপেক্ষায়।"
                : "A verified support phone will be published before launch."}
            </p>
          )}
          {c?.pilot.support_email && (
            <a href={"mailto:" + c.pilot.support_email}>
              {c.pilot.support_email}
            </a>
          )}
        </section>
        <section className="panel">
          <h2>{bn ? "ডেলিভারির সময়" : "Delivery windows"}</h2>
          <p>
            {bn
              ? "দুপুর ১টার আগে: একই দিন রাত ৯টার মধ্যে। দুপুর ১টা থেকে রাত ৯টা: পরদিন সকাল ৯টার মধ্যে। রাত ৯টার পরে: পরদিন রাত ৯টার মধ্যে।"
              : "Before 1 PM: same day before 9 PM. From 1 PM until 9 PM: next day before 9 AM. After 9 PM: next day before 9 PM."}
          </p>
          <p>
            {bn
              ? "এলাকা, প্রস্তুতির সক্ষমতা ও কুরিয়ার নিশ্চিত হলে সময় দেওয়া হবে।"
              : "Windows are offered only when coverage, preparation capacity and courier availability are confirmed."}
          </p>
        </section>
        <section className="panel">
          <h2>{bn ? "ম্যানুয়াল পেমেন্ট" : "Manual payments"}</h2>
          <p>
            {bn
              ? "প্রাপ্তি যাচাই না হওয়া পর্যন্ত পেমেন্ট অপেক্ষমাণ। প্রদর্শনী নম্বরে টাকা পাঠাবেন না।"
              : "Transfers remain pending until receipt is verified. Never send money to demonstration numbers."}
          </p>
          <Link href="/courier">
            {bn ? "ডেলিভারি পার্টনার হতে চান?" : "Become a delivery partner"}
          </Link>
        </section>
      </div>
    </main>
  );
}
