"use client";
import { useState } from "react";
import { apiPost } from "@/lib/api";

type Quote = {
  amount: number;
  currency: string;
  distance_km: number;
  billable_weight_kg: number;
  provisional: boolean;
  disclaimer: string;
};

export function ParcelQuote() {
  const [weight, setWeight] = useState("1");
  const [length, setLength] = useState("25");
  const [width, setWidth] = useState("20");
  const [height, setHeight] = useState("10");
  const [category, setCategory] = useState("general");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function estimate() {
    setPending(true);
    setQuote(null);
    setError("");
    try {
      const payload = {
        sender: {
          name: "Demo Sender", phone: "01700000000", address_line: "Mirpur 10, Dhaka",
          city: "Dhaka", latitude: 23.82, longitude: 90.365,
        },
        recipient: {
          name: "Demo Recipient", phone: "01800000000", address_line: "Dhanmondi, Dhaka",
          city: "Dhaka", latitude: 23.745, longitude: 90.375,
        },
        package: {
          category, weight_kg: Number(weight), length_cm: Number(length),
          width_cm: Number(width), height_cm: Number(height),
        },
      };
      setQuote(await apiPost<Quote>("/api/v1/parcels/quote", payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to estimate");
    } finally {
      setPending(false);
    }
  }

  return <section className="feature-card">
    <div className="section-eyebrow">PARCEL DELIVERY</div>
    <h2>Send anything that matters.</h2>
    <p>Independent approved couriers, secure handovers, and a delivery network designed to grow beyond Dhaka.</p>
    <div className="quote-form">
      <label>Weight (kg)<input min="0.01" step="0.1" type="number" value={weight} onChange={e => setWeight(e.target.value)} /></label>
      <label>Length (cm)<input min="1" type="number" value={length} onChange={e => setLength(e.target.value)} /></label>
      <label>Width (cm)<input min="1" type="number" value={width} onChange={e => setWidth(e.target.value)} /></label>
      <label>Height (cm)<input min="1" type="number" value={height} onChange={e => setHeight(e.target.value)} /></label>
      <label>Parcel type<select value={category} onChange={e => setCategory(e.target.value)}>
        <option value="general">General parcel</option>
        <option value="document">Documents</option>
        <option value="fragile">Fragile</option>
      </select></label>
    </div>
    <div className="demo-note">Sample route: Mirpur 10 → Dhanmondi, Dhaka. Live addresses and traffic integration are pending.</div>
    <button className="primary-button" type="button" onClick={estimate} disabled={pending}>
      {pending ? "Calculating…" : "Estimate parcel charge"}
    </button>
    {error && <p className="error" role="alert">{error}</p>}
    {quote && <div className="quote-result" role="status">
      <div><span>Estimated charge</span><strong>৳{quote.amount}</strong></div>
      <div><span>Estimated road distance</span><strong>{quote.distance_km} km</strong></div>
      <div><span>Chargeable weight</span><strong>{quote.billable_weight_kg} kg</strong></div>
      <small>{quote.disclaimer}</small>
    </div>}
  </section>;
}
