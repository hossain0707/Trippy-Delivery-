"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { GoogleAccess, useCredential } from "@/features/account/GoogleAccess";
import { commerceApi, type Configuration } from "@/lib/commerce";
import { ParcelPreview } from "@/features/parcels/ParcelPreview";
type Address = {
  name: string;
  phone: string;
  address_line: string;
  city: string;
  latitude: string;
  longitude: string;
};
const empty: Address = {
  name: "",
  phone: "",
  address_line: "",
  city: "Dhaka",
  latitude: "",
  longitude: "",
};
function BookingButton({ payload, bn }: { payload: unknown; bn: boolean }) {
  const token = useCredential();
  const key = useRef("");
  const [config, setConfig] = useState<Configuration | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    commerceApi<Configuration>("/commerce/configuration")
      .then(setConfig)
      .catch((e) => setStatus(e.message));
  }, []);
  return (
    <>
      <p>
        {bn
          ? "বুকিং জমা দিলে কুরিয়ার ও পিকআপ পর্যালোচনা করা হবে।"
          : "Bookings are reviewed before pickup and courier assignment."}
      </p>
      <button
        className="primary"
        disabled={!config?.ordering_open || busy}
        onClick={async () => {
          setBusy(true);
          if (!key.current) key.current = crypto.randomUUID();
          try {
            const p = await commerceApi<{ tracking_code: string }>(
              "/parcels",
              token,
              "POST",
              payload,
              key.current,
            );
            setStatus("Booking received: " + p.tracking_code);
          } catch (e) {
            setStatus((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {bn ? "পিকআপের অনুরোধ করুন" : "Request pickup"}
      </button>
      <p role="status">
        {status ||
          (!config?.ordering_open
            ? bn
              ? "মালিকের পাইলট অনুমোদনের অপেক্ষায় বুকিং বন্ধ।"
              : "Booking is closed pending owner pilot approval."
            : "")}
      </p>
    </>
  );
}
export function ParcelBooking({ bn = false }: { bn?: boolean }) {
  const [sender, setSender] = useState<Address>(empty);
  const [recipient, setRecipient] = useState<Address>(empty);
  const [weight, setWeight] = useState("1");
  const [dimensions, setDimensions] = useState({
    length: "25",
    width: "20",
    height: "10",
  });
  const [form, setForm] = useState<"box" | "envelope">("box");
  const [customerType, setCustomerType] = useState("individual");
  const [instructions, setInstructions] = useState("");
  const [quote, setQuote] = useState<{
    amount: number;
    distance_km: number;
    billable_weight_kg: number;
  } | null>(null);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const t = (en: string, b: string) => (bn ? b : en);
  const numeric = (a: Address) => ({
    ...a,
    latitude: Number(a.latitude),
    longitude: Number(a.longitude),
  });
  const payload = {
    sender: numeric(sender),
    recipient: numeric(recipient),
    customer_type: customerType,
    pickup_instructions: instructions,
    package: {
      form,
      category: form === "envelope" ? "document" : "general",
      weight_kg: Number(weight),
      length_cm: Number(dimensions.length),
      width_cm: Number(dimensions.width),
      height_cm: Number(dimensions.height),
    },
  };
  return (
    <div className="split parcel-layout">
      <form
        className="panel"
        onChange={() => setQuote(null)}
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          setStatus("");
          try {
            setQuote(await commerceApi("/parcels/quote", "", "POST", payload));
          } catch (e) {
            setStatus((e as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        <h2>{t("From your door to theirs", "আপনার দরজা থেকে প্রাপকের কাছে")}</h2>
        <label>
          {t("Customer type", "গ্রাহকের ধরন")}
          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value)}
          >
            <option value="individual">{t("Individual", "ব্যক্তি")}</option>
            <option value="merchant">{t("Merchant", "ব্যবসায়ী")}</option>
          </select>
        </label>
        {(
          [
            [
              sender,
              setSender,
              t("Pickup contact & address", "পিকআপের যোগাযোগ ও ঠিকানা"),
            ],
            [
              recipient,
              setRecipient,
              t("Recipient & destination", "প্রাপক ও গন্তব্য"),
            ],
          ] as const
        ).map(([address, setAddress, title]) => (
          <fieldset key={title}>
            <legend>{title}</legend>
            <div className="fields">
              {(
                [
                  "name",
                  "phone",
                  "address_line",
                  "city",
                  "latitude",
                  "longitude",
                ] as const
              ).map((k) => (
                <label key={k}>
                  {
                    {
                      name: t("Name", "নাম"),
                      phone: t("Phone", "ফোন"),
                      address_line: t("Full address", "সম্পূর্ণ ঠিকানা"),
                      city: t("City", "শহর"),
                      latitude: t("Map latitude", "ম্যাপের অক্ষাংশ"),
                      longitude: t("Map longitude", "ম্যাপের দ্রাঘিমাংশ"),
                    }[k]
                  }
                  <input
                    required
                    type={
                      k === "latitude" || k === "longitude"
                        ? "number"
                        : k === "phone"
                          ? "tel"
                          : "text"
                    }
                    step="any"
                    min={
                      k === "latitude" ? 20 : k === "longitude" ? 88 : undefined
                    }
                    max={
                      k === "latitude" ? 27 : k === "longitude" ? 93 : undefined
                    }
                    minLength={k === "phone" ? 8 : k === "address_line" ? 5 : 1}
                    maxLength={k === "address_line" ? 300 : 120}
                    value={address[k]}
                    onChange={(e) =>
                      setAddress({ ...address, [k]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <p>
          {t(
            "Use the exact pickup and destination map coordinates. Road distance and traffic are estimates, not live GPS tracking.",
            "সঠিক পিকআপ ও গন্তব্যের ম্যাপ স্থানাঙ্ক দিন। সড়কের দূরত্ব আনুমানিক, লাইভ জিপিএস ট্র্যাকিং নয়।",
          )}
        </p>
        <div className="fields">
          <label>
            {t("Package form", "প্যাকেটের ধরন")}
            <select
              value={form}
              onChange={(e) => setForm(e.target.value as "box" | "envelope")}
            >
              <option value="box">{t("Box", "বাক্স")}</option>
              <option value="envelope">{t("Envelope", "খাম")}</option>
            </select>
          </label>
          <label>
            {t("Weight (kg)", "ওজন (কেজি)")}
            <input
              required
              type="number"
              min=".01"
              max="30"
              step=".01"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
          {(["length", "width", "height"] as const).map((k) => (
            <label key={k}>
              {
                {
                  length: t("Length (cm)", "দৈর্ঘ্য (সেমি)"),
                  width: t("Width (cm)", "প্রস্থ (সেমি)"),
                  height: t("Height (cm)", "উচ্চতা (সেমি)"),
                }[k]
              }
              <input
                required
                type="number"
                min=".01"
                max="150"
                step=".01"
                value={dimensions[k]}
                onChange={(e) =>
                  setDimensions({ ...dimensions, [k]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        <label>
          {t("Pickup instructions", "পিকআপ নির্দেশনা")}
          <textarea
            maxLength={500}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>
        <button className="primary" disabled={pending}>
          {pending
            ? t("Calculating…", "হিসাব হচ্ছে…")
            : t("Get delivery quote", "খরচ দেখুন")}
        </button>
        <p role="status">{status}</p>
      </form>
      <div>
        <ParcelPreview dimensions={dimensions} form={form} bn={bn} />
        <section className="panel">
          <h2>{t("Your delivery estimate", "আপনার আনুমানিক খরচ")}</h2>
          {quote && (
            <>
              <strong className="amount">৳{quote.amount}</strong>
              <p>
                {quote.distance_km} km · {quote.billable_weight_kg} kg
              </p>
              <GoogleAccess>
                <BookingButton
                  key={JSON.stringify(payload)}
                  payload={payload}
                  bn={bn}
                />
              </GoogleAccess>
            </>
          )}
          <p>
            {t(
              "Targets: same-city 24 hours; intercity 3–5 days. Coverage and pickup are confirmed after review.",
              "লক্ষ্য: একই শহরে ২৪ ঘণ্টা; অন্য শহরে ৩–৫ দিন। পর্যালোচনার পরে সেবা ও পিকআপ নিশ্চিত হবে।",
            )}
          </p>
          <Link href="/support">{t("Need help?", "সাহায্য প্রয়োজন?")}</Link>
        </section>
      </div>
    </div>
  );
}
