"use client";
import Link from "next/link";
import { ProductImage } from "./ProductImage";
import { API_BASE } from "@/lib/api";
import { productPhoto, preparationOptions } from "@/lib/preparation.mjs";
import { useEffect, useRef, useState } from "react";
import { GoogleAccess, useCredential } from "@/features/account/GoogleAccess";
import {
  commerceApi,
  money,
  type Product,
  type BasketLine,
  type Configuration,
} from "@/lib/commerce";
import { readBasket, writeBasket, lineTotal } from "@/lib/basket.mjs";
type Review = {
  subtotal_bdt: string;
  discount_bdt: string;
  delivery_fee_bdt: string | null;
  total_bdt: string | null;
  item_subtotal_bdt?: string;
  preparation_fee_bdt?: string;
  pending?: string[];
  preview?: boolean;
  delivery_deadline: string;
  slot_confirmed: boolean;
  ordering_open: boolean;
};
function CheckoutForm({
  lines,
  bn,
  clear,
}: {
  lines: BasketLine[];
  bn: boolean;
  clear: () => void;
}) {
  const token = useCredential();
  const key = useRef("");
  const [configuration, setConfiguration] = useState<Configuration | null>(
    null,
  );
  const [savedCart, setSavedCart] = useState<BasketLine[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<{
    id: string;
    order_number: string;
    payment_status: string;
  } | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address_line: "",
    area: "",
    city: "Dhaka",
    postal_code: "",
    instructions: "",
    preparation_notes: "",
    promo_code: "",
    delivery_distance_km: "",
    payment_method: "cod",
    payment_reference: "",
  });
  const t = (en: string, b: string) => (bn ? b : en);
  useEffect(() => {
    let active = true;
    Promise.all([
      commerceApi<Configuration>("/commerce/configuration"),
      commerceApi<{ items: BasketLine[] }>("/commerce/cart", token),
    ])
      .then(([c, b]) => {
        if (active) {
          setConfiguration(c);
          setSavedCart(b.items);
        }
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    return () => {
      active = false;
    };
  }, [token]);
  const payload = {
    destination: {
      name: form.name,
      phone: form.phone,
      address_line: form.address_line,
      city: form.city,
      area: form.area,
      postal_code: form.postal_code,
    },
    items: lines,
    payment_method: form.payment_method,
    payment_reference: form.payment_reference,
    instructions: form.instructions,
    preparation_notes: form.preparation_notes,
    promo_code: form.promo_code,
    delivery_distance_km: form.delivery_distance_km
      ? Number(form.delivery_distance_km)
      : undefined,
  };
  useEffect(() => {
    setReview(null);
  }, [lines]);
  useEffect(() => {
    let active = true;
    commerceApi<{ name?: string; phone?: string }>("/account/profile", token)
      .then((profile) => {
        if (active)
          setForm((current) => ({
            ...current,
            name: current.name || profile.name || "",
            phone: current.phone || profile.phone || "",
          }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token]);
  const preview = configuration?.preview_checkout;
  const baseArea = (configuration?.pilot.delivery_base_area || "Uttara")
    .trim()
    .toLowerCase();
  const deliveryArea = form.area.trim().toLowerCase();
  const withinBaseArea =
    deliveryArea === baseArea ||
    deliveryArea.startsWith(baseArea + " ") ||
    (baseArea === "uttara" && deliveryArea.startsWith("উত্তরা"));
  const destination = configuration?.payments[form.payment_method];
  if (order)
    return (
      <section className="panel">
        <p className="kicker">{t("ORDER RECEIVED", "অর্ডার গৃহীত")}</p>
        <h2>{order.order_number}</h2>
        <p>
          {t("Payment status", "পেমেন্টের অবস্থা")}: {order.payment_status}
        </p>
        <p>
          {t(
            "Your preview order has been saved. No payment was taken and no delivery has been scheduled.",
            "আপনার প্রিভিউ অর্ডার সংরক্ষিত হয়েছে। কোনো টাকা নেওয়া বা ডেলিভারি নির্ধারণ করা হয়নি।",
          )}
        </p>
        <Link href={"/orders?id=" + order.id}>
          {t("View order", "অর্ডার দেখুন")}
        </Link>
      </section>
    );
  return (
    <section className="panel checkout-panel">
      <h2>{t("Delivery & payment", "ডেলিভারি ও পেমেন্ট")}</h2>
      <div className="cart-account-actions">
        <button
          className="secondary"
          disabled={!lines.length || busy}
          onClick={async () => {
            try {
              await commerceApi("/commerce/cart", token, "PUT", {
                items: lines,
              });
              setStatus(
                t(
                  "Basket saved to your account.",
                  "আপনার অ্যাকাউন্টে ঝুড়ি সংরক্ষিত হয়েছে।",
                ),
              );
            } catch (e) {
              setStatus((e as Error).message);
            }
          }}
        >
          {t("Save basket to my account", "অ্যাকাউন্টে ঝুড়ি সংরক্ষণ")}
        </button>
        {savedCart.length > 0 && (
          <button
            className="secondary"
            onClick={() => {
              writeBasket(savedCart);
              window.location.reload();
            }}
          >
            {t("Restore my saved basket", "সংরক্ষিত ঝুড়ি ফিরিয়ে আনুন")}
          </button>
        )}
      </div>
      {preview && (
        <p className="launch-notice">
          {t(
            "Calculate and save a preview order. Payments and fulfillment are disabled.",
            "হিসাব করুন ও প্রিভিউ অর্ডার সংরক্ষণ করুন। পেমেন্ট ও ডেলিভারি কার্যক্রম বন্ধ আছে।",
          )}
        </p>
      )}
      <form
        onChange={() => setReview(null)}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setStatus("");
          try {
            const value = await commerceApi<Review>(
              "/commerce/review",
              token,
              "POST",
              payload,
            );
            setReview(value);
            key.current = crypto.randomUUID();
          } catch (e) {
            setStatus((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="fields">
          {(
            [
              "name",
              "phone",
              "address_line",
              "area",
              "city",
              "postal_code",
            ] as const
          ).map((k) => (
            <label key={k}>
              {
                {
                  name: t("Recipient name", "প্রাপকের নাম"),
                  phone: t("Bangladesh contact number", "বাংলাদেশের ফোন নম্বর"),
                  address_line: t(
                    "House, road & delivery address",
                    "বাড়ি, সড়ক ও ঠিকানা",
                  ),
                  area: t("Area", "এলাকা"),
                  city: t("City", "শহর"),
                  postal_code: t("Postal code (optional)", "পোস্ট কোড (ঐচ্ছিক)"),
                }[k]
              }
              <input
                required={k !== "postal_code"}
                type={k === "phone" ? "tel" : "text"}
                minLength={k === "address_line" ? 5 : k === "phone" ? 8 : 1}
                maxLength={
                  k === "address_line" ? 300 : k === "phone" ? 20 : 120
                }
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            </label>
          ))}
        </div>
        {preview && configuration?.pilot.delivery_base_fee_bdt != null && (
          <p>
            {t("Delivery", "ডেলিভারি")}:{" "}
            {money(configuration.pilot.delivery_base_fee_bdt, bn)}{" "}
            {t("within", "এর মধ্যে")}{" "}
            {configuration.pilot.delivery_base_area || "Uttara"}; +
            {money(configuration.pilot.delivery_per_km_bdt || "0", bn)}/
            {t("km outside the area", "কিমি এলাকার বাইরে")}.
          </p>
        )}
        {preview &&
          configuration?.pilot.delivery_base_fee_bdt != null &&
          form.area.trim() &&
          !withinBaseArea && (
            <label>
              {t(
                "Distance from " +
                  (configuration?.pilot.delivery_base_area || "Uttara") +
                  " (km)",
                "উত্তরা থেকে দূরত্ব (কিমি)",
              )}
              <input
                type="number"
                min="0.01"
                max="500"
                step="0.01"
                required
                value={form.delivery_distance_km}
                onChange={(e) =>
                  setForm({ ...form, delivery_distance_km: e.target.value })
                }
              />
              <small>
                {t(
                  "Enter the delivery distance for this preview calculation. This is not automatic road routing.",
                  "প্রিভিউ হিসাবের জন্য ডেলিভারির দূরত্ব লিখুন। এটি স্বয়ংক্রিয় সড়ক দূরত্ব নয়।",
                )}
              </small>
            </label>
          )}
        <label>
          {t("Delivery instructions", "ডেলিভারির নির্দেশনা")}
          <textarea
            maxLength={1000}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </label>
        <label>
          {t("Preparation instructions", "প্রস্তুতের নির্দেশনা")}
          <textarea
            maxLength={500}
            value={form.preparation_notes}
            onChange={(e) =>
              setForm({ ...form, preparation_notes: e.target.value })
            }
          />
        </label>
        <label>
          {t("Offer code (optional)", "অফার কোড (ঐচ্ছিক)")}
          <input
            maxLength={30}
            pattern="[A-Z0-9-]*"
            value={form.promo_code}
            onChange={(e) =>
              setForm({ ...form, promo_code: e.target.value.toUpperCase() })
            }
          />
        </label>
        <fieldset className="payment-methods">
          <legend>
            {t("Choose a payment method", "পেমেন্ট পদ্ধতি বেছে নিন")}
          </legend>
          {[
            ["bkash", "bKash"],
            ["nagad", "Nagad"],
            ["rocket", "Rocket"],
            ["bank", "Bank Transfer"],
            ["cod", t("Cash on Delivery", "ক্যাশ অন ডেলিভারি")],
          ].map(([id, name]) => (
            <label
              key={id}
              className={
                form.payment_method === id
                  ? "payment-card selected"
                  : "payment-card"
              }
            >
              <input
                type="radio"
                name="payment"
                value={id}
                checked={form.payment_method === id}
                disabled={!!preview || !configuration?.payments[id]?.enabled}
                onChange={() =>
                  setForm({
                    ...form,
                    payment_method: id,
                    payment_reference: "",
                  })
                }
              />
              <strong>{name}</strong>
              <span>
                {configuration?.payments[id]?.enabled
                  ? id === "cod"
                    ? t("Pay on receipt", "পণ্য পেয়ে মূল্য পরিশোধ")
                    : t("Manual verification", "ম্যানুয়াল যাচাই")
                  : t("Not enabled yet", "এখনো চালু নয়")}
              </span>
            </label>
          ))}
        </fieldset>
        {!preview && form.payment_method !== "cod" && destination?.enabled && (
          <div className="payment-instructions">
            <h3>{t("Payment instructions", "পেমেন্ট নির্দেশনা")}</h3>
            <p>{destination.instructions}</p>
            {destination.bank_name && (
              <p>
                {destination.bank_name} · {destination.account_name} ·{" "}
                {destination.branch} · {destination.routing}
              </p>
            )}
            <p>
              <strong>
                {destination.receiving_number || destination.account_number}
              </strong>{" "}
              <button
                type="button"
                className="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    destination.receiving_number ||
                      destination.account_number ||
                      "",
                  );
                  setStatus(t("Number copied.", "নম্বর কপি হয়েছে।"));
                }}
              >
                {t("Copy", "কপি")}
              </button>
            </p>
            <p>
              {t("Amount due", "প্রদেয়")}:{" "}
              {review?.total_bdt
                ? money(review.total_bdt, bn)
                : t(
                    "Review your order to calculate the final amount.",
                    "চূড়ান্ত মূল্য জানতে অর্ডার পর্যালোচনা করুন।",
                  )}
            </p>
            <label>
              {t("Transaction reference", "লেনদেন নম্বর")}
              <input
                maxLength={120}
                value={form.payment_reference}
                onChange={(e) =>
                  setForm({ ...form, payment_reference: e.target.value })
                }
              />
            </label>
            <p>
              {t(
                "Your payment stays pending until the owner verifies receipt.",
                "মালিক প্রাপ্তি যাচাই না করা পর্যন্ত পেমেন্ট অপেক্ষমাণ থাকবে।",
              )}
            </p>
          </div>
        )}
        <p>
          {t(
            "Delivery windows use Bangladesh time and depend on confirmed area coverage, preparation and courier capacity.",
            "ডেলিভারির সময় বাংলাদেশ সময় অনুযায়ী এবং এলাকার সেবা, প্রস্তুত ও কুরিয়ারের সক্ষমতার ওপর নির্ভরশীল।",
          )}
        </p>
        <button
          className="secondary"
          disabled={
            busy || !lines.length || (!preview && !destination?.enabled)
          }
        >
          {busy
            ? t("Checking…", "যাচাই হচ্ছে…")
            : t("Review order & delivery fee", "অর্ডার ও ডেলিভারি ফি দেখুন")}
        </button>
        {review && (
          <div className="order-review">
            <h3>{t("Final order review", "চূড়ান্ত পর্যালোচনা")}</h3>
            <p>
              {t("Items", "পণ্য")}:{" "}
              {money(review.item_subtotal_bdt || review.subtotal_bdt, bn)}
            </p>
            {review.preparation_fee_bdt !== undefined && (
              <p>
                {t("Preparation", "প্রস্তুতি")}:{" "}
                {money(review.preparation_fee_bdt, bn)}
              </p>
            )}
            <p>
              {t("Delivery", "ডেলিভারি")}:{" "}
              {review.delivery_fee_bdt === null
                ? t("Fee not configured", "ফি নির্ধারিত হয়নি")
                : money(review.delivery_fee_bdt, bn)}
            </p>
            {!!review.pending?.length && (
              <ul role="status">
                {review.pending.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
            {Number(review.discount_bdt) > 0 && (
              <p>
                {t("Offer savings", "অফারের সাশ্রয়")}:{" "}
                {money(review.discount_bdt, bn)}
              </p>
            )}
            <strong>
              {t("Total", "মোট")}:{" "}
              {review.total_bdt === null
                ? t(
                    "Complete the missing prices above",
                    "উপরের অনির্ধারিত দাম পূরণ করতে হবে",
                  )
                : money(review.total_bdt, bn)}
            </strong>
            <p>
              {preview
                ? t(
                    "Example delivery window (not scheduled)",
                    "উদাহরণ ডেলিভারির সময় (নির্ধারিত নয়)",
                  )
                : t("Proposed delivery deadline", "প্রস্তাবিত ডেলিভারি সময়")}
              :{" "}
              {new Date(review.delivery_deadline).toLocaleString(
                bn ? "bn-BD" : "en-BD",
                { timeZone: "Asia/Dhaka" },
              )}
            </p>
            <button
              className="primary"
              type="button"
              disabled={
                busy ||
                (preview
                  ? review.total_bdt === null
                  : !configuration?.ordering_open || !review.ordering_open)
              }
              onClick={async () => {
                setBusy(true);
                try {
                  const o = await commerceApi<{
                    id: string;
                    order_number: string;
                    payment_status: string;
                  }>(
                    preview ? "/commerce/preview-orders" : "/groceries/orders",
                    token,
                    "POST",
                    {
                      ...payload,
                      ...(preview
                        ? {
                            payment_reference: "",
                            expected_total_bdt: review.total_bdt,
                          }
                        : {}),
                    },
                    key.current,
                  );
                  setOrder(o);
                  await commerceApi("/commerce/cart", token, "PUT", {
                    items: [],
                  });
                  clear();
                } catch (e) {
                  setStatus((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {preview
                ? t("Place preview order", "প্রিভিউ অর্ডার করুন")
                : t("Place order", "অর্ডার করুন")}
            </button>
          </div>
        )}
      </form>
      <p role="status">{status}</p>
    </section>
  );
}
export function BasketCheckout() {
  const [bn, setBn] = useState(false);
  const [lines, setLines] = useState<BasketLine[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const sync = () => setLines(readBasket());
    sync();
    window.addEventListener("trippy-basket", sync);
    commerceApi<Product[]>("/groceries/products")
      .then(setProducts)
      .catch((e) => setError(e.message));
    return () => window.removeEventListener("trippy-basket", sync);
  }, []);
  const t = (en: string, b: string) => (bn ? b : en);
  const subtotal = lines.reduce((n, l) => {
    const p = products.find((p) => p.sku === l.sku);
    return p?.price_approved ? n + lineTotal(p, l) : n;
  }, 0);
  return (
    <main className="wrap commerce-page">
      <nav className="market-nav">
        <Link className="wordmark" href="/">
          TRIPPY Delivery
        </Link>
        <Link href="/groceries">{t("Continue shopping", "বাজার করুন")}</Link>
        <button onClick={() => setBn(!bn)}>{bn ? "English" : "বাংলা"}</button>
      </nav>
      <p className="kicker">{t("YOUR MARKET BASKET", "আপনার বাজারের ঝুড়ি")}</p>
      <h1>
        {t(
          "Good food. A little less effort.",
          "প্রতিদিনের ভালো খাবার, একটু কম পরিশ্রম।",
        )}
      </h1>
      <div className="checkout-grid">
        <section className="panel">
          <h2>{t("Your basket", "আপনার ঝুড়ি")}</h2>
          <p role="status">{error}</p>
          {!lines.length && (
            <p>{t("Your basket is empty.", "আপনার ঝুড়ি খালি।")}</p>
          )}
          {lines.map((l) => {
            const p = products.find((p) => p.sku === l.sku);
            const photo = p
              ? productPhoto(
                  p,
                  p.details.preparation_options?.find(
                    (o) => o.id === l.preparation,
                  ) ||
                    ({ id: l.preparation } as Parameters<
                      typeof productPhoto
                    >[1]),
                  [],
                  API_BASE,
                )
              : null;
            return (
              <article className="basket-line" key={l.sku}>
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
                <div>
                  <h3>{p ? (bn ? p.name_bn : p.name_en) : l.sku}</h3>
                  {photo?.generated && (
                    <small className="ai-preview-label">
                      {t("AI-generated preview", "এআই-তৈরি নমুনা")}
                    </small>
                  )}
                  <p>
                    {l.quantity} {p?.unit} · {l.preparation}
                  </p>
                  <p>
                    {p?.price_approved
                      ? money(lineTotal(p, l), bn)
                      : t("Price awaits approval", "দাম অনুমোদনের অপেক্ষায়")}
                  </p>
                  <label>
                    {t("Quantity", "পরিমাণ")}
                    <input
                      type="number"
                      min={p?.details.minimum_quantity || 1}
                      step={p?.details.quantity_step || 1}
                      max="50"
                      value={l.quantity}
                      onChange={(e) =>
                        writeBasket(
                          lines.map((i) =>
                            i.sku === l.sku
                              ? { ...i, quantity: e.target.value }
                              : i,
                          ),
                        )
                      }
                    />
                  </label>
                  {p?.category === "fresh" && (
                    <label>
                      {t("Preparation", "প্রস্তুতি")}
                      <select
                        value={l.preparation}
                        onChange={(e) =>
                          writeBasket(
                            lines.map((i) =>
                              i.sku === l.sku
                                ? { ...i, preparation: e.target.value }
                                : i,
                            ),
                          )
                        }
                      >
                        {preparationOptions(p).map((o) => (
                          <option key={o.id} value={o.id}>
                            {bn ? o.name_bn : o.name_en}
                            {!o.enabled
                              ? t(" — fee not set", " — ফি নির্ধারিত হয়নি")
                              : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {p &&
                    p.unit !== "kg" &&
                    preparationOptions(p).some(
                      (o) => o.id === l.preparation && o.fee_unit === "kg",
                    ) && (
                      <label>
                        {t(
                          "Total preparation weight (kg)",
                          "প্রস্তুতির মোট ওজন (কেজি)",
                        )}
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          max="50"
                          value={l.preparation_weight_kg || ""}
                          onChange={(e) =>
                            writeBasket(
                              lines.map((i) =>
                                i.sku === l.sku
                                  ? {
                                      ...i,
                                      preparation_weight_kg: e.target.value,
                                    }
                                  : i,
                              ),
                            )
                          }
                        />
                        <small>
                          {t(
                            "Enter the total weight to calculate the per-kg preparation charge.",
                            "প্রতি কেজির প্রস্তুতি খরচ হিসাব করতে মোট ওজন দিন।",
                          )}
                        </small>
                      </label>
                    )}
                  <button
                    className="text-button"
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
          {lines.some(
            (l) => !products.find((p) => p.sku === l.sku)?.price_approved,
          ) && (
            <p className="shopping-note">
              {t(
                "Some shopping-list items still need a price. They are excluded from this subtotal; they are not free.",
                "তালিকার কিছু পণ্যের দাম নিশ্চিত হয়নি। সেগুলো এই মোটে যোগ হয়নি; বিনামূল্যে নয়।",
              )}
            </p>
          )}
          <p className="price-line">
            {t("Priced items subtotal", "দামসহ পণ্যের মোট")}:{" "}
            {money(subtotal, bn)}
          </p>
          <p>
            {t(
              "Delivery and availability are checked at order review.",
              "অর্ডার পর্যালোচনায় ডেলিভারি ও প্রাপ্যতা যাচাই করা হয়।",
            )}
          </p>
        </section>
        <div>
          <GoogleAccess>
            <CheckoutForm
              bn={bn}
              lines={lines}
              clear={() => {
                writeBasket([]);
                setLines([]);
              }}
            />
          </GoogleAccess>
        </div>
      </div>
    </main>
  );
}
