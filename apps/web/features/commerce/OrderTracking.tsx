"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GoogleAccess, useCredential } from "@/features/account/GoogleAccess";
import { commerceApi, money, type Product } from "@/lib/commerce";
import { startPolling } from "@/lib/polling.mjs";
import { canCancelOrder, paymentLabel } from "@/lib/order-status.mjs";
import {
  OrderBadge,
  OrderProgress,
  OrderPhotos,
  type CustomerOrder,
} from "@/features/account/OrderViews";
function Record() {
  const token = useCredential();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [refresh, setRefresh] = useState(0);
  const [updated, setUpdated] = useState("");
  const [bn, setBn] = useState(false);
  const [actionError, setActionError] = useState("");
  const t = (en: string, b: string) => (bn ? b : en);
  useEffect(() => {
    commerceApi<Product[]>("/groceries/products")
      .then(setProducts)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setError("Open an order from My Account → My orders.");
      return;
    }
    const controller = startPolling({
      load: () =>
        commerceApi<CustomerOrder>(
          "/commerce/orders/" + encodeURIComponent(id),
          token,
        ),
      onValue: (value) => {
        setOrder(value);
        setError("");
        setUpdated(new Date().toLocaleTimeString(bn ? "bn-BD" : "en-BD"));
      },
      onError: (e) => setError(e.message),
      shouldPoll: () => !document.hidden && !busyRef.current,
      delayMs: 15000,
    });
    const focus = () => {
      void controller.refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      controller.stop();
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [token, refresh, bn]);
  async function mutate(action: string) {
    if (!order || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await commerceApi(
        "/commerce/cod-orders/" + order.id + "/" + action,
        token,
        "POST",
        action === "accept"
          ? { accepted_total_bdt: order.amount_bdt }
          : undefined,
      );
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
      setRefresh((v) => v + 1);
    }
  }
  return (
    <section className="co-tracking">
      <div className="co-card-heading">
        <Link href="/account?section=orders">
          ← {t("My orders", "আমার অর্ডার")}
        </Link>
        <div className="actions">
          <button className="secondary" onClick={() => setBn(!bn)}>
            {bn ? "English" : "বাংলা"}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setRefresh((v) => v + 1)}
          >
            {t("Refresh", "রিফ্রেশ")}
          </button>
        </div>
      </div>
      <p role="status" className={error || actionError ? "co-warning" : ""}>
        {actionError || error}
      </p>
      {!order && !error && <p>{t("Loading your order…", "অর্ডার লোড হচ্ছে…")}</p>}
      {order && (
        <>
          <header className="co-heading">
            <div>
              <p className="kicker">{t("YOUR ORDER", "আপনার অর্ডার")}</p>
              <h1>{order.order_number}</h1>
            </div>
            <OrderBadge status={order.status} bn={bn} />
          </header>
          <OrderProgress status={order.status} bn={bn} />
          <p className="co-notice">
            {order.status === "awaiting_purchase"
              ? t(
                  "The store accepted your order and is purchasing the goods. Preparation starts after receipt is verified.",
                  "দোকান অর্ডার গ্রহণ করেছে এবং বাজার করছে। পণ্য পাওয়া যাচাইয়ের পরে প্রস্তুতি শুরু হবে।",
                )
              : order.status === "placed"
                ? t(
                    "Your order reached the store. It is awaiting availability review.",
                    "দোকান অর্ডার পেয়েছে। মজুত পর্যালোচনা বাকি।",
                  )
                : t(
                    "Order progress updates automatically on this page.",
                    "এই পাতায় অর্ডারের অগ্রগতি স্বয়ংক্রিয়ভাবে আপডেট হয়।",
                  )}
          </p>
          <div className="co-grid">
            <section className="co-card">
              <h2>{t("Order items", "অর্ডারের পণ্য")}</h2>
              <OrderPhotos order={order} products={products} />
              {order.items?.map((l) => (
                <div className="co-line" key={l.id}>
                  <div>
                    <strong>
                      {order.checkout_data?.item_snapshots?.find(
                        (s) => s.sku === l.sku,
                      )?.[bn ? "name_bn" : "name_en"] || l.sku}
                    </strong>
                    <small>
                      {Number(l.quantity)}{" "}
                      {
                        order.checkout_data?.item_snapshots?.find(
                          (s) => s.sku === l.sku,
                        )?.unit
                      }{" "}
                      · {l.preparation.replaceAll("_", " ")}
                    </small>
                  </div>
                  <strong>{money(l.amount_bdt, bn)}</strong>
                </div>
              ))}
              <h3>{t("Order updates", "অর্ডারের আপডেট")}</h3>
              <ol className="co-history">
                {order.history?.map((h) => (
                  <li key={h.id}>
                    <strong>{h.event.replaceAll("_", " ")}</strong>
                    <small>
                      {new Date(h.created_at).toLocaleString(
                        bn ? "bn-BD" : "en-BD",
                        { timeZone: "Asia/Dhaka" },
                      )}
                    </small>
                  </li>
                ))}
              </ol>
            </section>
            <div>
              <section className="co-card">
                <h2>{t("Order summary", "অর্ডারের হিসাব")}</h2>
                {order.checkout_data?.quoted_total_bdt && (
                  <p className="co-update-note">
                    {t(
                      "Initial calculation below; the approved final total and store note take precedence.",
                      "নিচে প্রাথমিক হিসাব; অনুমোদিত চূড়ান্ত দাম ও দোকানের বিবরণ প্রযোজ্য।",
                    )}
                  </p>
                )}
                {order.checkout_data?.calculation && (
                  <dl className="co-costs">
                    {[
                      [
                        t("Items", "পণ্য"),
                        order.checkout_data.calculation.item_subtotal_bdt,
                      ],
                      [
                        t("Preparation", "প্রস্তুতি"),
                        order.checkout_data.calculation.preparation_fee_bdt,
                      ],
                      [
                        t("Delivery", "ডেলিভারি"),
                        order.checkout_data.calculation.delivery_fee_bdt,
                      ],
                      [
                        t("Discount", "ছাড়"),
                        order.checkout_data.calculation.discount_bdt,
                      ],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v != null ? money(v, bn) : "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="co-total">
                  <strong>
                    {order.checkout_data?.quote_pending &&
                    order.status !== "quoted"
                      ? t("Known estimate", "জানা আনুমানিক মূল্য")
                      : t("Total", "মোট")}
                  </strong>
                  <strong>{money(order.amount_bdt, bn)}</strong>
                </div>
                <p>{order.checkout_data?.quote_note}</p>
                <div className="co-payment">
                  <strong>{t("Cash on delivery", "ক্যাশ অন ডেলিভারি")}</strong>
                  <p>
                    {paymentLabel(
                      order.status,
                      order.payment_status,
                      order.payment_method,
                      bn,
                    )}
                  </p>
                </div>
                {order.status !== "preview" && (
                  <p className="co-update-note">
                    {t(
                      "Proposed delivery (not a confirmed appointment): ",
                      "প্রস্তাবিত ডেলিভারি (নিশ্চিত সময় নয়): ",
                    )}
                    {new Date(order.delivery_deadline).toLocaleString(
                      bn ? "bn-BD" : "en-BD",
                      { timeZone: "Asia/Dhaka" },
                    )}
                  </p>
                )}
              </section>
              {order.checkout_data?.mode === "cod_order" &&
                order.status === "quoted" && (
                  <section className="co-card co-approval">
                    <h2>
                      {t("Approve the final price", "চূড়ান্ত দাম অনুমোদন করুন")}
                    </h2>
                    <p>
                      {t(
                        "Review the store's price and notes. Your order can proceed after approval.",
                        "দোকানের দাম ও নির্দেশনা দেখুন। অনুমোদনের পরে অর্ডার এগোবে।",
                      )}
                    </p>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => void mutate("accept")}
                    >
                      {t("Accept ", "অনুমোদন করুন ")}
                      {money(order.amount_bdt, bn)}
                    </button>
                  </section>
                )}
              {order.checkout_data?.mode === "cod_order" &&
                canCancelOrder(order.status) && (
                  <section className="co-card">
                    <p>
                      {t(
                        "You can cancel before preparation starts.",
                        "প্রস্তুতি শুরুর আগে বাতিল করতে পারেন।",
                      )}
                    </p>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void mutate("cancel")}
                    >
                      {t("Cancel order", "অর্ডার বাতিল")}
                    </button>
                  </section>
                )}
              <Link href="/support">
                {t("Get help with this order →", "এই অর্ডারের সহায়তা →")}
              </Link>
            </div>
          </div>
          <p className="co-update-note">
            {error
              ? t(
                  "Updates paused—retry to reconnect.",
                  "আপডেট বন্ধ—আবার চেষ্টা করুন।",
                )
              : updated
                ? t("Last checked ", "শেষ যাচাই ") + updated
                : ""}
          </p>
        </>
      )}
    </section>
  );
}
export function OrderTracking() {
  return (
    <main className="co-page">
      <nav className="co-topbar">
        <Link className="wordmark" href="/">
          TRIPPY Delivery
        </Link>
        <Link href="/account?section=orders">My orders</Link>
      </nav>
      <GoogleAccess>
        <Record />
      </GoogleAccess>
    </main>
  );
}
