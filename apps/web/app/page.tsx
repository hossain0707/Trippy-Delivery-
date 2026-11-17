"use client";
import { useState } from "react";
import { Brand } from "@/components/Brand";
import { ParcelQuote } from "@/features/parcels/ParcelQuote";
import { GroceryCatalog } from "@/features/groceries/GroceryCatalog";

export default function Home() {
  const [service, setService] = useState<"parcel" | "grocery">("parcel");
  return <main>
    <header className="site-header shell">
      <Brand />
      <nav aria-label="Main navigation"><a href="#services">Services</a><a href="#how">How it works</a>
      </nav>
    </header>
    <div className="hero shell">
      <div className="hero-copy">
        <span className="pill">DHAKA FIRST · NATIONWIDE BY DESIGN</span>
        <h1>From a parcel to your <em>weekly groceries.</em> One TRIPPY.</h1>
        <p>Reliable parcel logistics and fresh & dry grocery shopping, built for how Bangladesh lives and moves.</p>
        <div className="hero-points"><span>✓ Bangla-first catalog</span><span>✓ Verified delivery partners planned</span><span>✓ Transparent tracking foundation</span></div>
        <a className="primary-button hero-cta" href="#services">Explore the platform ↗</a>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="hero-cube">📦</div>
        <div className="floating-card fc-one">🥬 Fresh & prepared</div>
        <div className="floating-card fc-two">🚚 Parcel tracking</div>
        <div className="floating-card fc-three">🛒 Dry groceries</div>
      </div>
    </div>
    <section className="services shell" id="services">
      <div className="section-heading"><span className="section-eyebrow">TWO SERVICES. ONE PLATFORM.</span>
        <h2>Choose how TRIPPY helps today.</h2></div>
      <div className="service-tabs" role="tablist" aria-label="Delivery service">
        <button type="button" role="tab" aria-selected={service === "parcel"}
          className={service === "parcel" ? "service-tab selected" : "service-tab"}
          onClick={() => setService("parcel")}>📦 Parcel delivery</button>
        <button type="button" role="tab" aria-selected={service === "grocery"}
          className={service === "grocery" ? "service-tab selected" : "service-tab"}
          onClick={() => setService("grocery")}>🥦 TRIPPY groceries</button>
      </div>
      {service === "parcel" ? <ParcelQuote /> : <GroceryCatalog />}
    </section>
    <section className="timeline shell" id="how">
      <div className="section-heading"><span className="section-eyebrow">BUILT AROUND YOUR DAY</span><h2>Two different delivery promises.</h2></div>
      <div className="timeline-grid">
        <article><div className="timeline-icon">📦</div><h3>Parcels</h3><p>Same-city target: within 24 hours. Intercity expansion: 3–5 days on active routes.</p></article>
        <article><div className="timeline-icon">☀️</div><h3>Groceries before 1 PM</h3><p>Proposed same-day delivery window: before 9 PM, subject to capacity.</p></article>
        <article><div className="timeline-icon">🌙</div><h3>1 PM to 9 PM</h3><p>Proposed next-day delivery by 9 AM. Orders from 9 PM: next day by 9 PM.</p></article>
      </div>
      <p className="muted" style={{marginTop: 18}}>These are planning targets. Live service coverage and slot guarantees are not yet enabled.</p>
    </section>
    <footer className="site-footer"><div className="shell"><Brand /><p>TRIPPY Delivery · Parcel-first logistics and first-party groceries · Dhaka launch plan</p><small>Development preview — not accepting real customer orders.</small></div></footer>
  </main>;
}
