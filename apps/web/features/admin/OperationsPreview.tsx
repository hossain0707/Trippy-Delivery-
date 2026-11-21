"use client";
import { useEffect, useState } from "react";
import { useCredential } from "../account/GoogleAccess";
import { authApi } from "@/lib/auth-api";
type Product = {
  sku: string;
  name_en: string;
  name_bn: string;
  category: "fresh" | "dry";
  unit: string;
  price_bdt: string;
  processing_fee_bdt: string;
  stock_qty: string;
  active: boolean;
  price_approved?: boolean;
  details?: Record<string, unknown>;
};
const blank: Product = {
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
};
export function OperationsPreview() {
  const token = useCredential();
  const [view, setView] = useState("dashboard");
  const [data, setData] = useState<unknown>(null);
  const [status, setStatus] = useState("");
  const [product, setProduct] = useState<Product>(blank);
  const [refresh, setRefresh] = useState(0);
  const [offset, setOffset] = useState(0);
  const [courier, setCourier] = useState({
    id: "",
    actor_id: "",
    transport_mode: "bicycle",
    status: "pending",
  });
  useEffect(() => {
    let active = true;
    setData(null);
    authApi<unknown>(token, "/admin/" + view + "?offset=" + offset)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    return () => {
      active = false;
    };
  }, [token, view, refresh, offset]);
  return (
    <section className="panel operations">
      <p>
        Preview: payments, order placement and fulfillment are disabled. Catalog
        changes are saved.
      </p>
      <nav className="tabs" aria-label="Operations sections">
        {[
          "dashboard",
          "products",
          "orders",
          "parcels",
          "couriers",
          "activity",
        ].map((v) => (
          <button
            key={v}
            aria-pressed={v === view}
            onClick={() => {
              setView(v);
              setStatus("");
              setOffset(0);
            }}
          >
            {v}
          </button>
        ))}
      </nav>
      <p role="status">{status}</p>
      {view === "couriers" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const { id, ...payload } = courier;
              await authApi(
                token,
                "/admin/couriers/" + encodeURIComponent(id),
                "PUT",
                payload,
              );
              setStatus("Courier saved");
              setRefresh((v) => v + 1);
            } catch (e) {
              setStatus((e as Error).message);
            }
          }}
        >
          <h2>Courier registration and approval</h2>
          <label>
            Courier ID
            <input
              required
              maxLength={36}
              value={courier.id}
              onChange={(e) => setCourier({ ...courier, id: e.target.value })}
            />
          </label>
          <label>
            Verified account subject
            <input
              required
              maxLength={128}
              value={courier.actor_id}
              onChange={(e) =>
                setCourier({ ...courier, actor_id: e.target.value })
              }
            />
          </label>
          <label>
            Transport
            <select
              value={courier.transport_mode}
              onChange={(e) =>
                setCourier({ ...courier, transport_mode: e.target.value })
              }
            >
              {[
                "walk",
                "bicycle",
                "motorcycle",
                "car",
                "van",
                "bus",
                "other",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Approval
            <select
              value={courier.status}
              onChange={(e) =>
                setCourier({ ...courier, status: e.target.value })
              }
            >
              {["pending", "approved", "suspended"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <button className="primary">Save courier</button>
        </form>
      )}
      {view === "products" && (
        <>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const { sku, ...payload } = product;
                await authApi(
                  token,
                  "/admin/products/" + encodeURIComponent(sku),
                  "PUT",
                  payload,
                );
                setStatus("Product saved");
                setRefresh((v) => v + 1);
              } catch (e) {
                setStatus((e as Error).message);
              }
            }}
          >
            <h2>Create or edit product</h2>
            <div className="fields">
              {(
                [
                  "sku",
                  "name_en",
                  "name_bn",
                  "unit",
                  "price_bdt",
                  "processing_fee_bdt",
                  "stock_qty",
                ] as const
              ).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    required
                    type={
                      k.endsWith("bdt") || k === "stock_qty" ? "number" : "text"
                    }
                    min="0"
                    maxLength={k === "sku" ? 50 : 160}
                    step={k === "stock_qty" ? "0.001" : "0.01"}
                    value={product[k]}
                    onChange={(e) =>
                      setProduct({ ...product, [k]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Category
                <select
                  value={product.category}
                  onChange={(e) =>
                    setProduct({
                      ...product,
                      category: e.target.value as "fresh" | "dry",
                    })
                  }
                >
                  <option value="fresh">Fresh / তাজা</option>
                  <option value="dry">Dry / শুকনা</option>
                </select>
              </label>
              <label>
                Active
                <input
                  type="checkbox"
                  checked={product.active}
                  onChange={(e) =>
                    setProduct({ ...product, active: e.target.checked })
                  }
                />
              </label>
            </div>
            <label>
              <input
                type="checkbox"
                checked={product.price_approved || false}
                onChange={(e) =>
                  setProduct({ ...product, price_approved: e.target.checked })
                }
              />
              Actual selling price approved by owner
            </label>
            <button className="primary">Save product</button>
          </form>
          {Array.isArray(data) &&
            data.map((p: Product) => (
              <button key={p.sku} onClick={() => setProduct(p)}>
                {p.name_en} / {p.name_bn} · ৳{p.price_bdt} · Stock {p.stock_qty}
              </button>
            ))}
        </>
      )}
      {data === null ? (
        <p>Loading…</p>
      ) : Array.isArray(data) ? (
        data.length ? (
          view !== "products" &&
          data.map((item: Record<string, unknown>, i: number) => (
            <article
              key={String(item.id || i)}
              style={{ overflowWrap: "anywhere" }}
            >
              {Object.entries(item).map(([k, v]) => (
                <p key={k}>
                  <strong>{k}:</strong>{" "}
                  {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                </p>
              ))}
            </article>
          ))
        ) : (
          <p>No records.</p>
        )
      ) : (
        <div className="cards">
          {Object.entries(
            (data as { counts: Record<string, number> }).counts || {},
          ).map(([k, v]) => (
            <article key={k}>
              <h2>{k}</h2>
              <strong className="amount">{v}</strong>
            </article>
          ))}
        </div>
      )}
      {view !== "dashboard" && (
        <nav aria-label="Record pages">
          <button
            disabled={offset === 0}
            onClick={() => setOffset((v) => Math.max(0, v - 100))}
          >
            Previous
          </button>
          <span> Page {offset / 100 + 1} </span>
          <button
            disabled={!Array.isArray(data) || data.length < 100}
            onClick={() => setOffset((v) => v + 100)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
