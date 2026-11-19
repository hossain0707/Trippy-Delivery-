"use client";
import { useCallback, useEffect, useState } from "react";
import { useCredential } from "@/features/account/GoogleAccess";
import {
  commerceApi,
  type Product,
  type Preparation,
  money,
} from "@/lib/commerce";
type Destination = {
  enabled: boolean;
  verified: boolean;
  receiving_number: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch: string;
  routing: string;
  instructions: string;
};
type PaymentSettings = {
  cod_enabled: boolean;
  bkash: Destination;
  nagad: Destination;
  rocket: Destination;
  bank: Destination;
};
type Zone = {
  city: string;
  area: string;
  fee_bdt: string;
  active: boolean;
  capacity_per_slot: number;
  preparation_ready: boolean;
  courier_ready: boolean;
};
type Pilot = {
  zones: Zone[];
  promotions: {
    code: string;
    percent: number;
    minimum_subtotal_bdt: string;
    enabled: boolean;
    expires_at?: string | null;
  }[];
  contact_phone: string;
  support_email: string;
  banner_en: string;
  banner_bn: string;
};
type Parcel = {id:string;tracking_code:string;status:string};
type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  amount_bdt: string;
};
type Courier = {
  id: string;
  actor_id: string;
  status: string;
  transport_mode: string;
  details: {
    identity_verified?: boolean;
    documents_verified?: boolean;
    active?: boolean;
    service_cities?: string[];
  };
};
const emptyDestination: Destination = {
  enabled: false,
  verified: false,
  receiving_number: "",
  bank_name: "",
  account_name: "",
  account_number: "",
  branch: "",
  routing: "",
  instructions: "",
};
export function CommerceConsole() {
  const token = useCredential();
  const [tab, setTab] = useState("catalog");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [chosen, setChosen] = useState<Product | null>(null);
  const [payments, setPayments] = useState<PaymentSettings>({
    cod_enabled: false,
    bkash: emptyDestination,
    nagad: emptyDestination,
    rocket: emptyDestination,
    bank: emptyDestination,
  });
  const [pilot, setPilot] = useState<Pilot>({
    zones: [],
    promotions: [],
    contact_phone: "",
    support_email: "",
    banner_en: "",
    banner_bn: "",
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [parcels,setParcels]=useState<Parcel[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [receipt, setReceipt] = useState<Record<string, string>>({});
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    if (tab === "catalog")
      setProducts(await commerceApi("/admin/commerce/catalog", token));
    if (tab === "payments")
      setPayments(
        await commerceApi("/admin/commerce/settings/payments", token),
      );
    if (tab === "pilot")
      setPilot(await commerceApi("/admin/commerce/settings/pilot", token));
    if (tab === "orders") {
      setOrders(await commerceApi("/admin/orders", token));
      setCouriers(await commerceApi("/admin/couriers", token));
    }
    if (tab === "parcels"){setParcels(await commerceApi("/admin/parcels",token));setCouriers(await commerceApi("/admin/couriers",token));}
    if (tab === "couriers")
      setCouriers(await commerceApi("/admin/couriers", token));
    if (tab === "customers" || tab === "events")
      setRecords(await commerceApi("/admin/commerce/" + tab, token));
  }, [tab, token]);
  useEffect(() => {
    setStatus("");
    setBusy(true);
    load()
      .catch((e) => setStatus(e.message))
      .finally(() => setBusy(false));
  }, [load]);
  async function save(path: string, payload: unknown, method = "PUT") {
    setBusy(true);
    setStatus("");
    try {
      await commerceApi(path, token, method, payload);
      setStatus("Saved to the database.");
      await load();
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const updateContent = (field: string, value: unknown) =>
    chosen &&
    setChosen({ ...chosen, details: { ...chosen.details, [field]: value } });
  return (
    <section className="panel commerce-admin">
      <p className="kicker">OWNER WORKSPACE</p>
      <h2>Catalog, payments & delivery controls</h2>
      <p>
        Live customer ordering stays closed until inventory, payment receiving
        details, coverage and pilot approval are complete. Saving these settings
        does not activate the pilot.
      </p>
      <nav className="department-pills" aria-label="Commerce administration">
        {[
          ["catalog", "Product content"],
          ["payments", "Payment methods"],
          ["pilot", "Delivery zones & support"],
          ["orders", "Order fulfillment"],
          ["parcels", "Parcel operations"],
          ["couriers", "Partner review"],
          ["customers", "Customers"],
          ["events", "Audit trail"],
        ].map(([id, name]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              setChosen(null);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      <p role="status">{status || (busy ? "Loading…" : "")}</p>
      {tab === "catalog" && (
        <>
          <label>
            Select product
            <select
              value={chosen?.sku || ""}
              onChange={(e) =>
                setChosen(
                  products.find((p) => p.sku === e.target.value) || null,
                )
              }
            >
              <option value="">Choose a product</option>
              {products.map((p) => (
                <option key={p.sku} value={p.sku}>
                  {p.name_en} / {p.name_bn}
                </option>
              ))}
            </select>
          </label>
          {chosen && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save(
                  "/admin/commerce/catalog/" + encodeURIComponent(chosen.sku),
                  chosen.details,
                );
              }}
            >
              <div className="fields">
                <label>
                  Department
                  <select
                    value={chosen.details.department || "pantry"}
                    onChange={(e) =>
                      updateContent("department", e.target.value)
                    }
                  >
                    {[
                      "vegetables",
                      "fish",
                      "meat",
                      "fruit",
                      "pantry",
                      "spices",
                      "dairy",
                      "bakery",
                      "packaged",
                      "essentials",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Product image path
                  <input
                    value={chosen.details.image || ""}
                    onChange={(e) => updateContent("image", e.target.value)}
                    placeholder="/products/rice.webp"
                  />
                </label>
                <label>
                  Packaging
                  <input
                    maxLength={150}
                    value={chosen.details.packaging || ""}
                    onChange={(e) => updateContent("packaging", e.target.value)}
                  />
                </label>
                <label>
                  Minimum quantity
                  <input
                    type="number"
                    min=".001"
                    max="50"
                    step=".001"
                    value={chosen.details.minimum_quantity || 1}
                    onChange={(e) =>
                      updateContent("minimum_quantity", e.target.value)
                    }
                  />
                </label>
                <label>
                  Quantity step
                  <input
                    type="number"
                    min=".001"
                    max="50"
                    step=".001"
                    value={chosen.details.quantity_step || 1}
                    onChange={(e) =>
                      updateContent("quantity_step", e.target.value)
                    }
                  />
                </label>
                <label>
                  Season
                  <input
                    maxLength={150}
                    value={chosen.details.season || ""}
                    onChange={(e) => updateContent("season", e.target.value)}
                  />
                </label>
              </div>
              <label>
                English description
                <textarea
                  maxLength={1500}
                  value={chosen.details.description_en || ""}
                  onChange={(e) =>
                    updateContent("description_en", e.target.value)
                  }
                />
              </label>
              <label>
                Bengali description
                <textarea
                  maxLength={1500}
                  value={chosen.details.description_bn || ""}
                  onChange={(e) =>
                    updateContent("description_bn", e.target.value)
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={chosen.details.seasonal || false}
                  onChange={(e) => updateContent("seasonal", e.target.checked)}
                />{" "}
                Seasonal product
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={chosen.details.images_approved || false}
                  onChange={(e) =>
                    updateContent("images_approved", e.target.checked)
                  }
                />{" "}
                Image accuracy and usage rights reviewed
              </label>
              <label>Related variant SKUs (comma separated)<input value={(chosen.details.variants||[]).join(", ")} onChange={e=>updateContent("variants",e.target.value.split(",").map(v=>v.trim()).filter(Boolean))}/></label>
            <h3>Preparation options</h3>
              {(chosen.details.preparation_options || []).map((o, i) => (
                <fieldset key={o.id}>
                  <legend>
                    {o.name_en} / {o.name_bn}
                  </legend>
                  <div className="fields">
                    <label>
                      <input
                        type="checkbox"
                        checked={o.enabled}
                        onChange={(e) =>
                          updateContent(
                            "preparation_options",
                            chosen.details.preparation_options?.map((v, j) =>
                              j === i ? { ...v, enabled: e.target.checked } : v,
                            ),
                          )
                        }
                      />{" "}
                      Offered
                    </label>
                    <label>
                      Fee per ordered unit (৳)
                      <input
                        type="number"
                        min="0"
                        step=".01"
                        value={o.fee_bdt}
                        onChange={(e) =>
                          updateContent(
                            "preparation_options",
                            chosen.details.preparation_options?.map((v, j) =>
                              j === i ? { ...v, fee_bdt: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Estimated yield (%)
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={o.yield_percent}
                        onChange={(e) =>
                          updateContent(
                            "preparation_options",
                            chosen.details.preparation_options?.map((v, j) =>
                              j === i
                                ? {
                                    ...v,
                                    yield_percent: Number(e.target.value),
                                  }
                                : v,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      Preparation image path
                      <input
                        value={o.image || ""}
                        onChange={(e) =>
                          updateContent(
                            "preparation_options",
                            chosen.details.preparation_options?.map((v, j) =>
                              j === i ? { ...v, image: e.target.value } : v,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Processing notes
                    <textarea
                      value={o.notes}
                      maxLength={500}
                      onChange={(e) =>
                        updateContent(
                          "preparation_options",
                          chosen.details.preparation_options?.map((v, j) =>
                            j === i ? { ...v, notes: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </label>
                </fieldset>
              ))}
              {chosen.category === "fresh" && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    const existing = chosen.details.preparation_options || [];
                    const next = ["whole", "cleaned", "cut", "custom"].find(
                      (id) => !existing.some((o) => o.id === id),
                    );
                    if (next)
                      updateContent("preparation_options", [
                        ...existing,
                        {
                          id: next,
                          name_en:
                            next === "custom" ? "Custom preparation" : next,
                          name_bn: next === "custom" ? "বিশেষ প্রস্তুতি" : next,
                          fee_bdt: "0",
                          enabled: false,
                          yield_percent: 100,
                          image: "",
                          notes: "",
                        } as Preparation,
                      ]);
                  }}
                >
                  Add preparation option
                </button>
              )}
              <button className="primary" disabled={busy}>
                Save product content
              </button>
            </form>
          )}
        </>
      )}
      {tab === "payments" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save("/admin/commerce/settings/payments", payments);
          }}
        >
          <label>
            <input
              type="checkbox"
              checked={payments.cod_enabled}
              onChange={(e) =>
                setPayments({ ...payments, cod_enabled: e.target.checked })
              }
            />{" "}
            Offer Cash on Delivery after pilot activation
          </label>
          {(["bkash", "nagad", "rocket", "bank"] as const).map((method) => {
            const d = payments[method];
            const update = (key: string, value: unknown) =>
              setPayments({ ...payments, [method]: { ...d, [key]: value } });
            return (
              <fieldset key={method}>
                <legend>{method === "bank" ? "Bank Transfer" : method}</legend>
                <p>
                  Receiving details must be genuine and independently verified.
                  Never use demonstration numbers for real transfers.
                </p>
                <div className="fields">
                  {(method === "bank"
                    ? [
                        "bank_name",
                        "account_name",
                        "account_number",
                        "branch",
                        "routing",
                      ]
                    : ["receiving_number"]
                  ).map((k) => (
                    <label key={k}>
                      {
                        {
                          receiving_number: "Receiving number",
                          bank_name: "Bank name",
                          account_name: "Account holder",
                          account_number: "Account number",
                          branch: "Branch",
                          routing: "Routing number",
                        }[k]
                      }
                      <input
                        maxLength={120}
                        value={String(d[k as keyof Destination] || "")}
                        onChange={(e) => update(k, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <label>
                  Payment instructions
                  <textarea
                    maxLength={1000}
                    value={d.instructions}
                    onChange={(e) => update("instructions", e.target.value)}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={d.verified}
                    onChange={(e) => update("verified", e.target.checked)}
                  />{" "}
                  Receiving details verified by owner
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => update("enabled", e.target.checked)}
                  />{" "}
                  Enable this method after pilot activation
                </label>
              </fieldset>
            );
          })}
          <button className="primary" disabled={busy}>
            Save payment settings
          </button>
        </form>
      )}
      {tab === "pilot" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save("/admin/commerce/settings/pilot", pilot);
          }}
        >
          <div className="fields">
            <label>
              Support phone
              <input
                value={pilot.contact_phone}
                maxLength={30}
                onChange={(e) =>
                  setPilot({ ...pilot, contact_phone: e.target.value })
                }
              />
            </label>
            <label>
              Support email
              <input
                type="email"
                value={pilot.support_email}
                maxLength={150}
                onChange={(e) =>
                  setPilot({ ...pilot, support_email: e.target.value })
                }
              />
            </label>
          </div>
          <label>
            English announcement
            <textarea
              maxLength={300}
              value={pilot.banner_en}
              onChange={(e) =>
                setPilot({ ...pilot, banner_en: e.target.value })
              }
            />
          </label>
          <label>
            Bengali announcement
            <textarea
              maxLength={300}
              value={pilot.banner_bn}
              onChange={(e) =>
                setPilot({ ...pilot, banner_bn: e.target.value })
              }
            />
          </label>
          <h3>Promotional offers</h3>
          {(pilot.promotions || []).map((offer, i) => (
            <fieldset key={i}>
              <legend>Offer {i + 1}</legend>
              <div className="fields">
                <label>
                  Code
                  <input
                    required
                    pattern="[A-Z0-9-]{3,30}"
                    value={offer.code}
                    onChange={(e) =>
                      setPilot({
                        ...pilot,
                        promotions: pilot.promotions.map((p, j) =>
                          i === j
                            ? { ...p, code: e.target.value.toUpperCase() }
                            : p,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Discount (%)
                  <input
                    required
                    type="number"
                    min="1"
                    max="50"
                    value={offer.percent}
                    onChange={(e) =>
                      setPilot({
                        ...pilot,
                        promotions: pilot.promotions.map((p, j) =>
                          i === j
                            ? { ...p, percent: Number(e.target.value) }
                            : p,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Minimum item subtotal (৳)
                  <input
                    type="number"
                    min="0"
                    value={offer.minimum_subtotal_bdt}
                    onChange={(e) =>
                      setPilot({
                        ...pilot,
                        promotions: pilot.promotions.map((p, j) =>
                          i === j
                            ? { ...p, minimum_subtotal_bdt: e.target.value }
                            : p,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={offer.enabled}
                    onChange={(e) =>
                      setPilot({
                        ...pilot,
                        promotions: pilot.promotions.map((p, j) =>
                          i === j ? { ...p, enabled: e.target.checked } : p,
                        ),
                      })
                    }
                  />
                  Offer enabled
                </label>
              </div>
            </fieldset>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setPilot({
                ...pilot,
                promotions: [
                  ...(pilot.promotions || []),
                  {
                    code: "",
                    percent: 10,
                    minimum_subtotal_bdt: "0",
                    enabled: false,
                    expires_at: null,
                  },
                ],
              })
            }
          >
            Add offer
          </button>
          <h3>Delivery zones</h3>
          {pilot.zones.map((z, i) => {
            const update = (key: string, value: unknown) =>
              setPilot({
                ...pilot,
                zones: pilot.zones.map((v, j) =>
                  i === j ? { ...v, [key]: value } : v,
                ),
              });
            return (
              <fieldset key={i}>
                <legend>Zone {i + 1}</legend>
                <div className="fields">
                  <label>
                    City
                    <input
                      required
                      value={z.city}
                      onChange={(e) => update("city", e.target.value)}
                    />
                  </label>
                  <label>
                    Area
                    <input
                      required
                      value={z.area}
                      onChange={(e) => update("area", e.target.value)}
                    />
                  </label>
                  <label>
                    Delivery fee (৳)
                    <input
                      required
                      type="number"
                      min="0"
                      step=".01"
                      value={z.fee_bdt}
                      onChange={(e) => update("fee_bdt", e.target.value)}
                    />
                  </label>
                  <label>
                    Orders per delivery slot
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={z.capacity_per_slot}
                      onChange={(e) =>
                        update("capacity_per_slot", Number(e.target.value))
                      }
                    />
                  </label>
                </div>
                {[
                  ["active", "Coverage verified"],
                  ["preparation_ready", "Preparation capacity confirmed"],
                  ["courier_ready", "Courier capacity confirmed"],
                ].map(([k, label]) => (
                  <label key={k}>
                    <input
                      type="checkbox"
                      checked={Boolean(z[k as keyof Zone])}
                      onChange={(e) => update(k, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setPilot({
                      ...pilot,
                      zones: pilot.zones.filter((_, j) => j !== i),
                    })
                  }
                >
                  Remove zone
                </button>
              </fieldset>
            );
          })}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setPilot({
                ...pilot,
                zones: [
                  ...pilot.zones,
                  {
                    city: "Dhaka",
                    area: "",
                    fee_bdt: "0",
                    active: false,
                    capacity_per_slot: 0,
                    preparation_ready: false,
                    courier_ready: false,
                  },
                ],
              })
            }
          >
            Add delivery zone
          </button>
          <button className="primary" disabled={busy}>
            Save delivery configuration
          </button>
        </form>
      )}
      {tab === "orders" && (
        <>
          {!orders.length && <p>No orders submitted.</p>}
          {orders.map((o) => (
            <article className="panel" key={o.id}>
              <h3>{o.order_number || o.id}</h3>
              <p>
                Fulfillment: <strong>{o.status}</strong> · Payment:{" "}
                <strong>{o.payment_status}</strong> ({o.payment_method})
              </p>
              <p>Total {money(o.amount_bdt)}</p>
              <label>
                Receipt reference
                <input
                  value={receipt[o.id] || ""}
                  onChange={(e) =>
                    setReceipt({ ...receipt, [o.id]: e.target.value })
                  }
                />
              </label>
              <button
                className="secondary"
                disabled={busy || o.payment_status === "paid"}
                onClick={() =>
                  void save(
                    "/admin/commerce/orders/" + o.id + "/payment",
                    {
                      received_amount_bdt: o.amount_bdt,
                      receipt_reference: receipt[o.id] || "",
                    },
                    "POST",
                  )
                }
              >
                Verify actual receipt
              </button>
              <label>
                Approved courier
                <select
                  value={assigned[o.id] || ""}
                  onChange={(e) =>
                    setAssigned({ ...assigned, [o.id]: e.target.value })
                  }
                >
                  <option value="">Choose a courier</option>
                  {couriers
                    .filter((c) => c.status === "approved" && c.details.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} · {c.transport_mode}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Review or exception note
                <input
                  maxLength={500}
                  value={notes[o.id] || ""}
                  onChange={(e) =>
                    setNotes({ ...notes, [o.id]: e.target.value })
                  }
                />
              </label>
              <div className="department-pills">
                {[
                  "confirmed",
                  "preparing",
                  "packed",
                  "assigned",
                  "out_for_delivery",
                  "delivered",
                  "rejected",
                  "failed",
                ].map((s) => (
                  <button
                    key={s}
                    disabled={busy}
                    onClick={() =>
                      void save(
                        "/admin/commerce/orders/" + o.id + "/transition",
                        {
                          status: s,
                          courier_id: assigned[o.id] || null,
                          note: notes[o.id] || "",
                        },
                        "POST",
                      )
                    }
                  >
                    {s.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
              <p>
                Preview blocks fulfillment and payment confirmation. Invalid
                transitions are rejected by the backend.
              </p>
            </article>
          ))}
        </>
      )}
      {tab==="parcels"&&<>{!parcels.length&&<p>No parcel bookings.</p>}{parcels.map(p=><article className="panel" key={p.id}><h3>{p.tracking_code}</h3><p>{p.status}</p><label>Approved courier<select value={assigned[p.id]||''} onChange={e=>setAssigned({...assigned,[p.id]:e.target.value})}><option value="">Choose courier</option>{couriers.filter(c=>c.status==='approved'&&c.details.active).map(c=><option key={c.id} value={c.id}>{c.id}</option>)}</select></label><button disabled={busy} className="secondary" onClick={()=>void save('/admin/parcels/'+p.id+'/assignment',{courier_id:assigned[p.id]||''},'POST')}>Assign courier</button><div className="department-pills">{['picked_up','in_transit','delivered','cancelled'].map(status=><button disabled={busy} key={status} onClick={()=>void save('/admin/parcels/'+p.id+'/status',{status},'POST')}>{status.replaceAll('_',' ')}</button>)}</div></article>)}</>}
      {tab === "couriers" && (
        <>
          {!couriers.length && <p>No partner applications.</p>}
          {couriers.map((c) => (
            <form
              className="panel"
              key={c.id}
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                void save("/admin/commerce/couriers/" + c.id + "/review", {
                  status: d.get("status"),
                  identity_verified: d.get("identity") === "on",
                  documents_verified: d.get("documents") === "on",
                  active: d.get("active") === "on",
                  service_cities: String(d.get("cities"))
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean),
                  review_note: d.get("note"),
                });
              }}
            >
              <h3>{c.id}</h3>
              <p>
                {c.transport_mode} · {c.status}
              </p>
              <label>
                Review outcome
                <select name="status" defaultValue={c.status}>
                  {["pending", "approved", "rejected", "suspended"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Service cities, comma separated
                <input
                  name="cities"
                  defaultValue={c.details.service_cities?.join(", ") || "Dhaka"}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  name="identity"
                  defaultChecked={c.details.identity_verified}
                />{" "}
                Identity checked through the private verification process
              </label>
              <label>
                <input
                  type="checkbox"
                  name="documents"
                  defaultChecked={c.details.documents_verified}
                />{" "}
                Required documents checked
              </label>
              <label>
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={c.details.active}
                />{" "}
                Active for assignments
              </label>
              <label>
                Review note
                <input name="note" required minLength={3} maxLength={500} />
              </label>
              <button className="primary" disabled={busy}>
                Save partner review
              </button>
            </form>
          ))}
        </>
      )}
      {(tab === "customers" || tab === "events") && (
        <div className="admin-records">
          {!records.length && <p>No records.</p>}
          {records.map((r, i) => (
            <article className="panel" key={String(r.id || r.subject || i)}>
              {Object.entries(r)
                .filter(([k]) => k !== "details")
                .map(([k, v]) => (
                  <p key={k}>
                    <strong>{k.replaceAll("_", " ")}</strong>: {String(v ?? "")}
                  </p>
                ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
