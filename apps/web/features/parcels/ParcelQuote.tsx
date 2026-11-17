"use client";
import { useState, type FormEvent } from "react";
import { apiPost } from "@/lib/api";

import { AddressField, type ParcelLocation } from "./AddressField";
import { ParcelPreview, type Dimensions, type PackageForm } from "./ParcelPreview";

const presets: Record<PackageForm, Dimensions> = {
  box: { length: "25", width: "20", height: "10" },
  envelope: { length: "25", width: "18", height: "1" },
};
type Quote = { amount: number; distance_km: number; billable_weight_kg: number };

export function ParcelQuote({ bn = false }: { bn?: boolean }) {
  const [pickup, setPickup] = useState<ParcelLocation>();
  const [destination, setDestination] = useState<ParcelLocation>();
  const [packageForm, setPackageForm] = useState<PackageForm>("box");
  const [dimensions, setDimensions] = useState<Dimensions>(presets.box);
  const [quote, setQuote] = useState<Quote>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const t = (en: string, bangla: string) => bn ? bangla : en;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!pickup || !destination) return;
    const location = (place: ParcelLocation) => ({
      name: "Preview", phone: "01700000000", address_line: place.label.slice(0, 300),
      city: "Dhaka", latitude: place.latitude, longitude: place.longitude,
    });
    setQuote(undefined);
    setPending(true);
    setError(false);
    try {
      setQuote(await apiPost<Quote>("/api/v1/parcels/quote", {
        sender: location(pickup), recipient: location(destination),
        package: { category: data.get("category"), weight_kg: Number(data.get("weight")),
          length_cm: Number(data.get("length")), width_cm: Number(data.get("width")), height_cm: Number(data.get("height")) },
      }));
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return <div className="split parcel-layout">
    <form className="panel" onSubmit={submit} onChange={() => { setQuote(undefined); setError(false); }}>
      <fieldset disabled={pending}><legend>{t("Your delivery details", "ডেলিভারির বিবরণ")}</legend>
        <AddressField label={t("Pickup address", "পিকআপ ঠিকানা")} bn={bn} value={pickup} onChange={next => { setPickup(next); setQuote(undefined); setError(false); }} />
        <AddressField label={t("Delivery address", "গন্তব্য ঠিকানা")} bn={bn} value={destination} onChange={next => { setDestination(next); setQuote(undefined); setError(false); }} />
        <p className="parcel-attribution">{t("Search is provided by Photon using OpenStreetMap. Check the selected pin before requesting an estimate.", "Photon ও OpenStreetMap থেকে ঠিকানা খোঁজা হয়। খরচ দেখার আগে পিন যাচাই করুন।")} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></p>
        <fieldset><legend>{t("Package form", "প্যাকেটের ধরন")}</legend>
          <div className="parcel-package">{(["envelope", "box"] as const).map(form => <label key={form}>
            <input type="radio" name="form" value={form} checked={packageForm === form} onChange={() => {
              setPackageForm(form); setDimensions(presets[form]);
            }} />{form === "box" ? t("Box", "বাক্স") : t("Envelope", "খাম")}
          </label>)}</div>
        </fieldset>
        <div className="fields">
          <label>{t("Parcel type", "পার্সেলের ধরন")}<select name="category"><option value="general">{t("General", "সাধারণ")}</option><option value="document">{t("Document", "কাগজপত্র")}</option><option value="fragile">{t("Fragile", "ভঙ্গুর")}</option></select></label>
          <label>{t("Weight (kg)", "ওজন (কেজি)")}<input name="weight" type="number" min=".01" max="30" step=".01" defaultValue="1" required /></label>
          {([["length", t("Length", "দৈর্ঘ্য"), 25], ["width", t("Width", "প্রস্থ"), 20], ["height", t("Height", "উচ্চতা"), 10]] as const).map(([key, label]) =>
            <label key={key}>{label} ({t("cm", "সেমি")})<input name={key} type="number" min=".01" max="150" step=".01" value={dimensions[key]} onChange={e => { const value = e.currentTarget.value; setDimensions(previous => ({ ...previous, [key]: value })); }} required /></label>)}
        </div>
        <button className="primary" type="submit" disabled={!pickup || !destination || pending}>{pending ? t("Calculating…", "হিসাব হচ্ছে…") : t("Get estimate", "আনুমানিক খরচ দেখুন")}</button>
      </fieldset>
    </form>
    <div className="parcel-side"><ParcelPreview dimensions={dimensions} form={packageForm} bn={bn} />
    <aside className="panel summary" aria-live="polite"><h3>{t("Delivery estimate", "আনুমানিক ডেলিভারি খরচ")}</h3>
      {error && <p role="alert">{t("We couldn’t calculate your estimate. Please try again.", "খরচ হিসাব করা যায়নি। আবার চেষ্টা করুন।")}</p>}
      {quote && <><strong className="amount">৳{quote.amount.toLocaleString(bn ? "bn-BD" : "en-BD")}</strong><p>{t("Estimated distance", "আনুমানিক দূরত্ব")} · {quote.distance_km} {t("km", "কিমি")}</p><p>{t("Billable weight", "চার্জযোগ্য ওজন")} · {quote.billable_weight_kg} {t("kg", "কেজি")}</p></>}
      <p>{t("Estimates use your selected map pins and approximate road distance. Booking is disabled in this preview.", "খরচের হিসাব নির্বাচিত ম্যাপ পিন ও আনুমানিক সড়ক দূরত্বের ওপর ভিত্তি করে। এই প্রিভিউতে বুকিং বন্ধ।")}</p>
    </aside></div>
  </div>;
}
