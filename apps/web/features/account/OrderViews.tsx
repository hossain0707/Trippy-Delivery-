"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { commerceApi, money, type Product } from "@/lib/commerce";
import { orderLabel, orderStage, paymentLabel } from "@/lib/order-status.mjs";
import { ProductImage } from "../commerce/ProductImage";
import { productPhoto, preparationOptions } from "@/lib/preparation.mjs";
import { API_BASE } from "@/lib/api";
import { startPolling } from "@/lib/polling.mjs";
export type CustomerOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  amount_bdt: string;
  delivery_deadline: string;
  created_at: string;
  checkout_data?: {
    mode?: string;
    quote_pending?: boolean;
    quote_note?: string;
    quoted_total_bdt?: string;
    instructions?: string;
    preparation_notes?: string;
    calculation?: {
      item_subtotal_bdt?: string;
      preparation_fee_bdt?: string;
      delivery_fee_bdt?: string;
      discount_bdt?: string;
    };
    item_snapshots?: {
      sku: string;
      name_en: string;
      name_bn?: string;
      unit?: string;
      preparation?: string;
    }[];
  };
  items?: {
    id: string;
    sku: string;
    quantity: string;
    preparation: string;
    amount_bdt: string;
  }[];
  history?: { id: string; event: string; created_at: string }[];
};
export function OrderBadge({
  status,
  bn = false,
}: {
  status: string;
  bn?: boolean;
}) {
  return (
    <span className={"co-badge co-" + status}>{orderLabel(status, bn)}</span>
  );
}
export function OrderPhotos({
  order,
  products,
}: {
  order: CustomerOrder;
  products: Product[];
}) {
  return (
    <div className="co-photos">
      {order.checkout_data?.item_snapshots?.slice(0, 3).map((item) => {
        const p = products.find((p) => p.sku === item.sku);
        return p ? (
          <ProductImage
            key={item.sku}
            photo={productPhoto(
              p,
              preparationOptions(p).find(
                (option) => option.id === item.preparation,
              ),
              [],
              API_BASE,
            )}
            alt={item.name_en + " · product preview"}
            width={64}
            height={64}
          />
        ) : (
          <span key={item.sku}>{item.name_en}</span>
        );
      })}
    </div>
  );
}
export function OrderProgress({
  status,
  bn = false,
}: {
  status: string;
  bn?: boolean;
}) {
  const stage = orderStage(status);
  if (stage < 0) return null;
  return (
    <ol
      className="co-progress"
      aria-label={bn ? "অর্ডারের অগ্রগতি" : "Order progress"}
    >
      {[
        bn ? "পাওয়া গেছে" : "Received",
        bn ? "নিশ্চিত" : "Confirmed",
        bn ? "প্রস্তুতি" : "Preparing",
        bn ? "ডেলিভারি" : "On delivery",
        bn ? "সম্পন্ন" : "Delivered",
      ].map((label, i) => (
        <li
          key={i}
          className={i <= stage ? "complete" : ""}
          aria-current={i === stage ? "step" : undefined}
        >
          <span>{i < stage ? "✓" : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
export function OrderList({
  token,
  bn = false,
  compact = false,
}: {
  token: string;
  bn?: boolean;
  compact?: boolean;
}) {
  const [group, setGroup] = useState("active");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: CustomerOrder[]; total: number }>({
    items: [],
    total: 0,
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [updated, setUpdated] = useState("");
  const t = (en: string, b: string) => (bn ? b : en);
  useEffect(() => {
    commerceApi<Product[]>("/groceries/products")
      .then(setProducts)
      .catch(() => {});
  }, []);
  useEffect(() => {
    const controller = startPolling({
      load: async () => {
        const result = await commerceApi<{
          items: CustomerOrder[];
          total: number;
        }>(
          "/account/orders?group=" +
            group +
            "&q=" +
            encodeURIComponent(q) +
            "&page=" +
            page,
          token,
        );
        if (compact && result.total === 0)
          return commerceApi<{ items: CustomerOrder[]; total: number }>(
            "/account/orders?group=history",
            token,
          );
        return result;
      },
      onValue: (value) => {
        setData(value);
        setError("");
        setLoading(false);
        setUpdated(new Date().toLocaleTimeString(bn ? "bn-BD" : "en-BD"));
      },
      onError: (e) => {
        setError(e.message);
        setLoading(false);
      },
      shouldPoll: () => !document.hidden,
      delayMs: 20000,
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
  }, [token, group, q, page, version, bn, compact]);
  const change = useCallback((g: string) => {
    setGroup(g);
    setPage(1);
    setData({ items: [], total: 0 });
    setLoading(true);
  }, []);
  return (
    <section className="co-card">
      <div className="co-card-heading">
        <h2>
          {compact
            ? t("Recent orders", "সাম্প্রতিক অর্ডার")
            : t("My orders & history", "আমার অর্ডার ও ইতিহাস")}
        </h2>
        <button className="secondary" onClick={() => setVersion((v) => v + 1)}>
          {t("Refresh", "রিফ্রেশ")}
        </button>
      </div>
      {!compact && (
        <>
          <nav className="co-tabs">
            {[
              ["active", "Active orders", "চলমান অর্ডার"],
              ["history", "Order history", "অর্ডারের ইতিহাস"],
              ["archive", "Preview archive", "প্রিভিউ আর্কাইভ"],
            ].map(([id, en, b]) => (
              <button
                key={id}
                aria-pressed={group === id}
                onClick={() => change(id)}
              >
                {t(en, b)}
              </button>
            ))}
          </nav>
          <label>
            <span className="sr-only">
              {t("Search order number", "অর্ডার নম্বর খুঁজুন")}
            </span>
            <input
              type="search"
              placeholder={t("Search by order number…", "অর্ডার নম্বর দিয়ে খুঁজুন…")}
              value={q}
              maxLength={100}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
                setLoading(true);
              }}
            />
          </label>
        </>
      )}
      <p role="status">
        {error || (loading ? t("Loading orders…", "অর্ডার লোড হচ্ছে…") : "")}
      </p>
      {!loading && !data.items.length && (
        <div className="co-empty">
          <h3>{t("No orders here yet", "এখনো কোনো অর্ডার নেই")}</h3>
          <Link className="primary" href="/groceries">
            {t("Browse groceries", "বাজার করুন")}
          </Link>
        </div>
      )}
      {(compact ? data.items.slice(0, 1) : data.items).map((o) => (
        <article className="co-order-card" key={o.id}>
          <div className="co-card-heading">
            <div>
              <strong>{o.order_number || "Order"}</strong>
              <small>
                {new Date(o.created_at).toLocaleString(bn ? "bn-BD" : "en-BD", {
                  timeZone: "Asia/Dhaka",
                })}
              </small>
            </div>
            <OrderBadge status={o.status} bn={bn} />
          </div>
          <OrderPhotos order={o} products={products} />
          <div className="co-card-heading">
            <div>
              <strong>{money(o.amount_bdt, bn)}</strong>
              <small>
                {o.checkout_data?.quote_pending &&
                !["cancelled", "rejected", "failed", "preview"].includes(
                  o.status,
                )
                  ? t(
                      "Final price approval required",
                      "চূড়ান্ত দাম অনুমোদন প্রয়োজন",
                    )
                  : paymentLabel(
                      o.status,
                      o.payment_status,
                      o.payment_method,
                      bn,
                    )}
              </small>
            </div>
            <Link
              className="primary"
              href={"/orders?id=" + encodeURIComponent(o.id)}
            >
              {o.status === "quoted"
                ? t("Review final price", "চূড়ান্ত দাম দেখুন")
                : t("View & track order", "অর্ডার দেখুন ও ট্র্যাক করুন")}
            </Link>
          </div>
        </article>
      ))}
      {!compact && (
        <nav className="co-pagination">
          <span>
            {data.total} {t("orders", "টি অর্ডার")}
          </span>
          <button
            className="secondary"
            disabled={page === 1}
            onClick={() => {
              setPage((p) => p - 1);
              setLoading(true);
            }}
          >
            ←
          </button>
          <span>{page}</span>
          <button
            className="secondary"
            disabled={page * 12 >= data.total}
            onClick={() => {
              setPage((p) => p + 1);
              setLoading(true);
            }}
          >
            →
          </button>
        </nav>
      )}
      <p className="co-update-note">
        {error
          ? t(
              "Updates unavailable. Retry to reconnect.",
              "আপডেট পাওয়া যাচ্ছে না। আবার চেষ্টা করুন।",
            )
          : updated
            ? t(
                "Updates automatically · Last checked ",
                "স্বয়ংক্রিয় আপডেট · শেষ যাচাই ",
              ) + updated
            : ""}
      </p>
    </section>
  );
}
