"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCredential } from "../account/GoogleAccess";
import { CommerceConsole } from "./CommerceConsole";
import { AvailabilityControls } from "./AvailabilityControls";
import { orderLabel } from "@/lib/order-status.mjs";
import { commerceApi, money, type Product } from "@/lib/commerce";
import { productPhoto } from "@/lib/preparation.mjs";
import { ProductImage } from "../commerce/ProductImage";
import { API_BASE } from "@/lib/api";
import { recordsForView, type AdminRecords } from "@/lib/admin-records.mjs";

type Address = {
  name?: string;
  phone?: string;
  address_line?: string;
  area?: string;
  city?: string;
};
type RecordRow = {
  id: string;
  order_number?: string;
  customer_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  area?: string;
  status?: string;
  payment_status?: string;
  payment_method?: string;
  amount_bdt?: string;
  created_at?: string;
  mode?: string;
  quote_pending?: boolean;
  order_count?: number;
  tracking_code?: string;
  sender?: Address;
  recipient?: Address;
  package?: {
    request_only?: boolean;
    form?: string;
    category?: string;
    weight_kg?: number;
    length_cm?: number;
    width_cm?: number;
    height_cm?: number;
  };
  event?: string;
  entity_type?: string;
};
type Detail = RecordRow & {
  destination?: Address;
  checkout_data?: {
    mode?: string;
    quote_pending?: boolean;
    quote_note?: string;
    instructions?: string;
    preparation_notes?: string;
    calculation?: {
      item_subtotal_bdt?: string;
      preparation_fee_bdt?: string;
      delivery_fee_bdt?: string;
      discount_bdt?: string;
      pending?: string[];
    };
    item_snapshots?: {
      sku: string;
      name_en: string;
      name_bn: string;
      unit: string;
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
  checkout_defaults?: Address & {
    instructions?: string;
    preparation_notes?: string;
    payment_method?: string;
  };
  orders?: RecordRow[];
};
type Overview = {
  awaiting_purchase?: number;
  new_orders: number;
  preparing: number;
  out_for_delivery: number;
  cod_to_collect_bdt: string;
  awaiting_final_price: number;
  low_stock: number;
  daily: { day: string; orders: number }[];
  recent_orders: RecordRow[];
};
type Courier = {
  id: string;
  name?: string;
  status: string;
  transport_mode: string;
  details: {
    active?: boolean;
    identity_verified?: boolean;
    documents_verified?: boolean;
    service_cities?: string[];
  };
};
const sections = [
  ["overview", "Overview", "ওভারভিউ", "◫"],
  ["orders", "Orders", "অর্ডার", "▤"],
  ["products", "Products", "পণ্য", "▦"],
  ["parcels", "Parcels", "পার্সেল", "□"],
  ["couriers", "Couriers", "কুরিয়ার", "♧"],
  ["customers", "Customers", "গ্রাহক", "♙"],
  ["settings", "Settings", "সেটিংস", "⚙"],
  ["activity", "Activity", "কার্যক্রম", "◷"],
] as const;
const title = (s: string | null | undefined = "") =>
  (s || "").replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
function Badge({ value = "" }: { value?: string }) {
  return (
    <span className={"aw-badge aw-" + value}>{orderLabel(value) || "—"}</span>
  );
}
function AddressCard({ address }: { address?: Address }) {
  return (
    <p>
      {address?.name}
      <br />
      {address?.phone}
      <br />
      {[address?.address_line, address?.area, address?.city]
        .filter(Boolean)
        .join(", ") || "No saved address"}
    </p>
  );
}
export function AdminWorkspace() {
  const token = useCredential();
  const drawerRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const busyRef = useRef(false);
  const detailRequest = useRef(0);
  const [view, setView] = useState("overview");
  const [bn, setBn] = useState(false);
  const t = (en: string, b: string) => (bn ? b : en);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [archive, setArchive] = useState(false);
  const [version, setVersion] = useState(0);
  const [records, setRecords] = useState<AdminRecords<
    RecordRow,
    Product
  > | null>(null);
  const { items: data, products, total } = recordsForView(records, view);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [busy, setBusy] = useState(false);
  const [settingsTab, setSettingsTab] = useState("payments");
  const [advanced, setAdvanced] = useState(false);
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState("");
  const [cash, setCash] = useState("");
  const [courier, setCourier] = useState("");
  const modalOpen = !!(detail || selectedProduct || detailLoading);
  busyRef.current = busy;
  function editProduct(p: Product) {
    openerRef.current = document.activeElement as HTMLElement;
    setSelectedProduct(p);
  }
  useEffect(() => {
    if (!modalOpen) return;
    const previous = openerRef.current;
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        detailRequest.current++;
        setDetail(null);
        setSelectedProduct(null);
        setDetailLoading(false);
      }
      if (event.key === "Tab") {
        const controls = drawerRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        );
        if (!controls?.length) return;
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [modalOpen]);
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");
    setRecords(null);
    if (view === "overview") setOverview(null);
    const run = async () => {
      if (view === "overview") {
        const value = await commerceApi<Overview>(
          "/admin/workspace/overview",
          token,
        );
        if (active) setOverview(value);
      } else if (!["settings", "couriers"].includes(view)) {
        const result = await commerceApi<{
          items: RecordRow[] & Product[];
          total: number;
        }>(
          "/admin/workspace/records/" +
            view +
            "?q=" +
            encodeURIComponent(query) +
            "&status=" +
            encodeURIComponent(statusFilter) +
            "&page=" +
            page +
            "&archived=" +
            archive,
          token,
        );
        if (active) {
          setRecords({
            view,
            items: view === "products" ? [] : result.items,
            products: view === "products" ? result.items : [],
            total: result.total,
          });
        }
      }
    };
    run()
      .catch((e) => {
        if (active) setMessage(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view, token, query, statusFilter, page, archive, version]);
  useEffect(() => {
    if (!["orders", "parcels"].includes(view)) return;
    let active = true;
    commerceApi<Courier[]>("/admin/workspace/couriers", token)
      .then((v) => {
        if (active) setCouriers(v);
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [token, view]);
  function navigate(next: string) {
    setView(next);
    setPage(1);
    setQ("");
    setQuery("");
    setStatusFilter("");
    detailRequest.current++;
    setDetail(null);
    setSelectedProduct(null);
    setMessage("");
    setAdvanced(false);
  }
  async function open(record: RecordRow, collection = view) {
    if (!modalOpen) openerRef.current = document.activeElement as HTMLElement;
    const request = ++detailRequest.current;
    setDetail(null);
    setSelectedProduct(null);
    setDetailLoading(true);
    setNote("");
    setQuote("");
    setCash("");
    setCourier("");
    try {
      const path =
        collection === "orders"
          ? "/commerce/orders/" + record.id
          : collection === "customers"
            ? "/admin/workspace/customer?subject=" +
              encodeURIComponent(record.id)
            : "/admin/workspace/parcel/" + record.id;
      const result = await commerceApi<Detail>(path, token);
      if (request === detailRequest.current)
        setDetail({ ...record, ...result });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  }
  async function action(path: string, payload: unknown) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await commerceApi<{ status?: string }>(
        path,
        token,
        "POST",
        payload,
      );
      if (detail) await open(detail);
      setVersion((v) => v + 1);
      setMessage(
        result.status
          ? t("Order updated: ", "অর্ডার আপডেট: ") +
              orderLabel(result.status, bn)
          : t("Changes saved.", "পরিবর্তন সংরক্ষিত।"),
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const orderActions: Record<string, string[]> = {
    placed: ["rejected"],
    pending_review: ["rejected"],
    awaiting_purchase: ["rejected"],
    purchased: ["preparing", "rejected"],
    confirmed: ["preparing", "rejected"],
    preparing: ["packed", "failed"],
    packed: ["assigned", "failed"],
    assigned: ["out_for_delivery", "failed"],
    out_for_delivery: ["delivered", "failed"],
    quoted: ["rejected"],
  };
  const parcelActions: Record<string, string[]> = {
    requested: ["reviewing", "confirmed", "cancelled"],
    reviewing: ["confirmed", "cancelled"],
    confirmed: ["assigned", "cancelled"],
    assigned: ["picked_up", "cancelled"],
    picked_up: ["in_transit"],
    in_transit: ["delivered"],
  };
  function ordersTable(rows: RecordRow[]) {
    return (
      <div className="aw-table-scroll">
        <table>
          <thead>
            <tr>
              {[
                t("Order", "অর্ডার"),
                t("Customer / area", "গ্রাহক / এলাকা"),
                t("Total", "মোট"),
                t("Payment", "পেমেন্ট"),
                t("Status", "অবস্থা"),
                "",
              ].map((h, i) => (
                <th key={i} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.order_number || "Order"}</strong>
                  <small>
                    {r.created_at
                      ? new Date(r.created_at).toLocaleDateString(
                          bn ? "bn-BD" : "en-BD",
                        )
                      : ""}
                  </small>
                </td>
                <td>
                  {r.customer_name}
                  <small>{r.area || "—"}</small>
                </td>
                <td>
                  {money(r.amount_bdt || "0", bn)}
                  {r.quote_pending && (
                    <small>
                      {t(
                        "Estimate · final price needed",
                        "আনুমানিক · চূড়ান্ত দাম বাকি",
                      )}
                    </small>
                  )}
                </td>
                <td>
                  <small>
                    {r.payment_method === "cod"
                      ? "Cash on delivery"
                      : title(r.payment_method)}
                  </small>
                  <Badge value={r.payment_status} />
                </td>
                <td>
                  <Badge value={r.status} />
                </td>
                <td>
                  <button
                    className="secondary"
                    onClick={() => {
                      setView("orders");
                      void open(r, "orders");
                    }}
                  >
                    {t("View", "দেখুন")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const selectedTitle = sections.find((s) => s[0] === view);
  return (
    <div className="aw-shell">
      <aside className="aw-sidebar">
        <Link href="/" className="aw-brand">
          TRIPPY <span>Delivery</span>
        </Link>
        <p>{t("OWNER WORKSPACE", "মালিকের কর্মক্ষেত্র")}</p>
        <nav aria-label="Admin sections">
          {sections.map(([id, en, b]) => (
            <button
              key={id}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <span aria-hidden="true">
                <AdminIcon name={id} />
              </span>
              {t(en, b)}
            </button>
          ))}
        </nav>
        <div className="aw-sidebar-footer">
          {t("Owner access only", "শুধু মালিকের প্রবেশাধিকার")}
          <Link href="/groceries">{t("Open storefront ↗", "বাজার খুলুন ↗")}</Link>
        </div>
      </aside>
      <div className="aw-content">
        <header className="aw-topbar">
          <span>{t("Delivery operations", "ডেলিভারি পরিচালনা")}</span>
          <div>
            <span className="aw-live-dot" />{" "}
            {t("Owner access verified", "মালিকের পরিচয় যাচাইকৃত")}
            <button className="secondary" onClick={() => setBn(!bn)}>
              {bn ? "English" : "বাংলা"}
            </button>
          </div>
        </header>
        <main className="aw-main">
          <div className="aw-heading">
            <div>
              <p className="kicker">TRIPPY DELIVERY</p>
              <h1>{bn ? selectedTitle?.[2] : selectedTitle?.[1]}</h1>
              <p>
                {t(
                  "Manage your store and deliveries in one place.",
                  "এক জায়গায় দোকান ও ডেলিভারি পরিচালনা করুন।",
                )}
              </p>
            </div>
            <button
              className="secondary"
              onClick={() => setVersion((v) => v + 1)}
              disabled={loading}
            >
              {t("Refresh", "রিফ্রেশ")}
            </button>
          </div>
          <p
            role="status"
            className={message ? "aw-feedback" : "aw-empty-status"}
          >
            {message}
          </p>
          {loading && (
            <p role="status">{t("Loading records…", "তথ্য লোড হচ্ছে…")}</p>
          )}
          {view === "overview" && overview && (
            <>
              <div className="aw-metrics">
                {[
                  [t("New orders", "নতুন অর্ডার"), overview.new_orders, "orders"],
                  [t("In progress", "চলমান"), overview.preparing, "orders"],
                  [
                    t("On delivery", "ডেলিভারিতে"),
                    overview.out_for_delivery,
                    "orders",
                  ],
                  [
                    t("COD to collect", "আদায়যোগ্য নগদ"),
                    money(overview.cod_to_collect_bdt, bn),
                    "orders",
                  ],
                ].map(([label, value, target]) => (
                  <button
                    key={label}
                    className="aw-metric"
                    onClick={() => navigate(String(target))}
                  >
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <small>{t("View orders →", "অর্ডার দেখুন →")}</small>
                  </button>
                ))}
              </div>
              <div className="aw-overview-grid">
                <section className="aw-card">
                  <div className="aw-card-heading">
                    <h2>{t("Recent orders", "সাম্প্রতিক অর্ডার")}</h2>
                    <button
                      className="text-button"
                      onClick={() => navigate("orders")}
                    >
                      {t("View all →", "সব দেখুন →")}
                    </button>
                  </div>
                  {overview.recent_orders.length ? (
                    ordersTable(overview.recent_orders)
                  ) : (
                    <p>
                      {t("No customer orders yet.", "এখনো গ্রাহকের অর্ডার নেই।")}
                    </p>
                  )}
                </section>
                <div>
                  <section className="aw-card">
                    <h2>{t("Orders this week", "এই সপ্তাহের অর্ডার")}</h2>
                    <div className="aw-chart">
                      {overview.daily.map((d) => (
                        <div key={d.day}>
                          <strong>{d.orders}</strong>
                          <div
                            style={{
                              height: Math.max(
                                3,
                                (120 * d.orders) /
                                  Math.max(
                                    1,
                                    ...overview.daily.map((x) => x.orders),
                                  ),
                              ),
                            }}
                          />
                          <small>
                            {new Date(
                              d.day + "T12:00:00+06:00",
                            ).toLocaleDateString(bn ? "bn-BD" : "en-BD", {
                              weekday: "short",
                              timeZone: "Asia/Dhaka",
                            })}
                          </small>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="aw-card">
                    <h2>{t("Needs attention", "মনোযোগ প্রয়োজন")}</h2>
                    <button
                      className="aw-attention"
                      onClick={() => navigate("orders")}
                    >
                      {overview.awaiting_final_price}{" "}
                      {t(
                        "orders need a final price",
                        "টি অর্ডারের চূড়ান্ত দাম বাকি",
                      )}{" "}
                      →
                    </button>
                    <button
                      className="aw-attention"
                      onClick={() => navigate("orders")}
                    >
                      {overview.awaiting_purchase || 0}{" "}
                      {t(
                        "orders awaiting purchase",
                        "টি অর্ডারের বাজার করা বাকি",
                      )}{" "}
                      →
                    </button>
                    <button
                      className="aw-attention"
                      onClick={() => navigate("products")}
                    >
                      {overview.low_stock}{" "}
                      {t(
                        "products have no verified stock",
                        "টি পণ্যের যাচাইকৃত মজুত নেই",
                      )}{" "}
                      →
                    </button>
                    <p>
                      {t(
                        "COD totals exclude orders awaiting a final quote. Online payments are disabled.",
                        "চূড়ান্ত দাম বাকি থাকা অর্ডার আদায়যোগ্য নগদে অন্তর্ভুক্ত নয়। অনলাইন পেমেন্ট বন্ধ।",
                      )}
                    </p>
                  </section>
                </div>
              </div>
            </>
          )}
          {!["overview", "settings", "couriers"].includes(view) && (
            <section className="aw-card">
              <div className="aw-toolbar">
                <label>
                  <span className="sr-only">
                    {t("Search records", "তথ্য খুঁজুন")}
                  </span>
                  <input
                    type="search"
                    placeholder={t(
                      "Search by name, order or area…",
                      "নাম, অর্ডার বা এলাকা দিয়ে খুঁজুন…",
                    )}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </label>
                {["orders", "parcels"].includes(view) && (
                  <select
                    aria-label="Filter status"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">{t("All statuses", "সব অবস্থা")}</option>
                    {(view === "orders"
                      ? [
                          "placed",
                          "awaiting_purchase",
                          "purchased",
                          "quoted",
                          "confirmed",
                          "preparing",
                          "packed",
                          "assigned",
                          "out_for_delivery",
                          "delivered",
                          "cancelled",
                          "rejected",
                          "failed",
                        ]
                      : [
                          "requested",
                          "reviewing",
                          "confirmed",
                          "assigned",
                          "picked_up",
                          "in_transit",
                          "delivered",
                          "cancelled",
                        ]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {title(s)}
                      </option>
                    ))}
                  </select>
                )}
                {view === "products" && (
                  <select
                    aria-label="Product category"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">All categories</option>
                    {[
                      "vegetables",
                      "fruit",
                      "fish",
                      "meat",
                      "dairy",
                      "bakery",
                      "dry",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                )}
                {view === "orders" && (
                  <label className="aw-check">
                    <input
                      type="checkbox"
                      checked={archive}
                      onChange={(e) => {
                        setArchive(e.target.checked);
                        setPage(1);
                      }}
                    />
                    {t("Include preview archive", "প্রিভিউ আর্কাইভ দেখুন")}
                  </label>
                )}
                {view === "products" && (
                  <button
                    className="primary"
                    onClick={() =>
                      editProduct({
                        sku: "",
                        name_en: "",
                        name_bn: "",
                        category: "fresh",
                        unit: "kg",
                        price_bdt: "0",
                        processing_fee_bdt: "0",
                        stock_qty: "0",
                        active: true,
                        price_approved: false,
                        details: {},
                      })
                    }
                  >
                    + {t("Add product", "পণ্য যোগ করুন")}
                  </button>
                )}
              </div>
              {view === "orders" && ordersTable(data)}
              {view === "products" && (
                <div className="aw-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Product",
                          "Category",
                          "Price",
                          "Verified stock",
                          "Status",
                          "",
                        ].map((h, i) => (
                          <th key={i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.sku}>
                          <td>
                            <div className="aw-product">
                              <ProductImage
                                photo={productPhoto(p, undefined, [], API_BASE)}
                                alt={p.name_en}
                                width={48}
                                height={48}
                              />
                              <div>
                                <strong>{bn ? p.name_bn : p.name_en}</strong>
                                <small>{p.sku}</small>
                              </div>
                            </div>
                          </td>
                          <td>{title(p.details.department || p.category)}</td>
                          <td>
                            {money(p.price_bdt, bn)} / {p.unit}
                            <small>
                              {p.price_approved
                                ? "Owner approved"
                                : "Price approval needed"}
                            </small>
                          </td>
                          <td>
                            <Badge
                              value={
                                Number(p.stock_qty) > 0
                                  ? "available"
                                  : "no_stock"
                              }
                            />
                            <small>
                              {p.stock_qty} {p.unit}
                            </small>
                          </td>
                          <td>
                            <Badge value={p.active ? "active" : "inactive"} />
                          </td>
                          <td>
                            <button
                              className="secondary"
                              onClick={() => editProduct(p)}
                            >
                              {t("Edit", "সম্পাদনা")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {view === "parcels" && (
                <div className="aw-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {[
                          "Tracking",
                          "Pickup",
                          "Destination",
                          "Amount",
                          "Status",
                          "",
                        ].map((h, i) => (
                          <th key={i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.tracking_code}</strong>
                          </td>
                          <td>
                            {r.sender?.name}
                            <small>
                              {r.sender?.area}, {r.sender?.city}
                            </small>
                          </td>
                          <td>
                            {r.recipient?.name}
                            <small>
                              {r.recipient?.area}, {r.recipient?.city}
                            </small>
                          </td>
                          <td>{money(r.amount_bdt || "0", bn)}</td>
                          <td>
                            <Badge value={r.status} />
                          </td>
                          <td>
                            <button
                              className="secondary"
                              onClick={() => void open(r)}
                            >
                              Manage
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {view === "customers" && (
                <div className="aw-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {["Customer", "Contact", "Area", "Orders", ""].map(
                          (h, i) => (
                            <th key={i}>{h}</th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.name || "Customer"}</strong>
                          </td>
                          <td>
                            {r.email}
                            <small>{r.phone || "No saved phone"}</small>
                          </td>
                          <td>{r.area || "—"}</td>
                          <td>{r.order_count}</td>
                          <td>
                            <button
                              className="secondary"
                              onClick={() => void open(r)}
                            >
                              View profile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {view === "activity" && (
                <ol className="aw-timeline">
                  {data.map((r) => (
                    <li key={r.id}>
                      <strong>{title(r.event)}</strong>
                      <p>
                        {title(r.entity_type)} ·{" "}
                        {r.created_at
                          ? new Date(r.created_at).toLocaleString(
                              bn ? "bn-BD" : "en-BD",
                              { timeZone: "Asia/Dhaka" },
                            )
                          : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              {!loading && !data.length && (
                <div className="aw-empty">
                  <h3>{t("No matching records", "কোনো তথ্য পাওয়া যায়নি")}</h3>
                  <p>
                    {t(
                      "Try another search or wait for the first record. No sample data is shown.",
                      "অন্যভাবে খুঁজুন অথবা প্রথম তথ্যের জন্য অপেক্ষা করুন। নমুনা তথ্য দেখানো হয় না।",
                    )}
                  </p>
                </div>
              )}
              <nav className="aw-pagination" aria-label="Record pages">
                <span>
                  {total} {t("records", "টি তথ্য")} · {t("Page", "পৃষ্ঠা")} {page}
                </span>
                <button
                  className="secondary"
                  disabled={page === 1 || loading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← {t("Previous", "আগের")}
                </button>
                <button
                  className="secondary"
                  disabled={page * 20 >= total || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("Next", "পরের")} →
                </button>
              </nav>
            </section>
          )}
          {view === "products" && (
            <section className="aw-card">
              <button
                className="secondary"
                aria-expanded={advanced}
                onClick={() => setAdvanced(!advanced)}
              >
                {t(
                  "Product photos & preparation settings",
                  "পণ্যের ছবি ও প্রস্তুতির সেটিংস",
                )}{" "}
                {advanced ? "−" : "+"}
              </button>
              {advanced && <CommerceConsole section="catalog" />}
            </section>
          )}
          {view === "settings" && (
            <section className="aw-card">
              <nav className="aw-settings-tabs">
                {[
                  ["payments", "Payment methods"],
                  ["pilot", "Preparation, delivery & support"],
                ].map(([id, label]) => (
                  <button
                    className="secondary"
                    key={id}
                    aria-pressed={settingsTab === id}
                    onClick={() => setSettingsTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <CommerceConsole section={settingsTab} key={settingsTab} />
            </section>
          )}
          {view === "couriers" && (
            <section className="aw-card">
              <p>
                Review identity, documents and service coverage before
                activating a delivery partner. Only active verified partners can
                receive assignments.
              </p>
              <CommerceConsole section="couriers" />
            </section>
          )}
          {(detail || selectedProduct || detailLoading) && (
            <div className="aw-overlay">
              <section
                className="aw-detail"
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label={t("Record details", "বিস্তারিত তথ্য")}
              >
                <button
                  autoFocus
                  className="secondary aw-close"
                  disabled={busy}
                  onClick={() => {
                    detailRequest.current++;
                    setDetail(null);
                    setSelectedProduct(null);
                    setDetailLoading(false);
                  }}
                >
                  {t("Close", "বন্ধ করুন")} ×
                </button>
                {detailLoading && <p>Loading details…</p>}
                {detail && (
                  <>
                    <h2>
                      {detail.order_number ||
                        detail.tracking_code ||
                        detail.name ||
                        "Details"}
                    </h2>
                    <Badge value={detail.status} />
                    {view === "orders" && (
                      <>
                        <div className="aw-detail-grid">
                          <section className="aw-card">
                            <h3>Customer & delivery</h3>
                            <AddressCard address={detail.destination} />
                            <p>{detail.checkout_data?.instructions}</p>
                            <p>{detail.checkout_data?.preparation_notes}</p>
                          </section>
                          <section className="aw-card">
                            <h3>Payment</h3>
                            <p>
                              {detail.payment_method === "cod"
                                ? "Cash on delivery"
                                : title(detail.payment_method)}
                            </p>
                            <Badge value={detail.payment_status} />
                            <h3>
                              {detail.checkout_data?.quote_pending
                                ? "Estimate / quote"
                                : "Order total"}
                              : {money(detail.amount_bdt || "0", bn)}
                            </h3>
                            <p>{detail.checkout_data?.quote_note}</p>
                          </section>
                        </div>
                        <section className="aw-card">
                          <h3>Order items</h3>
                          {detail.items?.map((l) => (
                            <div className="aw-item" key={l.id}>
                              <div>
                                <strong>
                                  {detail.checkout_data?.item_snapshots?.find(
                                    (s) => s.sku === l.sku,
                                  )?.[bn ? "name_bn" : "name_en"] || l.sku}
                                </strong>
                                <small>
                                  {l.quantity} · {title(l.preparation)}
                                </small>
                              </div>
                              <strong>{money(l.amount_bdt, bn)}</strong>
                            </div>
                          ))}
                          {detail.checkout_data?.calculation && (
                            <dl className="aw-breakdown">
                              {[
                                [
                                  "Items",
                                  detail.checkout_data.calculation
                                    .item_subtotal_bdt,
                                ],
                                [
                                  "Preparation",
                                  detail.checkout_data.calculation
                                    .preparation_fee_bdt,
                                ],
                                [
                                  "Delivery",
                                  detail.checkout_data.calculation
                                    .delivery_fee_bdt,
                                ],
                                [
                                  "Discount",
                                  detail.checkout_data.calculation.discount_bdt,
                                ],
                              ].map(([k, v]) => (
                                <div key={k}>
                                  <dt>{k}</dt>
                                  <dd>
                                    {v != null ? money(v, bn) : "To confirm"}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          )}
                          {detail.checkout_data?.quote_pending &&
                            detail.checkout_data?.calculation?.pending?.map(
                              (p) => (
                                <p className="aw-warning" key={p}>
                                  {p}
                                </p>
                              ),
                            )}
                        </section>
                        {detail.checkout_data?.mode === "cod_order" &&
                          ![
                            "delivered",
                            "cancelled",
                            "rejected",
                            "failed",
                          ].includes(detail.status || "") && (
                            <>
                              <AvailabilityControls
                                id={detail.id}
                                status={detail.status || ""}
                                bn={bn}
                                busy={busy}
                                onTransition={(status) =>
                                  void action(
                                    "/admin/commerce/orders/" +
                                      detail.id +
                                      "/transition",
                                    {
                                      status,
                                      note:
                                        status === "awaiting_purchase"
                                          ? "Owner accepted order for verified purchase"
                                          : "Owner confirmed available inventory",
                                    },
                                  )
                                }
                                onPurchased={() => {
                                  void open(detail);
                                  setVersion((v) => v + 1);
                                  setMessage(
                                    t(
                                      "Purchase recorded. Ready for preparation.",
                                      "ক্রয় সংরক্ষিত। প্রস্তুতির জন্য তৈরি।",
                                    ),
                                  );
                                }}
                              />
                              <section className="aw-card">
                                <h3>Order controls</h3>
                                <fieldset disabled={busy}>
                                  <label>
                                    Review note / final quote breakdown
                                    <textarea
                                      value={note}
                                      minLength={3}
                                      maxLength={1000}
                                      onChange={(e) => setNote(e.target.value)}
                                    />
                                  </label>
                                  {[
                                    "placed",
                                    "pending_review",
                                    "quoted",
                                  ].includes(detail.status || "") && (
                                    <div className="aw-quote">
                                      <label>
                                        Final total (BDT)
                                        <input
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          value={quote}
                                          onChange={(e) =>
                                            setQuote(e.target.value)
                                          }
                                        />
                                      </label>
                                      <button
                                        className="secondary"
                                        disabled={
                                          !quote || note.trim().length < 10
                                        }
                                        onClick={() =>
                                          void action(
                                            "/admin/commerce/cod-orders/" +
                                              detail.id +
                                              "/quote",
                                            { final_total_bdt: quote, note },
                                          )
                                        }
                                      >
                                        Send final quote for customer approval
                                      </button>
                                    </div>
                                  )}
                                  {detail.status === "packed" && (
                                    <label>
                                      Assign verified courier
                                      <select
                                        value={courier}
                                        onChange={(e) =>
                                          setCourier(e.target.value)
                                        }
                                      >
                                        <option value="">Choose courier</option>
                                        {couriers
                                          .filter(
                                            (c) =>
                                              c.status === "approved" &&
                                              c.details.active &&
                                              c.details.identity_verified &&
                                              c.details.documents_verified,
                                          )
                                          .map((c, i) => (
                                            <option key={c.id} value={c.id}>
                                              Partner {i + 1} ·{" "}
                                              {title(c.transport_mode)} ·{" "}
                                              {c.details.service_cities?.join(
                                                ", ",
                                              )}
                                            </option>
                                          ))}
                                      </select>
                                    </label>
                                  )}
                                  {detail.status === "out_for_delivery" && (
                                    <label>
                                      Exact cash collected (BDT)
                                      <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={cash}
                                        onChange={(e) =>
                                          setCash(e.target.value)
                                        }
                                      />
                                    </label>
                                  )}
                                  <div className="aw-actions">
                                    {(
                                      orderActions[detail.status || ""] || []
                                    ).map((s) => (
                                      <button
                                        className={
                                          s === "rejected" || s === "failed"
                                            ? "secondary"
                                            : "primary"
                                        }
                                        key={s}
                                        disabled={
                                          (s === "confirmed" &&
                                            !!detail.checkout_data
                                              ?.quote_pending) ||
                                          (s === "assigned" && !courier) ||
                                          (s === "delivered" &&
                                            (!cash ||
                                              note.trim().length < 10)) ||
                                          (["failed", "rejected"].includes(s) &&
                                            !note.trim())
                                        }
                                        onClick={() =>
                                          void action(
                                            "/admin/commerce/orders/" +
                                              detail.id +
                                              "/transition",
                                            {
                                              status: s,
                                              courier_id: courier || null,
                                              note,
                                              cash_collected_bdt:
                                                s === "delivered" ? cash : null,
                                            },
                                          )
                                        }
                                      >
                                        {s === "delivered"
                                          ? "Complete delivery & record cash"
                                          : title(s)}
                                      </button>
                                    ))}
                                  </div>
                                </fieldset>
                                {detail.checkout_data.quote_pending && (
                                  <p className="aw-warning">
                                    Customer approval of the final quote is
                                    required before preparation.
                                  </p>
                                )}
                                <p>
                                  Confirmation reserves verified stock. Cash is
                                  recorded only with completed delivery.
                                </p>
                              </section>
                            </>
                          )}
                        {detail.status === "preview" && (
                          <p>
                            Archived preview only. No payment or delivery was
                            scheduled.
                          </p>
                        )}
                      </>
                    )}
                    {view === "parcels" && (
                      <>
                        <div className="aw-detail-grid">
                          <section className="aw-card">
                            <h3>Pickup</h3>
                            <AddressCard address={detail.sender} />
                          </section>
                          <section className="aw-card">
                            <h3>Recipient</h3>
                            <AddressCard address={detail.recipient} />
                          </section>
                        </div>
                        <section className="aw-card">
                          <h3>{t("Parcel details", "পার্সেলের তথ্য")}</h3>
                          <p>
                            {title(detail.package?.form)} ·{" "}
                            {title(detail.package?.category)} ·{" "}
                            {detail.package?.weight_kg ?? "—"} kg
                          </p>
                          <p>
                            {detail.package?.length_cm ?? "—"} ×{" "}
                            {detail.package?.width_cm ?? "—"} ×{" "}
                            {detail.package?.height_cm ?? "—"} cm
                          </p>
                        </section>
                        {detail.package?.request_only ? (
                          <section className="aw-card">
                            <h3>Dispatch controls</h3>
                            <label>
                              Update note
                              <input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                maxLength={500}
                              />
                            </label>
                            <label>
                              Courier
                              <select
                                value={courier}
                                onChange={(e) => setCourier(e.target.value)}
                              >
                                <option value="">
                                  Choose verified courier
                                </option>
                                {couriers
                                  .filter(
                                    (c) =>
                                      c.status === "approved" &&
                                      c.details.active &&
                                      c.details.documents_verified &&
                                      c.details.identity_verified,
                                  )
                                  .map((c, i) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name || "Partner " + (i + 1)} ·{" "}
                                      {c.transport_mode}
                                    </option>
                                  ))}
                              </select>
                            </label>
                            <div className="aw-actions">
                              {(parcelActions[detail.status || ""] || []).map(
                                (s) => (
                                  <button
                                    className="primary"
                                    key={s}
                                    disabled={
                                      busy ||
                                      note.trim().length < 3 ||
                                      (s === "assigned" && !courier)
                                    }
                                    onClick={() =>
                                      void action(
                                        "/parcels/requests/" +
                                          detail.id +
                                          "/update",
                                        {
                                          status: s,
                                          note,
                                          courier_id: courier || null,
                                        },
                                      )
                                    }
                                  >
                                    {title(s)}
                                  </button>
                                ),
                              )}
                            </div>
                          </section>
                        ) : (
                          <p>
                            Legacy parcel operations remain gated by server
                            launch settings.
                          </p>
                        )}
                      </>
                    )}
                    {view === "customers" && (
                      <>
                        <section className="aw-card">
                          <h3>Customer profile</h3>
                          <p>
                            {detail.email}
                            <br />
                            {detail.phone}
                          </p>
                          <h3>Saved delivery address</h3>
                          <AddressCard address={detail.checkout_defaults} />
                          <p>{detail.checkout_defaults?.instructions}</p>
                          <p>{detail.checkout_defaults?.preparation_notes}</p>
                          <p>
                            Preferred payment:{" "}
                            {title(detail.checkout_defaults?.payment_method)}
                          </p>
                        </section>
                        <section className="aw-card">
                          <h3>Recent customer orders</h3>
                          {detail.orders?.length ? (
                            ordersTable(detail.orders)
                          ) : (
                            <p>No orders yet.</p>
                          )}
                        </section>
                      </>
                    )}
                    {!!detail.history?.length && (
                      <section className="aw-card">
                        <h3>Tracking history</h3>
                        <ol className="aw-timeline">
                          {detail.history.map((h) => (
                            <li key={h.id}>
                              <strong>{title(h.event)}</strong>
                              <p>
                                {new Date(h.created_at).toLocaleString(
                                  bn ? "bn-BD" : "en-BD",
                                  { timeZone: "Asia/Dhaka" },
                                )}
                              </p>
                            </li>
                          ))}
                        </ol>
                      </section>
                    )}
                  </>
                )}
                {selectedProduct && (
                  <ProductEditor
                    product={selectedProduct}
                    token={token}
                    onSaved={() => {
                      setVersion((v) => v + 1);
                      setSelectedProduct(null);
                      setMessage("Product saved to the database.");
                    }}
                  />
                )}
                <p
                  role="status"
                  className={message ? "aw-feedback" : "aw-empty-status"}
                >
                  {message}
                </p>
              </section>
            </div>
          )}
        </main>
        <footer className="aw-footer">
          TRIPPY Delivery ·{" "}
          {t(
            "Owner-only administration · Online payments disabled",
            "শুধু মালিকের পরিচালনা · অনলাইন পেমেন্ট বন্ধ",
          )}
        </footer>
      </div>
    </div>
  );
}
function ProductEditor({
  product,
  token,
  onSaved,
}: {
  product: Product;
  token: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(product);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await commerceApi(
            "/admin/products/" + encodeURIComponent(draft.sku),
            token,
            "PUT",
            {
              name_en: draft.name_en,
              name_bn: draft.name_bn,
              category: draft.category,
              unit: draft.unit,
              price_bdt: draft.price_bdt,
              stock_qty: draft.stock_qty,
              processing_fee_bdt: draft.processing_fee_bdt,
              active: draft.active,
              price_approved: draft.price_approved,
              details: draft.details,
            },
          );
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{product.sku ? "Edit product" : "Add product"}</h2>
      <fieldset disabled={busy}>
        <div className="fields">
          {[
            ["sku", "Product code"],
            ["name_en", "English name"],
            ["name_bn", "Bengali name"],
            ["unit", "Selling unit"],
            ["price_bdt", "Selling price (BDT)"],
            ["stock_qty", "Verified available stock"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                required
                disabled={key === "sku" && !!product.sku}
                type={
                  key === "price_bdt" || key === "stock_qty" ? "number" : "text"
                }
                min="0"
                step={key === "stock_qty" ? "0.001" : "0.01"}
                value={String(draft[key as keyof Product])}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            Category
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  category: e.target.value,
                  processing_fee_bdt: "0",
                  details:
                    e.target.value === "dry"
                      ? { ...draft.details, preparation_options: [] }
                      : draft.details,
                })
              }
            >
              <option value="fresh">Fresh groceries</option>
              <option value="dry">Dry / other groceries</option>
            </select>
          </label>
        </div>
        <label className="aw-check">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Visible in the store
        </label>
        <label className="aw-check">
          <input
            type="checkbox"
            checked={draft.price_approved}
            onChange={(e) =>
              setDraft({ ...draft, price_approved: e.target.checked })
            }
          />
          I approve this actual selling price
        </label>
        <p>
          Only enter available stock you have verified. Existing photos and
          preparation options are preserved. Use Product photos & preparation
          settings for those controls.
        </p>
        <button className="primary">{busy ? "Saving…" : "Save product"}</button>
      </fieldset>
      <p role="status">{error}</p>
    </form>
  );
}

function AdminIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    overview: "M3 10 12 3l9 7v10H3Z M9 20v-7h6v7",
    orders: "M7 4h10v3H7z M5 5H3v17h18V5h-2 M7 12h10 M7 17h7",
    products: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    parcels: "m3 7 9-4 9 4v12l-9 4-9-4Z M3 7l9 5 9-5 M12 12v11",
    couriers:
      "M2 5h12v12H2z M14 10h4l4 5v2h-8 M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4 M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
    customers:
      "M16 21v-3c0-3-3-5-7-5s-7 2-7 5v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4c5 0 5 7 0 7 M19 14c3 1 3 3 3 7",
    settings: "M4 5h16 M4 12h16 M4 19h16 M8 2v6 M16 9v6 M10 16v6",
    activity: "M2 12h5l3-8 4 16 3-8h5",
  };
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
