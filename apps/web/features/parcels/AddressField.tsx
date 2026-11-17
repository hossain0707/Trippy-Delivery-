"use client";
import { useId, useState } from "react";

export type ParcelLocation = { label: string; latitude: number; longitude: number };
type Feature = { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> };

// This quote preview currently serves the Dhaka area.
const bounds = [90.30, 23.66, 90.49, 23.91] as const;
const inDhaka = (lat: number, lon: number) => Number.isFinite(lat) && Number.isFinite(lon) &&
  lon >= bounds[0] && lat >= bounds[1] && lon <= bounds[2] && lat <= bounds[3];

export function AddressField({ label, value, onChange, bn }: {
  label: string; value?: ParcelLocation; onChange: (next?: ParcelLocation) => void; bn: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParcelLocation[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [pinError, setPinError] = useState(false);
  const t = (en: string, bangla: string) => bn ? bangla : en;
  async function search() {
    if (query.trim().length < 3 || state === "loading") return;
    onChange(undefined);
    setResults([]);
    setState("loading");
    const params = new URLSearchParams({ q: query.trim(), bbox: bounds.join(","), limit: "6", lat: "23.78", lon: "90.40" });
    try {
      const response = await fetch("https://photon.komoot.io/api/?" + params, { signal: AbortSignal.timeout(8500) });
      if (!response.ok) throw new Error("Address search unavailable");
      const data: { features: Feature[] } = await response.json();
      const locations = data.features.flatMap(({ geometry, properties }) => {
        const [lon, lat] = geometry.coordinates;
        if (!inDhaka(lat, lon)) return [];
        const street = [properties.street, properties.housenumber].filter(Boolean).join(" ");
        const parts = Array.from(new Set([properties.name, street, properties.district, properties.city, properties.postcode].filter(Boolean)));
        return parts.length ? [{ label: parts.join(", "), latitude: lat, longitude: lon }] : [];
      });
      setResults(locations.filter((item, index) => locations.findIndex(other =>
        other.latitude === item.latitude && other.longitude === item.longitude) === index));
      setState("done");
    } catch {
      setState("error");
    }
  }
  return <fieldset className="parcel-address"><legend><label htmlFor={id}>{label}</label></legend>
    <div className="parcel-address-search">
      <input id={id} type="search" value={query} maxLength={160} disabled={state === "loading"}
        placeholder={t("Search road, building, or landmark", "রাস্তা, ভবন বা পরিচিত স্থান খুঁজুন")}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
        onChange={e => { setQuery(e.target.value); onChange(undefined); setResults([]); setState("idle"); }} />
      <button type="button" className="secondary" disabled={query.trim().length < 3 || state === "loading"} onClick={search}>
        {state === "loading" ? t("Searching…", "খোঁজা হচ্ছে…") : t("Search", "খুঁজুন")}
      </button>
    </div>
    <div role="status">
      {state === "error" && <p>{t("Address search is unavailable. Try again or enter a map pin.", "ঠিকানা খোঁজা যাচ্ছে না। আবার চেষ্টা করুন বা ম্যাপ পিন দিন।")}</p>}
      {state === "done" && !results.length && !value && <p>{t("No matching Dhaka address. Try a nearby landmark or your map pin.", "ঢাকায় ঠিকানা মেলেনি। কাছের পরিচিত স্থান বা ম্যাপ পিন দিন।")}</p>}
      {value && <p className="parcel-address-confirm"><strong>{value.label}</strong>{" · "}
        <a href={"https://www.openstreetmap.org/?mlat=" + value.latitude + "&mlon=" + value.longitude + "#map=18/" + value.latitude + "/" + value.longitude}
          target="_blank" rel="noreferrer">{t("Check map pin", "ম্যাপ পিন দেখুন")} ↗</a></p>}
    </div>
    {results.length > 0 && <ul className="parcel-address-results">{results.map(result =>
      <li key={result.latitude + "," + result.longitude}><button type="button" onClick={() => {
        onChange(result); setResults([]);
      }}>{result.label}</button></li>)}</ul>}
    <details><summary>{t("Enter a map pin manually", "নিজে ম্যাপ পিন দিন")}</summary>
      <div className="fields">
        <label>{t("Latitude", "অক্ষাংশ")}<input inputMode="decimal" value={latitude} onChange={e => { setLatitude(e.target.value); setPinError(false); onChange(undefined); }} /></label>
        <label>{t("Longitude", "দ্রাঘিমাংশ")}<input inputMode="decimal" value={longitude} onChange={e => { setLongitude(e.target.value); setPinError(false); onChange(undefined); }} /></label>
      </div>
      <button type="button" className="secondary" onClick={() => {
        const lat = Number(latitude), lon = Number(longitude);
        if (!inDhaka(lat, lon)) { setPinError(true); return; }
        onChange({ latitude: lat, longitude: lon, label: query.trim().length >= 5 ? query.trim() : "Dhaka map pin " + lat + ", " + lon });
        setResults([]); setState("idle");
      }}>{t("Use this pin", "এই পিন ব্যবহার করুন")}</button>
      {pinError && <p role="alert">{t("Enter a valid pin within the Dhaka preview area.", "ঢাকার প্রিভিউ এলাকার সঠিক পিন দিন।")}</p>}
    </details>
  </fieldset>;
}
