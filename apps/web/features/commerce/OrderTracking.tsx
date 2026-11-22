"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { GoogleAccess, useCredential } from "@/features/account/GoogleAccess";
import { commerceApi, money } from "@/lib/commerce";
type Order = {
  checkout_data?: {
    mode?: string;
    quote_pending?: boolean;
    quote_note?: string;
    item_snapshots?: { sku: string; name_en: string }[];
  };
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  amount_bdt: string;
  delivery_deadline: string;
  history: { id: string; event: string; created_at: string }[];
  items: {
    id: string;
    sku: string;
    quantity: string;
    preparation: string;
    amount_bdt: string;
  }[];
};
function Record() {
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
  return (
    <section className="panel">
      <p role="status">{error}</p>
      {order && (
        <>
          <p className="kicker">ORDER {order.order_number || order.id}</p>
          <h2>
            {order.status === "placed"
              ? "Pending review"
              : order.status.replaceAll("_", " ")}
          </h2>
          <div className="order-summary">
            <p>
              Payment method: <strong>{order.payment_method}</strong>
            </p>
            <p>
              Payment status:{" "}
              <strong>{order.payment_status.replaceAll("_", " ")}</strong>
            </p>
            <p>
              {order.checkout_data?.quote_pending && order.status !== "quoted"
                ? "Known estimate (not final)"
                : "Total"}
              : <strong>{money(order.amount_bdt)}</strong>
            </p>
            {order.status !== "preview" && (
              <p>
                Proposed delivery:{" "}
                {new Date(order.delivery_deadline).toLocaleString("en-BD", {
                  timeZone: "Asia/Dhaka",
                })}{" "}
                (Bangladesh time)
              </p>
            )}
          </div>
          {order.checkout_data?.mode === "cod_order" &&
            order.status === "quoted" && (
              <section className="checkout-warning">
                <h3>Accept your final cash-on-delivery total</h3>
                <p>{order.checkout_data.quote_note}</p>
                <p>
                  Pay {money(order.amount_bdt)} to the courier on delivery.
                  Preparation starts after you accept.
                </p>
                <button
                  className="primary"
                  onClick={async () => {
                    try {
                      await commerceApi(
                        "/commerce/cod-orders/" + order.id + "/accept",
                        token,
                        "POST",
                        { accepted_total_bdt: order.amount_bdt },
                      );
                      setOrder(
                        await commerceApi<Order>(
                          "/commerce/orders/" + order.id,
                          token,
                        ),
                      );
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Accept final total
                </button>
              </section>
            )}
          {order.checkout_data?.mode === "cod_order" &&
            ["placed", "pending_review", "quoted", "confirmed"].includes(
              order.status,
            ) && (
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await commerceApi(
                      "/commerce/cod-orders/" + order.id + "/cancel",
                      token,
                      "POST",
                    );
                    setOrder(
                      await commerceApi<Order>(
                        "/commerce/orders/" + order.id,
                        token,
                      ),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                Cancel order before preparation
              </button>
            )}
          <h3>Items</h3>
          {order.items.map((l) => (
            <p key={l.id}>
              {order.checkout_data?.item_snapshots?.find((i) => i.sku === l.sku)
                ?.name_en || l.sku}{" "}
              · {l.quantity} · {l.preparation} · {money(l.amount_bdt)}
            </p>
          ))}
          <h3>Order updates</h3>
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
            {order.status === "preview"
              ? "Preview order saved. No payment, stock reservation or delivery is scheduled."
              : "Payment confirmation is separate from delivery progress. Contact support for assistance."}
          </p>
          <Link href="/support">Get help with this order</Link>
        </>
      )}
    </section>
  );
}
export function OrderTracking() {
  return (
    <main className="wrap commerce-page">
      <nav className="market-nav">
        <Link className="wordmark" href="/">
          TRIPPY Delivery
        </Link>
        <Link href="/account">My account</Link>
      </nav>
      <h1>Your order, every step.</h1>
      <GoogleAccess>
        <Record />
      </GoogleAccess>
    </main>
  );
}
