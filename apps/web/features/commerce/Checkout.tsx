"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductImage } from "./ProductImage";
import { API_BASE } from "@/lib/api";
import { productPhoto, preparationOptions } from "@/lib/preparation.mjs";
import { GoogleAccess, useCredential } from "@/features/account/GoogleAccess";
import { paymentPreferences } from "@/features/account/SavedCheckoutFields";
import {
  commerceApi,
  money,
  type Product,
  type BasketLine,
  type Configuration,
} from "@/lib/commerce";
import { readBasket, writeBasket, lineTotal } from "@/lib/basket.mjs";
import {
  applyProfileDefaults,
  checkoutProfilePayload,
  emptyCheckoutForm,
  type CheckoutValues,
  type CustomerProfile,
} from "@/lib/profile.mjs";

type Review = {
  subtotal_bdt: string;
  discount_bdt: string;
  delivery_fee_bdt: string | null;
  total_bdt: string | null;
  item_subtotal_bdt?: string;
  preparation_fee_bdt?: string;
  pending?: string[];
  delivery_deadline: string;
};
const text = (bn: boolean) => (en: string, b: string) => (bn ? b : en);
const needsWeight = (p: Product, l: BasketLine) =>
  p.unit !== "kg" &&
  preparationOptions(p).some(
    (o) => o.id === l.preparation && o.fee_unit === "kg",
  ) &&
  !(Number(l.preparation_weight_kg) > 0);

function QuantityInput({
  value,
  onCommit,
  ...props
}: {
  value: string;
  onCommit: (value: string) => void;
  disabled: boolean;
  "aria-label": string;
  min: string;
  step: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      {...props}
      type="number"
      max="50"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (Number(e.target.value) > 0 && Number(e.target.value) <= 50)
          onCommit(e.target.value);
      }}
      onBlur={() => {
        if (!(Number(draft) > 0 && Number(draft) <= 50)) setDraft(value);
      }}
    />
  );
}

function CheckoutForm({
  lines,
  bn,
  clear,
  onStep,
  onBusy,
  onLanguage,
  subtotal,
  itemSubtotal,
  pendingItems,
  onFix,
}: {
  lines: BasketLine[];
  bn: boolean;
  clear: () => void;
  onStep: (n: number) => void;
  onBusy: (busy: boolean) => void;
  onLanguage: (bn: boolean) => void;
  subtotal: number;
  itemSubtotal: number;
  pendingItems: { sku: string; message: string }[];
  onFix: (sku: string) => void;
}) {
  const token = useCredential();
  const t = text(bn);
  const key = useRef("");
  const dirty = useRef(new Set<string>());
  const signature = useRef("");
  const saveRequest = useRef(0);
  const [configuration, setConfiguration] = useState<Configuration | null>(
    null,
  );
  const [savedCart, setSavedCart] = useState<BasketLine[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [status, setStatus] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [profileReady, setProfileReady] = useState(false);
  const [saveDefaults, setSaveDefaults] = useState(false);
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<{
    id: string;
    order_number: string;
    payment_status: string;
  } | null>(null);
  const [form, setForm] = useState<CheckoutValues>({ ...emptyCheckoutForm });
  const languageChosen = useRef(false);
  const change = (field: keyof CheckoutValues, value: string) => {
    dirty.current.add(field);
    setForm((current) => ({ ...current, [field]: value }));
    setProfileStatus("");
  };
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  useEffect(() => {
    let active = true;
    commerceApi<Configuration>("/commerce/configuration")
      .then((c) => {
        if (active) setConfiguration(c);
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    commerceApi<{ items: BasketLine[] }>("/commerce/cart", token)
      .then((c) => {
        if (active) setSavedCart(c.items);
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    async function loadProfile() {
      try {
        const p = await commerceApi<CustomerProfile>("/account/profile", token);
        if (!active) return;
        setForm((current) =>
          applyProfileDefaults(current, p, [...dirty.current]),
        );
        setProfileReady(true);
        if (!languageChosen.current) {
          onLanguage(p.language === "bn");
          languageChosen.current = true;
        }
      } catch {
        if (active) {
          setProfileReady(false);
          setProfileStatus(
            "Saved details could not be loaded. Retry before saving profile changes.",
          );
        }
      }
    }
    void loadProfile();
    window.addEventListener("focus", loadProfile);
    window.addEventListener("trippy-profile-saved", loadProfile);
    window.addEventListener("trippy-profile-retry", loadProfile);
    return () => {
      active = false;
      window.removeEventListener("focus", loadProfile);
      window.removeEventListener("trippy-profile-saved", loadProfile);
      window.removeEventListener("trippy-profile-retry", loadProfile);
    };
  }, [token, onLanguage]);
  const payload = {
    destination: {
      name: form.name,
      phone: form.phone,
      address_line: form.address_line,
      area: form.area,
      city: form.city,
      postal_code: form.postal_code,
    },
    items: lines.map((line) => ({
      ...line,
      preparation_weight_kg: line.preparation_weight_kg || undefined,
    })),
    payment_method: "cod",
    payment_reference: "",
    instructions: form.instructions,
    preparation_notes: form.preparation_notes,
    promo_code: form.promo_code,
    delivery_distance_km: form.delivery_distance_km
      ? Number(form.delivery_distance_km)
      : undefined,
  };
  const currentSignature = JSON.stringify(payload);
  signature.current = currentSignature;
  useEffect(() => {
    setReview(null);
    key.current = "";
  }, [currentSignature]);
  async function saveProfile() {
    if (!profileReady)
      throw Error(
        t(
          "Load your saved profile before changing defaults.",
          "পছন্দ পরিবর্তনের আগে প্রোফাইল লোড করুন।",
        ),
      );
    const requested = ++saveRequest.current;
    const data = checkoutProfilePayload(form, bn ? "bn" : "en");
    await commerceApi<CustomerProfile>("/account/profile", token, "PUT", data);
    if (requested === saveRequest.current)
      setProfileStatus(
        t(
          "Saved to your profile for future checkouts.",
          "পরবর্তী অর্ডারের জন্য প্রোফাইলে সংরক্ষিত হয়েছে।",
        ),
      );
  }
  const baseArea = configuration?.pilot.delivery_base_area || "Uttara";
  const normalizedArea = form.area.trim().toLowerCase();
  const withinBase =
    normalizedArea === baseArea.toLowerCase() ||
    normalizedArea.startsWith(baseArea.toLowerCase() + " ") ||
    (baseArea.toLowerCase() === "uttara" && normalizedArea.startsWith("উত্তরা"));
  if (order)
    return (
      <section
        className="panel checkout-delivery checkout-success"
        role="status"
      >
        <p className="kicker">{t("ORDER PLACED", "অর্ডার দেওয়া হয়েছে")}</p>
        <h2>{order.order_number}</h2>
        <p>
          {t(
            "Your cash-on-delivery order has reached the admin. Track it for confirmation or a final-price request. Pay the courier when delivered.",
            "ক্যাশ অন ডেলিভারি অর্ডার অ্যাডমিন পেয়েছেন। নিশ্চিতকরণ বা চূড়ান্ত দাম দেখতে অর্ডার ট্র্যাক করুন। পণ্য পেলে টাকা দিন।",
          )}
        </p>
        <Link href={"/orders?id=" + order.id}>
          {t("Track my order", "অর্ডার ট্র্যাক করুন")}
        </Link>
      </section>
    );
  return (
    <>
      <section className="panel checkout-delivery">
        <h2>{t("Delivery details", "ডেলিভারির তথ্য")}</h2>
        <p className="saved-detail-hint">
          {profileReady
            ? t(
                "Saved details fill automatically. Edit anything for this order.",
                "সংরক্ষিত তথ্য স্বয়ংক্রিয়ভাবে এসেছে। এই অর্ডারের তথ্য সম্পাদনা করতে পারেন।",
              )
            : t("Loading your saved details…", "সংরক্ষিত তথ্য লোড হচ্ছে…")}
        </p>
        {!profileReady && (
          <button
            type="button"
            className="secondary"
            onClick={() =>
              window.dispatchEvent(new Event("trippy-profile-retry"))
            }
          >
            {t("Retry saved details", "আবার লোড করুন")}
          </button>
        )}
        <p className="checkout-status checkout-form-status" role="status">
          {status}
        </p>
        <form
          id="checkout-delivery-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            setBusy(true);
            setStatus("");
            const captured = currentSignature;
            try {
              if (saveDefaults) await saveProfile();
              const value = await commerceApi<Review>(
                "/commerce/review",
                token,
                "POST",
                payload,
              );
              if (signature.current !== captured) {
                setStatus(
                  t(
                    "Your details changed. Review again.",
                    "তথ্য পরিবর্তিত হয়েছে। আবার পর্যালোচনা করুন।",
                  ),
                );
                return;
              }
              setReview(value);
              key.current = crypto.randomUUID();
              onStep(3);
            } catch (e) {
              setStatus((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="checkout-form-fields" disabled={busy}>
            <div className="fields">
              {(
                [
                  ["name", "Recipient name", "প্রাপকের নাম", 120],
                  [
                    "phone",
                    "Bangladesh mobile number",
                    "বাংলাদেশের ফোন নম্বর",
                    20,
                  ],
                  [
                    "address_line",
                    "House, road & delivery address",
                    "বাড়ি, সড়ক ও ঠিকানা",
                    300,
                  ],
                  ["area", "Area", "এলাকা", 120],
                  ["city", "City", "শহর", 80],
                  [
                    "postal_code",
                    "Postal code (optional)",
                    "পোস্ট কোড (ঐচ্ছিক)",
                    20,
                  ],
                ] as const
              ).map(([field, en, b, length]) => (
                <label
                  key={field}
                  className={field === "address_line" ? "full-field" : ""}
                >
                  {t(en, b)}
                  <input
                    required={field !== "postal_code"}
                    type={field === "phone" ? "tel" : "text"}
                    autoComplete={
                      {
                        name: "name",
                        phone: "tel",
                        address_line: "street-address",
                        area: "address-level3",
                        city: "address-level2",
                        postal_code: "postal-code",
                      }[field]
                    }
                    minLength={
                      field === "phone"
                        ? 8
                        : field === "address_line"
                          ? 5
                          : field === "city"
                            ? 2
                            : undefined
                    }
                    maxLength={length}
                    value={form[field]}
                    onChange={(e) => change(field, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <p className="delivery-fee-note">
              {baseArea} ·{" "}
              {configuration?.pilot.delivery_base_fee_bdt != null
                ? money(configuration.pilot.delivery_base_fee_bdt, bn)
                : t("Fee pending", "ফি অপেক্ষমাণ")}{" "}
              {t("per order", "প্রতি অর্ডার")}
              <small>
                + {money(configuration?.pilot.delivery_per_km_bdt || "0", bn)}/
                {t("km outside the area", "কিমি এলাকার বাইরে")}
              </small>
            </p>
            {form.area.trim() && !withinBase && (
              <label>
                {t(
                  "Distance from " + baseArea + " (km)",
                  "উত্তরা থেকে দূরত্ব (কিমি)",
                )}
                <input
                  required
                  type="number"
                  min="0.01"
                  max="500"
                  step="0.01"
                  value={form.delivery_distance_km}
                  onChange={(e) =>
                    change("delivery_distance_km", e.target.value)
                  }
                />
                <small>
                  {t(
                    "Enter the distance estimate; the store will verify it before confirming the order.",
                    "আনুমানিক দূরত্ব লিখুন; নিশ্চিত করার আগে দোকান যাচাই করবে।",
                  )}
                </small>
              </label>
            )}
            <details className="checkout-disclosure">
              <summary>
                {t(
                  "Delivery & preparation notes",
                  "ডেলিভারি ও প্রস্তুতের নির্দেশনা",
                )}
                {(form.instructions || form.preparation_notes) && (
                  <span>{t("Added", "যোগ হয়েছে")}</span>
                )}
              </summary>
              <label>
                {t("Delivery instructions", "ডেলিভারির নির্দেশনা")}
                <textarea
                  value={form.instructions}
                  maxLength={1000}
                  onChange={(e) => change("instructions", e.target.value)}
                />
              </label>
              <label>
                {t("Preparation instructions", "প্রস্তুতের নির্দেশনা")}
                <textarea
                  value={form.preparation_notes}
                  maxLength={500}
                  onChange={(e) => change("preparation_notes", e.target.value)}
                />
              </label>
            </details>
            <details className="checkout-disclosure">
              <summary>{t("Have a promo code?", "অফার কোড আছে?")}</summary>
              <label>
                {t("Offer code", "অফার কোড")}
                <input
                  value={form.promo_code}
                  maxLength={30}
                  pattern="[A-Z0-9-]*"
                  onChange={(e) =>
                    change("promo_code", e.target.value.toUpperCase())
                  }
                />
              </label>
            </details>
            <details className="checkout-disclosure">
              <summary>{t("Payment preference", "পেমেন্টের পছন্দ")}</summary>
              <label>
                {t(
                  "Preferred method (preference only)",
                  "পছন্দের পদ্ধতি (শুধু পছন্দ)",
                )}
                <select
                  value={form.payment_method}
                  onChange={(e) => change("payment_method", e.target.value)}
                >
                  {paymentPreferences.map(([id, en, b]) => (
                    <option key={id} value={id}>
                      {t(en, b)}
                    </option>
                  ))}
                </select>
              </label>
              <small>
                {t(
                  "This order uses cash on delivery. Online methods are saved preferences only and cannot collect payment yet.",
                  "এই অর্ডার ক্যাশ অন ডেলিভারি। অনলাইন পদ্ধতি শুধু পছন্দ হিসেবে সংরক্ষিত, এখন টাকা নেওয়া হয় না।",
                )}
              </small>
            </details>
            <fieldset className="checkout-save-choice">
              <legend>
                {t(
                  "How should we use your changes?",
                  "পরিবর্তন কীভাবে ব্যবহার করবেন?",
                )}
              </legend>
              <label>
                <input
                  type="radio"
                  name="save-defaults"
                  checked={!saveDefaults}
                  onChange={() => setSaveDefaults(false)}
                />
                {t("Use for this order only", "শুধু এই অর্ডারের জন্য")}
              </label>
              <label>
                <input
                  type="radio"
                  name="save-defaults"
                  checked={saveDefaults}
                  disabled={!profileReady}
                  onChange={() => setSaveDefaults(true)}
                />
                {t("Save to my profile", "আমার প্রোফাইলে সংরক্ষণ")}
              </label>
            </fieldset>
            {saveDefaults && (
              <button
                type="button"
                className="secondary"
                disabled={!profileReady}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await saveProfile();
                  } catch (e) {
                    setProfileStatus((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("Save these details", "এই তথ্য সংরক্ষণ করুন")}
              </button>
            )}
            <p className="profile-save-status" role="status">
              {profileStatus}
            </p>
            <button
              className="primary checkout-mobile-review"
              disabled={!lines.length}
            >
              {t("Review order →", "অর্ডার পর্যালোচনা →")}
            </button>
          </fieldset>
        </form>
        <details className="checkout-disclosure">
          <summary>{t("Saved basket", "সংরক্ষিত ঝুড়ি")}</summary>
          <div className="cart-account-actions">
            <button
              type="button"
              className="secondary"
              disabled={busy || !lines.length}
              onClick={async () => {
                try {
                  await commerceApi("/commerce/cart", token, "PUT", {
                    items: lines,
                  });
                  setSavedCart(lines);
                  setStatus(
                    t(
                      "Basket saved to your account.",
                      "অ্যাকাউন্টে ঝুড়ি সংরক্ষিত হয়েছে।",
                    ),
                  );
                } catch (e) {
                  setStatus((e as Error).message);
                }
              }}
            >
              {t("Save basket", "ঝুড়ি সংরক্ষণ")}
            </button>
            {!!savedCart.length && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => writeBasket(savedCart)}
              >
                {t("Restore saved basket", "সংরক্ষিত ঝুড়ি ফিরিয়ে আনুন")}
              </button>
            )}
          </div>
        </details>
      </section>
      <aside
        className="panel checkout-summary"
        aria-label={t("Order summary", "অর্ডারের হিসাব")}
      >
        <h2>{t("Order summary", "অর্ডারের হিসাব")}</h2>
        <dl>
          <div>
            <dt>{t("Items", "পণ্য")}</dt>
            <dd>
              {money(
                review?.item_subtotal_bdt ||
                  review?.subtotal_bdt ||
                  itemSubtotal,
                bn,
              )}
            </dd>
          </div>
          <div>
            <dt>{t("Preparation", "প্রস্তুতি")}</dt>
            <dd>
              {pendingItems.some(
                (item) =>
                  item.message.includes("weight") ||
                  item.message.includes("ওজন"),
              )
                ? t("Store will weigh", "দোকান ওজন করবে")
                : money(
                    review?.preparation_fee_bdt ||
                      Math.max(0, subtotal - itemSubtotal),
                    bn,
                  )}
            </dd>
          </div>
          <div>
            <dt>{t("Delivery", "ডেলিভারি")}</dt>
            <dd>
              {review?.delivery_fee_bdt != null
                ? money(review.delivery_fee_bdt, bn)
                : t("At review", "পর্যালোচনায়")}
            </dd>
          </div>
          {review && Number(review.discount_bdt) > 0 && (
            <div>
              <dt>{t("Offer savings", "অফারের সাশ্রয়")}</dt>
              <dd>−{money(review.discount_bdt, bn)}</dd>
            </div>
          )}
        </dl>
        {!review && !!pendingItems.length && (
          <div className="checkout-warning">
            {pendingItems.map((item) => (
              <p key={item.sku}>
                {item.message}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onFix(item.sku)}
                >
                  {t("View item", "পণ্য দেখুন")}
                </button>
              </p>
            ))}
          </div>
        )}
        {!!review?.pending?.length && (
          <ul className="checkout-warning" role="status">
            {review.pending.map((p) => (
              <li key={p}>
                {p.replace(
                  ": enter preparation weight in kg",
                  ": store will weigh and confirm preparation fee",
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="checkout-total">
          <strong>{t("Total", "মোট")}</strong>
          <strong>
            {review?.total_bdt != null
              ? money(review.total_bdt, bn)
              : t(
                  review ? "Final quote after weighing" : "Review to calculate",
                  review ? "ওজনের পরে চূড়ান্ত দাম" : "হিসাবের জন্য পর্যালোচনা করুন",
                )}
          </strong>
        </div>
        {!review ? (
          <button
            className="primary"
            type="submit"
            form="checkout-delivery-form"
            disabled={busy || !lines.length}
            onClick={() => onStep(2)}
          >
            {busy
              ? t("Checking…", "যাচাই হচ্ছে…")
              : t("Review order →", "অর্ডার পর্যালোচনা →")}
          </button>
        ) : (
          <button
            className="primary"
            disabled={busy || !configuration?.cod_ordering_open}
            onClick={async () => {
              if (!review || !configuration?.cod_ordering_open || busy) return;
              setBusy(true);
              setStatus("");
              try {
                const saved = await commerceApi<{
                  id: string;
                  order_number: string;
                  payment_status: string;
                }>(
                  "/commerce/cod-orders",
                  token,
                  "POST",
                  {
                    ...payload,
                    payment_reference: "",
                    expected_total_bdt: review.total_bdt,
                  },
                  key.current,
                );
                setOrder(saved);
                onStep(2);
                clear();
                try {
                  await commerceApi("/commerce/cart", token, "PUT", {
                    items: [],
                  });
                } catch {
                  setStatus(
                    t(
                      "Order placed; the account basket could not be cleared.",
                      "অর্ডার সংরক্ষিত; অ্যাকাউন্টের ঝুড়ি খালি করা যায়নি।",
                    ),
                  );
                }
              } catch (e) {
                setStatus((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? t("Saving…", "সংরক্ষণ হচ্ছে…")
              : t("Place cash-on-delivery order", "ক্যাশ অন ডেলিভারি অর্ডার দিন")}
          </button>
        )}
        {configuration && !configuration.cod_ordering_open && (
          <p role="status">
            {t(
              "The store has paused new cash-on-delivery orders. Please contact support.",
              "দোকান নতুন ক্যাশ অন ডেলিভারি অর্ডার সাময়িক বন্ধ রেখেছে। সহায়তায় যোগাযোগ করুন।",
            )}
          </p>
        )}
        <p role="status" className="checkout-status">
          {status}
        </p>
        <div className="checkout-payment-notice">
          <strong>{t("Cash on delivery", "ক্যাশ অন ডেলিভারি")}</strong>
          <p>
            {t(
              "Pay the courier upon delivery. If weighing or pricing is needed, the store sends a final quote for your approval before preparation. Online payments are disabled.",
              "ডেলিভারির সময় টাকা দিন। ওজন বা দাম বাকি থাকলে প্রস্তুতির আগে দোকানের চূড়ান্ত দাম অনুমোদন করুন। অনলাইন পেমেন্ট বন্ধ।",
            )}
          </p>
        </div>
        {review && (
          <p className="checkout-window">
            {t(
              "Proposed window (awaiting confirmation)",
              "প্রস্তাবিত সময় (নিশ্চিতকরণ বাকি)",
            )}
            :{" "}
            {new Date(review.delivery_deadline).toLocaleString(
              bn ? "bn-BD" : "en-BD",
              { timeZone: "Asia/Dhaka" },
            )}
          </p>
        )}
        <button
          type="button"
          className="text-button checkout-mobile-review"
          onClick={() => onStep(2)}
        >
          {t("Edit delivery details", "ডেলিভারির তথ্য সম্পাদনা")}
        </button>
      </aside>
    </>
  );
}

export function BasketCheckout() {
  const [bn, setBn] = useState(false);
  const languageEdited = useRef(false);
  const loadProfileLanguage = useCallback((value: boolean) => {
    if (!languageEdited.current) setBn(value);
  }, []);
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const sync = () => setLines(readBasket());
    sync();
    window.addEventListener("trippy-basket", sync);
    const storage = (e: StorageEvent) => {
      if (e.key === "trippy-basket-v1") sync();
    };
    window.addEventListener("storage", storage);
    commerceApi<Product[]>("/groceries/products")
      .then(setProducts)
      .catch((e) => setError(e.message));
    return () => {
      window.removeEventListener("trippy-basket", sync);
      window.removeEventListener("storage", storage);
    };
  }, []);
  const t = text(bn);
  const subtotal = lines.reduce((n, l) => {
    const p = products.find((p) => p.sku === l.sku);
    return p?.price_approved ? n + lineTotal(p, l) : n;
  }, 0);
  const itemSubtotal = lines.reduce((sum, line) => {
    const product = products.find((p) => p.sku === line.sku);
    return (
      sum +
      (product?.price_approved
        ? Number(product.price_bdt) * Number(line.quantity)
        : 0)
    );
  }, 0);
  const pendingItems = lines.flatMap((l) => {
    const p = products.find((p) => p.sku === l.sku);
    if (!p) return [];
    const name = bn ? p.name_bn : p.name_en;
    return !p.price_approved
      ? [
          {
            sku: l.sku,
            message: name + t(": price pending", ": দাম নিশ্চিত হয়নি"),
          },
        ]
      : needsWeight(p, l)
        ? [
            {
              sku: l.sku,
              message:
                name +
                t(
                  ": store will confirm preparation weight and fee",
                  ": দোকান প্রস্তুতির ওজন ও ফি নিশ্চিত করবে",
                ),
            },
          ]
        : [];
  });
  const shown = expanded ? lines : lines.slice(0, 6);
  const update = (l: BasketLine, changes: Partial<BasketLine>) =>
    writeBasket(lines.map((i) => (i.sku === l.sku ? { ...i, ...changes } : i)));
  const go = (n: number) => {
    setStep(n);
    document
      .getElementById("checkout-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <main className="wrap commerce-page checkout-page">
      <nav className="market-nav">
        <Link className="wordmark" href="/">
          TRIPPY Delivery
        </Link>
        <Link href="/groceries">{t("Continue shopping", "বাজার করুন")}</Link>
        <Link href="/account">{t("My profile", "আমার প্রোফাইল")}</Link>
        <button
          onClick={() => {
            languageEdited.current = true;
            setBn(!bn);
          }}
        >
          {bn ? "English" : "বাংলা"}
        </button>
      </nav>
      <p className="launch-notice checkout-preview-banner">
        {t(
          "Cash on delivery · Pay when your order arrives",
          "ক্যাশ অন ডেলিভারি · পণ্য পেলে টাকা দিন",
        )}
      </p>
      <header className="checkout-heading" id="checkout-heading">
        <div>
          <h1>{t("Your basket", "আপনার ঝুড়ি")}</h1>
          <p>
            {t(
              "Review your items, preparation and delivery.",
              "পণ্য, প্রস্তুতি ও ডেলিভারির তথ্য পর্যালোচনা করুন।",
            )}
          </p>
        </div>
        <nav
          className="checkout-steps"
          aria-label={t("Checkout steps", "অর্ডারের ধাপ")}
        >
          {[
            t("Basket", "ঝুড়ি"),
            t("Delivery", "ডেলিভারি"),
            t("Review", "পর্যালোচনা"),
          ].map((label, i) => (
            <button
              key={i}
              type="button"
              aria-current={step === i + 1 ? "step" : undefined}
              disabled={busy || i === 2}
              onClick={() => go(i + 1)}
            >
              <span>{i + 1}</span>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className="checkout-workspace" data-step={step}>
        <section className="panel checkout-basket">
          <div className="checkout-basket-heading">
            <h2>
              {t("Basket", "ঝুড়ি")} · {lines.length} {t("items", "পণ্য")}
            </h2>
            <small>
              {t(
                "Your selections stay in this browser",
                "এই ব্রাউজারে নির্বাচন সংরক্ষিত থাকে",
              )}
            </small>
          </div>
          <p role="status">{error}</p>
          {!lines.length && (
            <p>
              {t("Your basket is empty.", "আপনার ঝুড়ি খালি।")}{" "}
              <Link href="/groceries">
                {t("Browse groceries", "বাজার করুন")}
              </Link>
            </p>
          )}
          {shown.map((l) => {
            const p = products.find((p) => p.sku === l.sku);
            const choice = p
              ? preparationOptions(p).find((o) => o.id === l.preparation)
              : undefined;
            const photo = p
              ? productPhoto(
                  p,
                  choice ||
                    ({ id: l.preparation } as Parameters<
                      typeof productPhoto
                    >[1]),
                  [],
                  API_BASE,
                )
              : null;
            return (
              <article
                className="checkout-basket-row"
                id={"basket-" + l.sku}
                key={l.sku}
              >
                {photo && (
                  <div className="basket-product-image">
                    <ProductImage
                      photo={photo}
                      alt={
                        (p ? (bn ? p.name_bn : p.name_en) : l.sku) +
                        (photo.generated
                          ? t(" · AI-generated preview", " · এআই-তৈরি নমুনা")
                          : "")
                      }
                      width={76}
                      height={76}
                    />
                  </div>
                )}
                <div className="checkout-item-main">
                  <h3>{p ? (bn ? p.name_bn : p.name_en) : l.sku}</h3>
                  <small>
                    {l.quantity} {p?.unit} ·{" "}
                    {choice
                      ? bn
                        ? choice.name_bn
                        : choice.name_en
                      : t("Original pack", "মূল প্যাকেট")}
                  </small>
                  {p?.category === "fresh" && (
                    <label className="checkout-preparation">
                      <span>{t("Preparation", "প্রস্তুতি")}</span>
                      <select
                        disabled={busy}
                        aria-label={
                          t("Preparation for ", "প্রস্তুতি: ") +
                          (bn ? p.name_bn : p.name_en)
                        }
                        value={l.preparation}
                        onChange={(e) =>
                          update(l, { preparation: e.target.value })
                        }
                      >
                        {preparationOptions(p).map((o) => (
                          <option key={o.id} value={o.id}>
                            {bn ? o.name_bn : o.name_en}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {p && p.unit !== "kg" && choice?.fee_unit === "kg" && (
                    <label className="preparation-weight">
                      {t(
                        "Preparation weight, if known (kg, optional)",
                        "প্রস্তুতির ওজন জানা থাকলে (কেজি, ঐচ্ছিক)",
                      )}
                      <input
                        disabled={busy}
                        type="number"
                        min="0.001"
                        max="50"
                        step="0.001"
                        value={l.preparation_weight_kg || ""}
                        onChange={(e) =>
                          update(l, { preparation_weight_kg: e.target.value })
                        }
                      />
                    </label>
                  )}
                </div>
                <div className="checkout-item-controls">
                  <label className="checkout-quantity">
                    <span className="sr-only">
                      {t("Quantity for ", "পরিমাণ: ") +
                        (p ? (bn ? p.name_bn : p.name_en) : l.sku)}
                    </span>
                    <button
                      type="button"
                      disabled={
                        busy ||
                        Number(l.quantity) <=
                          Number(p?.details.minimum_quantity || 1)
                      }
                      aria-label={
                        t("Decrease quantity for ", "পরিমাণ কমান: ") +
                        (p?.name_en || l.sku)
                      }
                      onClick={() =>
                        update(l, {
                          quantity: String(
                            Math.max(
                              Number(p?.details.minimum_quantity || 1),
                              Number(
                                (
                                  Number(l.quantity) -
                                  Number(p?.details.quantity_step || 1)
                                ).toFixed(3),
                              ),
                            ),
                          ),
                        })
                      }
                    >
                      −
                    </button>
                    <QuantityInput
                      disabled={busy}
                      aria-label={
                        t("Quantity for ", "পরিমাণ: ") +
                        (p ? (bn ? p.name_bn : p.name_en) : l.sku)
                      }
                      min={p?.details.minimum_quantity || "1"}
                      step={p?.details.quantity_step || "1"}
                      value={l.quantity}
                      onCommit={(quantity) => update(l, { quantity })}
                    />
                    <button
                      type="button"
                      disabled={busy || Number(l.quantity) >= 50}
                      aria-label={
                        t("Increase quantity for ", "পরিমাণ বাড়ান: ") +
                        (p?.name_en || l.sku)
                      }
                      onClick={() =>
                        update(l, {
                          quantity: String(
                            Math.min(
                              50,
                              Number(
                                (
                                  Number(l.quantity) +
                                  Number(p?.details.quantity_step || 1)
                                ).toFixed(3),
                              ),
                            ),
                          ),
                        })
                      }
                    >
                      +
                    </button>
                  </label>
                  <strong>
                    {p?.price_approved
                      ? money(lineTotal(p, l), bn)
                      : t("Price pending", "দাম অপেক্ষমাণ")}
                  </strong>
                  <button
                    disabled={busy}
                    type="button"
                    className="text-button"
                    aria-label={t("Remove ", "সরান: ") + (p?.name_en || l.sku)}
                    onClick={() =>
                      writeBasket(lines.filter((i) => i.sku !== l.sku))
                    }
                  >
                    {t("Remove", "সরান")}
                  </button>
                </div>
              </article>
            );
          })}
          {lines.length > 6 && (
            <button
              type="button"
              className="secondary checkout-show-all"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded
                ? t("Show fewer items", "কম পণ্য দেখুন")
                : t("View all ", "সব ") +
                  lines.length +
                  t(" items", "টি পণ্য দেখুন")}
            </button>
          )}
          <div className="checkout-basket-footer">
            <small>
              {t(
                "AI-generated images are labeled product previews.",
                "এআই-তৈরি ছবিগুলো পণ্যের নমুনা হিসেবে চিহ্নিত।",
              )}
            </small>
            <strong>
              {t("Items & preparation subtotal", "পণ্য ও প্রস্তুতির মোট")}:{" "}
              {money(subtotal, bn)}
            </strong>
          </div>
          <button
            type="button"
            className="primary checkout-mobile-review"
            disabled={!lines.length}
            onClick={() => go(2)}
          >
            {t("Delivery details →", "ডেলিভারির তথ্য →")}
          </button>
        </section>
        <GoogleAccess compact bn={bn}>
          <CheckoutForm
            lines={lines}
            bn={bn}
            clear={() => writeBasket([])}
            onStep={go}
            onBusy={setBusy}
            onLanguage={loadProfileLanguage}
            subtotal={subtotal}
            itemSubtotal={itemSubtotal}
            pendingItems={pendingItems}
            onFix={(sku) => {
              setExpanded(true);
              setStep(1);
              requestAnimationFrame(() => {
                const el = document.getElementById("basket-" + sku);
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                el?.querySelector<HTMLInputElement>(
                  ".preparation-weight input",
                )?.focus();
              });
            }}
          />
        </GoogleAccess>
        <aside className="panel checkout-summary checkout-guest-summary">
          <h2>{t("Order summary", "অর্ডারের হিসাব")}</h2>
          <div className="checkout-total">
            <span>{t("Items & preparation", "পণ্য ও প্রস্তুতি")}</span>
            <strong>{money(subtotal, bn)}</strong>
          </div>
          <p>
            {t(
              "Sign in to fill saved details and review your order.",
              "সংরক্ষিত তথ্য ও অর্ডার পর্যালোচনার জন্য সাইন ইন করুন।",
            )}
          </p>
          <p>
            {t(
              "Cash on delivery is available when enabled by the store. Online payments are disabled.",
              "দোকান চালু রাখলে ক্যাশ অন ডেলিভারি করা যাবে। অনলাইন পেমেন্ট বন্ধ।",
            )}
          </p>
        </aside>
      </div>
    </main>
  );
}
