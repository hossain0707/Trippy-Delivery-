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
type Profile = CustomerProfile;
type RecordItem = {
  id: string;
  status: string;
  amount_bdt: string;
  tracking_code?: string;
};
function Records() {
  const token = useCredential();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<{
    orders: RecordItem[];
    parcels: RecordItem[];
  }>({ orders: [], parcels: [] });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [tracking, setTracking] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    authApi<Profile>(token, "/account/profile")
      .then((p) => {
        if (active)
          setProfile({
            ...p,
            name: p.name || "",
            checkout_defaults: {
              ...emptyCheckoutDefaults,
              ...p.checkout_defaults,
            },
          });
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    authApi<typeof history>(token, "/account/history")
      .then((h) => {
        if (active) setHistory(h);
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    return () => {
      active = false;
    };
  }, [token]);
  const bn = profile?.language === "bn";
  return (
    <div className="account-grid">
      <section className="panel">
        <h2>{bn ? "আমার প্রোফাইল" : "My profile"}</h2>
        {profile && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (saving) return;
              setSaving(true);
              try {
                setProfile(
                  await authApi<Profile>(
                    token,
                    "/account/profile",
                    "PUT",
                    editableProfile(profile),
                  ),
                );
                window.dispatchEvent(new Event("trippy-profile-saved"));
                setStatus(bn ? "সংরক্ষিত" : "Profile saved");
              } catch (e) {
                setStatus((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <fieldset disabled={saving} className="profile-form-fields">
              <label>
                {bn ? "নাম" : "Name"}
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
                {bn ? "ফোন" : "Phone"}
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
              <SavedCheckoutFields
                bn={bn}
                value={{
                  ...emptyCheckoutDefaults,
                  ...profile.checkout_defaults,
                }}
                onChange={(checkout_defaults) =>
                  setProfile({ ...profile, checkout_defaults })
                }
              />
              <button className="primary">
                {saving
                  ? bn
                    ? "সংরক্ষণ হচ্ছে…"
                    : "Saving…"
                  : bn
                    ? "সংরক্ষণ"
                    : "Save profile"}
              </button>
            </fieldset>
          </form>
        )}
        <p role="status">{status}</p>
      </section>
      <section className="panel">
        <h2>{bn ? "অর্ডারের ইতিহাস" : "Order history"}</h2>
        {!history.orders.length && (
          <p>{bn ? "কোনো অর্ডার নেই" : "No orders yet."}</p>
        )}
        {history.orders.map((o) => (
          <p key={o.id}>
            <Link href={"/orders?id=" + o.id}>{o.id}</Link> · {o.status} · ৳
            {o.amount_bdt}
          </p>
        ))}
        <h2>{bn ? "পার্সেল ট্র্যাকিং" : "Parcel tracking"}</h2>
        {history.parcels.map((p) => (
          <button key={p.id} onClick={() => setTracking(p.tracking_code || "")}>
            {p.tracking_code} · {p.status}
          </button>
        ))}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
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
            Tracking code
            <input
              required
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
            />
          </label>
          <button className="primary">{bn ? "খুঁজুন" : "Track parcel"}</button>
        </form>
        <ol>
          {events.map((event, i) => (
            <li key={i}>{event}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
export function CustomerAccount() {
  return (
    <main className="wrap service account">
      <Link className="wordmark" href="/">
        TRIPPY Delivery
      </Link>
      <h1>My TRIPPY</h1>
      <p>
        Save your details once for future checkouts. Preview only: payments and
        real fulfillment are disabled.
      </p>
      <GoogleAccess>
        <Records />
      </GoogleAccess>
    </main>
  );
}
