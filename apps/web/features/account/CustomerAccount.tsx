"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GoogleAccess, useCredential } from "./GoogleAccess";
import {
  editableProfile,
  emptyCheckoutDefaults,
  type CustomerProfile,
} from "@/lib/profile.mjs";
import { SavedCheckoutFields } from "./SavedCheckoutFields";
import { authApi } from "@/lib/auth-api";
import { OrderList } from "./OrderViews";
function AccountWorkspace() {
  const token = useCredential();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [section, setSection] = useState("overview");
  const [override, setOverride] = useState<boolean | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const [tracking, setTracking] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [parcels, setParcels] = useState<
    { id: string; tracking_code: string; status: string }[]
  >([]);
  const bn = override ?? profile?.language === "bn";
  const t = (en: string, b: string) => (bn ? b : en);
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("section");
    if (
      tab &&
      ["orders", "profile", "addresses", "preferences", "parcels"].includes(tab)
    )
      setSection(tab);
  }, []);
  useEffect(() => {
    let active = true;
    authApi<CustomerProfile>(token, "/account/profile")
      .then((p) => {
        if (active) {
          setProfile({
            ...p,
            name: p.name || "",
            phone: p.phone || "",
            checkout_defaults: {
              ...emptyCheckoutDefaults,
              ...p.checkout_defaults,
            },
          });
          setStatus("");
        }
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    authApi<{ parcels: typeof parcels }>(token, "/account/history")
      .then((h) => {
        if (active) setParcels(h.parcels);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token, retry]);
  const defaults = { ...emptyCheckoutDefaults, ...profile?.checkout_defaults };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    setStatus("");
    try {
      const p = await authApi<CustomerProfile>(
        token,
        "/account/profile",
        "PUT",
        editableProfile(profile),
      );
      setProfile({
        ...p,
        checkout_defaults: { ...emptyCheckoutDefaults, ...p.checkout_defaults },
      });
      window.dispatchEvent(new Event("trippy-profile-saved"));
      setStatus(
        t(
          "Saved. These details will fill automatically at checkout.",
          "সংরক্ষিত। অর্ডারে এই তথ্য স্বয়ংক্রিয়ভাবে পূরণ হবে।",
        ),
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="co-workspace">
      <aside className="co-side">
        <div className="co-avatar">
          {(profile?.name || "T").slice(0, 1).toUpperCase()}
        </div>
        <strong>{profile?.name || t("My account", "আমার অ্যাকাউন্ট")}</strong>
        <nav aria-label={t("Account sections", "অ্যাকাউন্ট বিভাগ")}>
          {[
            ["overview", "Overview", "ওভারভিউ"],
            ["orders", "My orders", "আমার অর্ডার"],
            ["profile", "Profile details", "প্রোফাইল"],
            ["addresses", "Saved address", "সংরক্ষিত ঠিকানা"],
            ["preferences", "Preferences", "পছন্দ"],
            ["parcels", "Parcel tracking", "পার্সেল ট্র্যাকিং"],
          ].map(([id, en, b]) => (
            <button
              key={id}
              aria-current={section === id ? "page" : undefined}
              onClick={() => setSection(id)}
            >
              {t(en, b)}
            </button>
          ))}
        </nav>
        <Link href="/groceries">{t("Continue shopping ↗", "বাজার করুন ↗")}</Link>
      </aside>
      <div className="co-main">
        <header className="co-heading">
          <div>
            <p className="kicker">TRIPPY DELIVERY</p>
            <h1>
              {section === "orders"
                ? t("My orders", "আমার অর্ডার")
                : t("My account", "আমার অ্যাকাউন্ট")}
            </h1>
          </div>
          <button className="secondary" onClick={() => setOverride(!bn)}>
            {bn ? "English" : "বাংলা"}
          </button>
        </header>
        <p role="status" className={status ? "co-notice" : ""}>
          {status}
        </p>
        {!profile && (
          <section className="co-card">
            <p>{t("Loading saved profile…", "সংরক্ষিত প্রোফাইল লোড হচ্ছে…")}</p>
            <button
              className="secondary"
              onClick={() => setRetry((r) => r + 1)}
            >
              {t("Retry profile", "প্রোফাইল আবার লোড করুন")}
            </button>
          </section>
        )}
        {section === "overview" && (
          <>
            <section className="co-welcome">
              <div>
                <h2>
                  {t("Hello, ", "স্বাগতম, ")}
                  {profile?.name || t("welcome", "গ্রাহক")}
                </h2>
                <p>
                  {t(
                    "Your details, orders and deliveries—all in one place.",
                    "আপনার তথ্য, অর্ডার ও ডেলিভারি—সব এক জায়গায়।",
                  )}
                </p>
              </div>
              <button
                className="secondary"
                onClick={() => setSection("profile")}
              >
                {t("Edit profile", "প্রোফাইল সম্পাদনা")}
              </button>
            </section>
            <div className="co-grid">
              <section className="co-card">
                <div className="co-card-heading">
                  <h2>{t("Profile details", "প্রোফাইলের তথ্য")}</h2>
                  <button
                    className="text-button"
                    onClick={() => setSection("profile")}
                  >
                    {t("Edit", "সম্পাদনা")}
                  </button>
                </div>
                <p>
                  <strong>{profile?.name}</strong>
                  <br />
                  {profile?.email}
                  <br />
                  {profile?.phone ||
                    t("Add your phone number", "ফোন নম্বর যোগ করুন")}
                </p>
              </section>
              <section className="co-card">
                <div className="co-card-heading">
                  <h2>
                    {t("Default delivery address", "ডিফল্ট ডেলিভারি ঠিকানা")}
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setSection("addresses")}
                  >
                    {t("Edit address", "ঠিকানা সম্পাদনা")}
                  </button>
                </div>
                <p>
                  {defaults.address_line ||
                    t(
                      "No delivery address saved yet.",
                      "এখনো ডেলিভারি ঠিকানা সংরক্ষিত নেই।",
                    )}
                  <br />
                  {[defaults.area, defaults.city, defaults.postal_code]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </section>
              <section className="co-card">
                <div className="co-card-heading">
                  <h2>
                    {t(
                      "Delivery & preparation preferences",
                      "ডেলিভারি ও প্রস্তুতির পছন্দ",
                    )}
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setSection("preferences")}
                  >
                    {t("Edit", "সম্পাদনা")}
                  </button>
                </div>
                <p>
                  {defaults.instructions ||
                    t(
                      "No delivery instructions saved.",
                      "ডেলিভারির নির্দেশনা সংরক্ষিত নেই।",
                    )}
                </p>
                <p>
                  {defaults.preparation_notes ||
                    t(
                      "No preparation notes saved.",
                      "প্রস্তুতির নির্দেশনা সংরক্ষিত নেই।",
                    )}
                </p>
                <strong>
                  {t("Checkout: cash on delivery", "অর্ডার: ক্যাশ অন ডেলিভারি")}
                </strong>
              </section>
              <OrderList token={token} bn={bn} compact />
            </div>
            <section className="co-notice">
              <strong>
                {t(
                  "Saved details fill automatically at checkout.",
                  "সংরক্ষিত তথ্য অর্ডারে স্বয়ংক্রিয়ভাবে পূরণ হবে।",
                )}
              </strong>
              <p>
                {t(
                  "You can edit them for an individual order without changing your defaults. Online payments remain disabled.",
                  "ডিফল্ট তথ্য না বদলে নির্দিষ্ট অর্ডারের তথ্য সম্পাদনা করতে পারেন। অনলাইন পেমেন্ট বন্ধ।",
                )}
              </p>
            </section>
          </>
        )}
        {section === "orders" && <OrderList token={token} bn={bn} />}
        {["profile", "addresses", "preferences"].includes(section) &&
          profile && (
            <section className="co-card">
              <h2>
                {section === "profile"
                  ? t("Edit profile", "প্রোফাইল সম্পাদনা")
                  : section === "addresses"
                    ? t("Saved address", "সংরক্ষিত ঠিকানা")
                    : t("Saved preferences", "সংরক্ষিত পছন্দ")}
              </h2>
              <form onSubmit={save}>
                <fieldset disabled={saving}>
                  <div className="fields">
                    <label>
                      {t("Name", "নাম")}
                      <input
                        required
                        maxLength={120}
                        value={profile.name || ""}
                        onChange={(e) =>
                          setProfile({ ...profile, name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      {t("Phone", "ফোন")}
                      <input
                        type="tel"
                        maxLength={20}
                        value={profile.phone}
                        onChange={(e) =>
                          setProfile({ ...profile, phone: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      {t("Verified email", "যাচাইকৃত ইমেইল")}
                      <input readOnly value={profile.email || ""} />
                    </label>
                    <label>
                      Language / ভাষা
                      <select
                        value={profile.language}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            language: e.target.value as "en" | "bn",
                          })
                        }
                      >
                        <option value="en">English</option>
                        <option value="bn">বাংলা</option>
                      </select>
                    </label>
                  </div>
                  <SavedCheckoutFields
                    bn={bn}
                    value={defaults}
                    onChange={(checkout_defaults) =>
                      setProfile({ ...profile, checkout_defaults })
                    }
                  />
                  <button className="primary">
                    {saving
                      ? t("Saving…", "সংরক্ষণ হচ্ছে…")
                      : t("Save details & preferences", "তথ্য ও পছন্দ সংরক্ষণ")}
                  </button>
                </fieldset>
              </form>
            </section>
          )}
        {section === "parcels" && (
          <section className="co-card">
            <h2>{t("Parcel tracking", "পার্সেল ট্র্যাকিং")}</h2>
            <div className="co-tabs">
              {parcels.map((p) => (
                <button key={p.id} onClick={() => setTracking(p.tracking_code)}>
                  {p.tracking_code} · {p.status.replaceAll("_", " ")}
                </button>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setStatus("");
                setEvents([]);
                try {
                  const result = await authApi<{ history: string[] }>(
                    token,
                    "/parcels/" + encodeURIComponent(tracking),
                  );
                  setEvents(result.history);
                } catch (e) {
                  setStatus((e as Error).message);
                }
              }}
            >
              <label>
                {t("Tracking code", "ট্র্যাকিং কোড")}
                <input
                  required
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  maxLength={30}
                />
              </label>
              <button className="primary">
                {t("Track parcel", "পার্সেল ট্র্যাক করুন")}
              </button>
            </form>
            <ol className="co-history">
              {events.map((event, i) => (
                <li key={i}>{event}</li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}
export function CustomerAccount() {
  return (
    <main className="co-page">
      <nav className="co-topbar">
        <Link className="wordmark" href="/">
          TRIPPY Delivery
        </Link>
        <div>
          <Link href="/groceries">Shop groceries</Link>
          <Link href="/cart">Basket</Link>
        </div>
      </nav>
      <GoogleAccess>
        <AccountWorkspace />
      </GoogleAccess>
    </main>
  );
}
