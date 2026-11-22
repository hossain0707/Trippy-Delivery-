import test from "node:test";
import assert from "node:assert/strict";
import { recordsForView } from "./admin-records.mjs";

test("Orders → Products never renders order records as products before the new response arrives", () => {
  const order = { id: "order-1", order_number: "TRC-1", status: "placed" };
  const snapshot = { view: "orders", items: [order], products: [], total: 1 };
  const products = recordsForView(snapshot, "products").products;
  assert.deepEqual(
    products.map((p) => p.details.department),
    [],
  );
  assert.deepEqual(recordsForView(snapshot, "orders").items, [order]);
});

test("switching between every section hides records belonging to the previous section", () => {
  for (const previous of [
    "orders",
    "products",
    "parcels",
    "customers",
    "activity",
  ]) {
    const snapshot = {
      view: previous,
      items: [{ id: "record" }],
      products: [{ sku: "P", details: { department: "fish" } }],
      total: 1,
    };
    for (const next of [
      "overview",
      "orders",
      "products",
      "parcels",
      "customers",
      "activity",
      "settings",
      "couriers",
    ]) {
      if (next !== previous)
        assert.deepEqual(recordsForView(snapshot, next), {
          items: [],
          products: [],
          total: 0,
        });
    }
  }
});

test("a product response exposes only products, and loading has no stale records", () => {
  const product = { sku: "P", details: { department: "fish" } };
  const result = recordsForView(
    { view: "products", items: [], products: [product], total: 1 },
    "products",
  );
  assert.equal(result.products[0].details.department, "fish");
  assert.deepEqual(result.items, []);
  assert.deepEqual(recordsForView(null, "products"), {
    items: [],
    products: [],
    total: 0,
  });
});
