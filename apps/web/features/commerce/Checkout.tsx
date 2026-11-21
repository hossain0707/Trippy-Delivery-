"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GoogleAccess, useCredential } from "@/features/account/GoogleAccess";
import {
  commerceApi,
  money,
  type Product,
  type BasketLine,
} from "@/lib/commerce";
import { readBasket, writeBasket, lineTotal } from "@/lib/basket.mjs";
type Review = {
  subtotal_bdt: string;
  lines: {
    sku: string;
    price_pending: boolean;
    preparation_fee_pending: boolean;
  }[];
  message: string;
};
const dhakaAreas = [
  "Dhanmondi",
  "Uttara",
  "Banani",
  "Gulshan",
  "Mirpur",
  "Mohammadpur",
  "Bashundhara",
  "Badda",
  "Motijheel",
  "Ramna",
  "Tejgaon",
  "Khilgaon",
  "Jatrabari",
  "Lalbagh",
  "Wari",
  "Demra",
  "Kafrul",
  "Cantonment",
  "Airport",
  "Pallabi",
  "Shahbag",
  "Malibagh",
  "Rampura",
];
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
  const key = useRef(crypto.randomUUID());
  const [review, setReview] = useState<Review | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedCart, setSavedCart] = useState<BasketLine[]>([]);
  const [order, setOrder] = useState<{
    id: string;
    order_number: string;
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
  });
  const t = (en: string, b: string) => (bn ? b : en);
  useEffect(() => {
    let active = true;
    commerceApi<{ items: BasketLine[] }>("/commerce/cart", token)
      .then((b) => {
        if (active) setSavedCart(b.items);
      })
      .catch((e) => setStatus(e.message));
    commerceApi<{ name: string; phone: string }>("/account/profile", token)
      .then((p) => {
        if (active)
          setForm((v) => ({
            ...v,
            name: v.name || p.name || "",
            phone: v.phone || p.phone || "",
          }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token]);
  useEffect(() => {
    setReview(null);
    key.current = crypto.randomUUID();
  }, [lines]);
  const payload = {
    destination: {
      name: form.name,
      phone: form.phone,
      address_line: form.address_line,
      area: form.area,
      city: form.city,
      postal_code: form.postal_code,
    },
    items: lines,
    instructions: form.instructions,
    preparation_notes: form.preparation_notes,
  };
  const fields = [
    ["name", "Recipient name", "প্রাপকের নাম", "name"],
    ["phone", "Bangladesh mobile number", "বাংলাদেশি মোবাইল নম্বর", "tel"],
    [
      "address_line",
      "House, road & delivery address",
      "বাড়ি, রাস্তা ও ডেলিভারির ঠিকানা",
      "street-address",
    ],
    ["area", "Area / neighbourhood", "এলাকা", "address-level3"],
    ["city", "City", "শহর", "address-level2"],
    [
      "postal_code",
      "Postal code (optional)",
      "পোস্ট কোড (ঐচ্ছিক)",
      "postal-code",
    ],
  ];
  if (order)
    return (
      <section className="panel order-received">
        <p className="kicker">{t("REQUEST RECEIVED", "অনুরোধ গৃহীত")}</p>
        <h2>{order.order_number}</h2>
        <p>
          {t(
            "Your order request is saved. TRIPPY will review availability, preparation and delivery, then confirm the final quote with you. No payment has been collected.",
            "আপনার অর্ডারের অনুরোধ সংরক্ষিত হয়েছে। ট্রিপি পণ্যের প্রাপ্যতা, প্রস্তুতি ও ডেলিভারি যাচাই করে চূড়ান্ত দাম জানাবে। কোনো টাকা নেওয়া হয়নি।",
          )}
        </p>
        <Link className="primary" href={"/orders?id=" + order.id}>
          {t("Track my request", "অনুরোধের অবস্থা দেখুন")}
        </Link>
        <Link href="/groceries">{t("Continue shopping", "বাজার করুন")}</Link>
        <Link href="/photo-credits">{t("Photo credits", "ছবির কৃতিত্ব")}</Link>
      </section>
    );
  return (
    <section className="panel checkout-form">
      <p className="kicker">{t("DELIVERY DETAILS", "ডেলিভারির তথ্য")}</p>
      <h2>
        {t(
          review ? "Review your request" : "Where should we deliver?",
          review ? "আপনার অনুরোধ দেখুন" : "কোথায় পৌঁছে দেব?",
        )}
      </h2>
      <p>
        {t(
          "Submit without payment. Availability, preparation charges and delivery cost will be confirmed before you accept a final quote.",
          "পেমেন্ট ছাড়াই অনুরোধ পাঠান। চূড়ান্ত দাম গ্রহণের আগে প্রাপ্যতা, প্রস্তুতির খরচ ও ডেলিভারি চার্জ নিশ্চিত করা হবে।",
        )}
      </p>
      <div className="basket-actions">
        <button
          type="button"
          onClick={async () => {
            setBusy(true);
            try {
              await commerceApi("/commerce/cart", token, "PUT", {
                items: lines,
              });
              setStatus(
                t(
                  "Basket saved to your account.",
                  "ঝুড়ি আপনার অ্যাকাউন্টে সংরক্ষিত হয়েছে।",
                ),
              );
            } catch (e) {
              setStatus((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy || !lines.length}
        >
          {t("Save basket", "ঝুড়ি সংরক্ষণ করুন")}
        </button>
        {savedCart.length > 0 && (
          <button type="button" onClick={() => writeBasket(savedCart)}>
            {t("Restore saved basket", "সংরক্ষিত ঝুড়ি ফিরিয়ে আনুন")}
          </button>
        )}
      </div>
      <form
        onChange={() => setReview(null)}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setStatus("");
          try {
            setReview(
              await commerceApi<Review>(
                "/commerce/order-requests/review",
                token,
                "POST",
                payload,
              ),
            );
            key.current = crypto.randomUUID();
          } catch (e) {
            setStatus((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="fields">
          {fields.map(([key, en, b, autocomplete]) => (
            <label key={key}>
              {t(en, b)}
              <input
                name={key}
                autoComplete={autocomplete}
                type={key === "phone" ? "tel" : "text"}
                required={key !== "postal_code"}
                maxLength={key === "address_line" ? 300 : 120}
                list={
                  key === "area"
                    ? "dhaka-areas"
                    : key === "city"
                      ? "delivery-cities"
                      : undefined
                }
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <datalist id="dhaka-areas">
          {dhakaAreas.map((a) => (
            <option value={a} key={a} />
          ))}
        </datalist>
        <datalist id="delivery-cities">
          {[
            "Dhaka",
            "Chattogram",
            "Sylhet",
            "Khulna",
            "Rajshahi",
            "Barishal",
            "Rangpur",
            "Mymensingh",
            "Gazipur",
            "Narayanganj",
          ].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <label>
          {t("Delivery instructions (optional)", "ডেলিভারির নির্দেশনা (ঐচ্ছিক)")}
          <textarea
            maxLength={1000}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </label>
        <label>
          {t(
            "Cleaning / cutting instructions (optional)",
            "পরিষ্কার / কাটার নির্দেশনা (ঐচ্ছিক)",
          )}
          <textarea
            maxLength={500}
            placeholder={t(
              "For example: medium curry pieces; keep the fish head separate",
              "যেমন: মাঝারি কারি কাট; মাছের মাথা আলাদা রাখুন",
            )}
            value={form.preparation_notes}
            onChange={(e) =>
              setForm({ ...form, preparation_notes: e.target.value })
            }
          />
        </label>
        <p className="payment-off">
          {t(
            "Payments are disabled. Do not send money or enter transaction details.",
            "পেমেন্ট বন্ধ আছে। টাকা পাঠাবেন না বা লেনদেনের তথ্য দেবেন না।",
          )}
        </p>
        {!review && (
          <button className="primary" disabled={busy || !lines.length}>
            {busy
              ? t("Checking…", "যাচাই হচ্ছে…")
              : t("Review my request", "অনুরোধ পর্যালোচনা করুন")}
          </button>
        )}
        {review && (
          <div className="order-review">
            <h3>{t("Before you submit", "পাঠানোর আগে")}</h3>
            <p>
              {t("Priced items estimate", "দাম জানা পণ্যের আনুমানিক মোট")}:{" "}
              <strong>{money(review.subtotal_bdt, bn)}</strong>
            </p>
            {review.lines.some((l) => l.price_pending) && (
              <p>
                {t(
                  "Some items need a price quote; they are not included in this estimate.",
                  "কিছু পণ্যের দাম নিশ্চিত করা বাকি; সেগুলো এই হিসাবে নেই।",
                )}
              </p>
            )}
            <p>
              {t(
                "Preparation and delivery: quote pending. This is not a final total or a confirmed delivery slot.",
                "প্রস্তুতি ও ডেলিভারি: দাম নিশ্চিত করা বাকি। এটি চূড়ান্ত মোট বা নিশ্চিত ডেলিভারির সময় নয়।",
              )}
            </p>
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const o = await commerceApi<{
                    id: string;
                    order_number: string;
                  }>(
                    "/commerce/order-requests",
                    token,
                    "POST",
                    payload,
                    key.current,
                  );
                  setOrder(o);
                  clear();
                } catch (e) {
                  setStatus((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy
                ? t("Submitting…", "পাঠানো হচ্ছে…")
                : t(
                    "Submit order request — no payment",
                    "অর্ডারের অনুরোধ পাঠান — পেমেন্ট ছাড়া",
                  )}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setReview(null)}
            >
              {t("Edit delivery details", "ডেলিভারির তথ্য বদলান")}
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
    return p ? n + lineTotal(p, l) : n;
  }, 0);
  return (
    <main className="wrap commerce-page">
      <nav className="market-nav">
        <Link className="wordmark" href="/">
          TRIPPY Delivery
        </Link>
        <Link href="/groceries">{t("Continue shopping", "বাজার করুন")}</Link>
        <Link href="/photo-credits">{t("Photo credits", "ছবির কৃতিত্ব")}</Link>
        <button onClick={() => setBn(!bn)}>{bn ? "English" : "বাংলা"}</button>
      </nav>
      <p className="kicker">{t("YOUR MARKET BASKET", "আপনার বাজারের ঝুড়ি")}</p>
      <h1>
        {t(
          "Your market basket. Ready for the next step.",
          "আপনার বাজারের ঝুড়ি। পরের ধাপে এগিয়ে যান।",
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
            return (
              <article className="basket-line" key={l.sku}>
                {p?.details.image && (
                  <img src={p.details.image} alt="" width="76" height="76" />
                )}
                <div>
                  <h3>{p ? (bn ? p.name_bn : p.name_en) : l.sku}</h3>
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
                        {[
                          ["whole", "Whole / raw", "আস্ত / কাঁচা"],
                          ["cleaned", "Cleaned / washed", "পরিষ্কার / ধোয়া"],
                          ["cut", "Cut & cleaned", "কাটা ও পরিষ্কার"],
                          ["custom", "Custom instructions", "আপনার নির্দেশনা"],
                        ].map(([id, en, b]) => (
                          <option key={id} value={id}>
                            {t(en, b)}
                          </option>
                        ))}
                      </select>
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
              "Preparation and delivery charges are confirmed with your final quote.",
              "প্রস্তুতি ও ডেলিভারির চার্জ চূড়ান্ত দামের সাথে নিশ্চিত করা হবে।",
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
