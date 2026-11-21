"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GoogleAccess, useCredential } from "@/features/account/GoogleAccess";
import { commerceApi, money } from "@/lib/commerce";
type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  amount_bdt: string;
  delivery_deadline: string;
  checkout_data?: {
    mode?: string;
    quoted_total_bdt?: string;
    quote_note?: string;
    instructions?: string;
    preparation_notes?: string;
    items?: { sku: string; name_en: string; name_bn: string }[];
  };
  history: { id: string; event: string; created_at: string }[];
  items: {
    id: string;
    sku: string;
    quantity: string;
    preparation: string;
    amount_bdt: string;
  }[];
};
function Record({ bn }: { bn: boolean }) {
  const t = (en: string, b: string) => (bn ? b : en);
  const token = useCredential();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setError("Open an order from your account history.");
      return;
    }
    commerceApi<Order>("/commerce/orders/" + encodeURIComponent(id), token)
      .then((o) => {
        if (active) setOrder(o);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [token]);
  const requestOnly = order?.checkout_data?.mode === "request_only";
  return (
    <section className="panel">
      <p role="status">{error}</p>
      {order && (
        <>
          <p className="kicker">ORDER {order.order_number || order.id}</p>
          <h2>
            {(
              {
                requested: t("Request received", "অনুরোধ গৃহীত"),
                reviewing: t("Under review", "পর্যালোচনা চলছে"),
                quoted: t("Your quote is ready", "আপনার চূড়ান্ত দাম প্রস্তুত"),
                confirmed: t("Order confirmed", "অর্ডার নিশ্চিত"),
                preparing: t("Being prepared", "প্রস্তুত করা হচ্ছে"),
                packed: t("Packed", "প্যাক করা হয়েছে"),
                assigned: t("Courier assigned", "কুরিয়ার নির্ধারিত"),
                out_for_delivery: t("Out for delivery", "ডেলিভারির পথে"),
                delivered: t("Delivered", "ডেলিভারি সম্পন্ন"),
                cancelled: t("Cancelled", "বাতিল"),
                rejected: t("Not accepted", "গ্রহণ করা হয়নি"),
              } as Record<string, string>
            )[order.status] || order.status.replaceAll("_", " ")}
          </h2>
          <div className="order-summary">
            {!requestOnly && (
              <p>
                Payment method: <strong>{order.payment_method}</strong>
              </p>
            )}
            <p>
              {t("Payment status:", "পেমেন্টের অবস্থা:")}{" "}
              <strong>
                {requestOnly
                  ? t("No payment collected", "কোনো পেমেন্ট নেওয়া হয়নি")
                  : order.payment_status.replaceAll("_", " ")}
              </strong>
            </p>
            <p>
              {requestOnly && !order.checkout_data?.quoted_total_bdt ? "Priced items estimate: " : "Total: "}
              <strong>{money(order.amount_bdt)}</strong>
            </p>
            {!requestOnly && (
              <p>
                Proposed delivery:{" "}
                {new Date(order.delivery_deadline).toLocaleString("en-BD", {
                  timeZone: "Asia/Dhaka",
                })}{" "}
                (Bangladesh time)
              </p>
            )}
            {requestOnly && !order.checkout_data?.quoted_total_bdt && (
              <p>
                Request received. Stock, preparation charges and delivery are
                awaiting confirmation. No payment is collected and no delivery
                slot is promised yet.
              </p>
            )}
          </div>
          <h3>{t("Items", "পণ্য")}</h3>
          {order.items.map((l) => (
            <p key={l.id}>
              {order.checkout_data?.items?.find((i) => i.sku === l.sku)
                ?.name_en || l.sku}{" "}
              · {l.quantity} · {l.preparation} · {money(l.amount_bdt)}
            </p>
          ))}
          {requestOnly && order.status === "quoted" && (
            <div className="order-review">
              <h3>Your final quote</h3>
              <p>
                {money(
                  order.checkout_data?.quoted_total_bdt || order.amount_bdt,
                )}
              </p>
              <p>{order.checkout_data?.quote_note}</p>
              <p>
                No payment is collected here. Accept only if you agree to the
                stated quote and arrangements.
              </p>
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await commerceApi(
                      "/commerce/order-requests/" + order.id + "/update",
                      token,
                      "POST",
                      {
                        status: "confirmed",
                        note: "Customer accepted the final quote",
                        accepted_total_bdt:
                          order.checkout_data?.quoted_total_bdt,
                      },
                    );
                    setOrder({ ...order, status: "confirmed" });
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Accept quote & confirm order
              </button>
            </div>
          )}
          {requestOnly && (
            <>
              <h3>Your instructions</h3>
              <p>
                {order.checkout_data?.instructions ||
                  "No additional delivery instructions."}
              </p>
              <p>
                {order.checkout_data?.preparation_notes ||
                  "Preparation choices are recorded against each item."}
              </p>
              {![
                "cancelled",
                "rejected",
                "delivered",
                "out_for_delivery",
              ].includes(order.status) && (
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await commerceApi(
                        "/commerce/order-requests/" + order.id + "/update",
                        token,
                        "POST",
                        { status: "cancelled", note: "Cancelled by customer" },
                      );
                      setOrder({ ...order, status: "cancelled" });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Cancel request
                </button>
              )}
            </>
          )}
          <h3>{t("Order updates", "অর্ডারের অগ্রগতি")}</h3>
          <ol className="event-timeline">
            {order.history.map((e) => (
              <li key={e.id}>
                <strong>{e.event.replaceAll("_", " ")}</strong>
                <span>
                  {new Date(e.created_at).toLocaleString("en-BD", {
                    timeZone: "Asia/Dhaka",
                  })}
                </span>
              </li>
            ))}
          </ol>
          <p>
            {t(
              "No online payment is collected. Contact support about availability, your quote or delivery.",
              "অনলাইন পেমেন্ট নেওয়া হচ্ছে না। প্রাপ্যতা, চূড়ান্ত দাম বা ডেলিভারি সম্পর্কে সাহায্য নিন।",
            )}
          </p>
          <Link href="/support">Get help with this order</Link>
        </>
      )}
    </section>
  );
}
export function OrderTracking() {
  const [bn, setBn] = useState(false);
  return (
    <main className="wrap commerce-page">
      <nav className="market-nav">
        <Link className="wordmark" href="/">
          TRIPPY Delivery
        </Link>
        <Link href="/account">{bn ? "আমার অ্যাকাউন্ট" : "My account"}</Link>
        <button onClick={() => setBn(!bn)}>{bn ? "English" : "বাংলা"}</button>
      </nav>
      <h1>{bn ? "আপনার অর্ডারের প্রতিটি ধাপ।" : "Your order, every step."}</h1>
      <GoogleAccess>
        <Record bn={bn} />
      </GoogleAccess>
    </main>
  );
}
