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
              Total: <strong>{money(order.amount_bdt)}</strong>
            </p>
            <p>
              Proposed delivery:{" "}
              {new Date(order.delivery_deadline).toLocaleString("en-BD", {
                timeZone: "Asia/Dhaka",
              })}{" "}
              (Bangladesh time)
            </p>
          </div>
          <h3>Items</h3>
          {order.items.map((l) => (
            <p key={l.id}>
              {l.sku} · {l.quantity} · {l.preparation} · {money(l.amount_bdt)}
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
            Payment confirmation is separate from delivery progress. Contact
            support if a transfer needs investigation.
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
