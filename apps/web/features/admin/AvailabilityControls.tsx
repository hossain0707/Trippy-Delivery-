"use client";
import { useCallback, useEffect, useState } from "react";
import { commerceApi } from "@/lib/commerce";
import { useCredential } from "../account/GoogleAccess";
type Item = {
  sku: string;
  name_en: string;
  name_bn: string;
  unit: string;
  required: string;
  available: string;
  shortfall: string;
  reserved: boolean;
  active: boolean;
};
type Availability = {
  items: Item[];
  stock_reserved: boolean;
  can_confirm: boolean;
  quote_pending: boolean;
};
export function AvailabilityControls({
  id,
  status,
  onTransition,
  onPurchased,
  busy,
  bn = false,
}: {
  id: string;
  status: string;
  onTransition: (status: string) => void;
  onPurchased: () => void;
  busy: boolean;
  bn?: boolean;
}) {
  const token = useCredential();
  const [data, setData] = useState<Availability | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stockItem, setStockItem] = useState<Item | null>(null);
  const [count, setCount] = useState("");
  const [verified, setVerified] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [received, setReceived] = useState<Record<string, string>>({});
  const [purchaseVerified, setPurchaseVerified] = useState(false);
  const [purchaseNote, setPurchaseNote] = useState("");
  const t = (en: string, b: string) => (bn ? b : en);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await commerceApi<Availability>(
          "/admin/commerce/cod-orders/" + id + "/availability",
          token,
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, token]);
  useEffect(() => {
    void load();
  }, [load, status]);
  return (
    <section className="aw-card aw-availability">
      <div className="aw-card-heading">
        <h3>{t("Availability & purchase", "মজুত ও ক্রয়")}</h3>
        <button
          className="secondary"
          disabled={saving || loading}
          onClick={() => void load()}
        >
          {t("Refresh stock", "মজুত রিফ্রেশ")}
        </button>
      </div>
      <p role="status">
        {error ||
          (loading
            ? t("Checking current inventory…", "বর্তমান মজুত যাচাই হচ্ছে…")
            : "")}
      </p>
      {data && (
        <>
          <div className="aw-stock-lines">
            {data.items.map((item) => (
              <article className="aw-stock-line" key={item.sku}>
                <strong>{bn ? item.name_bn : item.name_en}</strong>
                <div className="aw-stock-metrics">
                  <span>
                    {t("Required", "প্রয়োজন")}
                    <strong>
                      {Number(item.required)} {item.unit}
                    </strong>
                  </span>
                  <span>
                    {t("Available", "মজুত")}
                    <strong>
                      {Number(item.available)} {item.unit}
                    </strong>
                  </span>
                  <span
                    className={Number(item.shortfall) > 0 ? "aw-shortfall" : ""}
                  >
                    {item.reserved
                      ? t("Reserved for this order", "এই অর্ডারে সংরক্ষিত")
                      : t("Shortfall", "ঘাটতি")}
                    <strong>
                      {item.reserved
                        ? "✓"
                        : Number(item.shortfall) + " " + item.unit}
                    </strong>
                  </span>
                </div>
                {!item.active && (
                  <p className="aw-warning">
                    {t(
                      "This product is inactive. Review the product before confirmation.",
                      "পণ্য নিষ্ক্রিয়। নিশ্চিত করার আগে পণ্য যাচাই করুন।",
                    )}
                  </p>
                )}
                {!data.stock_reserved && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setStockItem(item);
                      setCount(item.available);
                      setVerified(false);
                      setNote("");
                    }}
                  >
                    {t("Update verified stock", "যাচাইকৃত মজুত আপডেট")}
                  </button>
                )}
              </article>
            ))}
          </div>
          {stockItem && (
            <form
              className="aw-stock-editor"
              onSubmit={async (e) => {
                e.preventDefault();
                if (saving) return;
                setSaving(true);
                try {
                  await commerceApi(
                    "/admin/commerce/catalog/" +
                      encodeURIComponent(stockItem.sku) +
                      "/stock",
                    token,
                    "PUT",
                    {
                      available_qty: count,
                      expected_qty: stockItem.available,
                      verified,
                      note,
                    },
                  );
                  setStockItem(null);
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <fieldset disabled={saving}>
                <h3>
                  {t("Actual stock count: ", "প্রকৃত মজুত: ")}
                  {stockItem.name_en}
                </h3>
                <label>
                  {t("Actual available quantity", "প্রকৃত মজুতের পরিমাণ")} (
                  {stockItem.unit})
                  <input
                    required
                    type="number"
                    min="0"
                    max="1000000"
                    step="0.001"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                  />
                </label>
                <label>
                  {t("Count note", "গণনার বিবরণ")}
                  <input
                    required
                    minLength={3}
                    maxLength={500}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <label className="aw-check">
                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={(e) => setVerified(e.target.checked)}
                  />
                  {t(
                    "I verified this quantity is actually available.",
                    "এই পরিমাণ বাস্তবে মজুত আছে যাচাই করেছি।",
                  )}
                </label>
                <div className="aw-actions">
                  <button className="primary" disabled={!verified}>
                    {t("Save stock count", "মজুত সংরক্ষণ")}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setStockItem(null)}
                  >
                    {t("Cancel", "বাতিল")}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          {["placed", "pending_review"].includes(status) && (
            <>
              <div className="aw-actions">
                <button
                  className="primary"
                  disabled={busy || loading || !data.can_confirm}
                  onClick={() => onTransition("confirmed")}
                >
                  {t("Confirm with available stock", "মজুত দিয়ে নিশ্চিত করুন")}
                </button>
                <button
                  className="secondary"
                  disabled={
                    busy ||
                    loading ||
                    data.quote_pending ||
                    data.items.some((i) => !i.active)
                  }
                  onClick={() => onTransition("awaiting_purchase")}
                >
                  {t(
                    "Confirm & mark awaiting purchase",
                    "নিশ্চিত করুন ও ক্রয়ের অপেক্ষায় রাখুন",
                  )}
                </button>
              </div>
              {!data.can_confirm && (
                <p className="aw-warning">
                  {data.quote_pending
                    ? t(
                        "Send a final quote for customer approval first.",
                        "আগে চূড়ান্ত দাম গ্রাহকের অনুমোদনের জন্য পাঠান।",
                      )
                    : t(
                        "Stock is short. Update the actual count, or accept this order for purchase. Goods must be received before preparation.",
                        "মজুত কম। প্রকৃত মজুত আপডেট করুন অথবা বাজার করার জন্য অর্ডার গ্রহণ করুন। পণ্য পাওয়ার পরে প্রস্তুতি শুরু হবে।",
                      )}
                </p>
              )}
            </>
          )}
          {status === "awaiting_purchase" && (
            <form
              className="aw-purchase-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (saving) return;
                setSaving(true);
                setError("");
                try {
                  await commerceApi(
                    "/admin/commerce/cod-orders/" + id + "/purchase",
                    token,
                    "POST",
                    {
                      items: data.items.map((i) => ({
                        sku: i.sku,
                        quantity: received[i.sku],
                      })),
                      verified: purchaseVerified,
                      note: purchaseNote,
                    },
                  );
                  onPurchased();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <h3>{t("Record goods received", "পণ্য পাওয়ার তথ্য দিন")}</h3>
              <p>
                {t(
                  "Enter actual newly received quantities. Enter 0 for an item supplied entirely from verified existing stock. Nothing is added automatically.",
                  "নতুন পাওয়া পণ্যের প্রকৃত পরিমাণ দিন। পুরোটাই আগের যাচাইকৃত মজুত থেকে নিলে ০ দিন। স্বয়ংক্রিয়ভাবে মজুত বাড়ানো হয় না।",
                )}
              </p>
              <fieldset disabled={saving || busy}>
                {data.items.map((item) => (
                  <label key={item.sku}>
                    {item.name_en} · {t("Received", "পাওয়া গেছে")} ({item.unit})
                    <input
                      type="number"
                      required
                      min="0"
                      max="1000000"
                      step="0.001"
                      value={received[item.sku] ?? ""}
                      onChange={(e) =>
                        setReceived({ ...received, [item.sku]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <label>
                  {t("Purchase / receipt note", "ক্রয় / পণ্য পাওয়ার বিবরণ")}
                  <input
                    required
                    minLength={3}
                    maxLength={500}
                    value={purchaseNote}
                    onChange={(e) => setPurchaseNote(e.target.value)}
                  />
                </label>
                <label className="aw-check">
                  <input
                    type="checkbox"
                    checked={purchaseVerified}
                    onChange={(e) => setPurchaseVerified(e.target.checked)}
                  />
                  {t(
                    "The goods were actually received and verified.",
                    "পণ্য বাস্তবে পাওয়া ও যাচাই করা হয়েছে।",
                  )}
                </label>
                <button
                  className="primary"
                  disabled={
                    !purchaseVerified ||
                    data.items.some(
                      (i) =>
                        received[i.sku] === undefined || received[i.sku] === "",
                    )
                  }
                >
                  {t(
                    "Mark purchased & reserve items",
                    "ক্রয় সম্পন্ন করুন ও পণ্য সংরক্ষণ",
                  )}
                </button>
              </fieldset>
            </form>
          )}
          {status === "purchased" && (
            <p className="aw-feedback">
              {t(
                "Goods received and reserved. This order is ready for preparation.",
                "পণ্য পাওয়া ও সংরক্ষিত হয়েছে। অর্ডার প্রস্তুতির জন্য তৈরি।",
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
