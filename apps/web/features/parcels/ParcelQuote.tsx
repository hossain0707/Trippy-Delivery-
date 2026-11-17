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
  const [senderLat, setSenderLat] = useState("23.82");
  const [senderLng, setSenderLng] = useState("90.365");
  const [recipientLat, setRecipientLat] = useState("23.745");
  const [recipientLng, setRecipientLng] = useState("90.375");
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
          city: "Dhaka", latitude: Number(senderLat), longitude: Number(senderLng),
        },
        recipient: {
          name: "Demo Recipient", phone: "01800000000", address_line: "Dhanmondi, Dhaka",
          city: "Dhaka", latitude: Number(recipientLat), longitude: Number(recipientLng),
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
      <label>Pickup latitude<input type="number" step="0.0001" value={senderLat} onChange={e => setSenderLat(e.target.value)} /></label>
      <label>Pickup longitude<input type="number" step="0.0001" value={senderLng} onChange={e => setSenderLng(e.target.value)} /></label>
      <label>Delivery latitude<input type="number" step="0.0001" value={recipientLat} onChange={e => setRecipientLat(e.target.value)} /></label>
      <label>Delivery longitude<input type="number" step="0.0001" value={recipientLng} onChange={e => setRecipientLng(e.target.value)} /></label>
      <label>Parcel type<select value={category} onChange={e => setCategory(e.target.value)}>
        <option value="general">General parcel</option>
        <option value="document">Documents</option>
        <option value="fragile">Fragile</option>
      </select></label>
    </div>
    <div className="demo-note">Sample Dhaka coordinates can be edited to explore estimates. Address autocomplete, verified road routing, traffic and partner availability remain future integrations.</div>
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
