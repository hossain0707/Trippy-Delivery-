import test from "node:test";
import assert from "node:assert/strict";
import { updateBasket, lineTotal } from "./basket.mjs";
const p = {
  price_bdt: "300",
  details: {
    preparation_options: [
      { id: "cut", fee_bdt: "50", enabled: true },
      { id: "cleaned", fee_bdt: "90", enabled: false },
    ],
  },
};
test("basket includes per-product preparation fees and fractional quantities", () =>
  assert.equal(lineTotal(p, { preparation: "cut", quantity: "1.5" }), 525));
test("disabled preparation options do not silently add a fee", () =>
  assert.equal(lineTotal(p, { preparation: "cleaned", quantity: "1" }), 300));
test("one product has one explicit preparation and quantity", () => {
  const lines = updateBasket(
    [{ sku: "FISH", quantity: "1", preparation: "whole" }],
    { sku: "FISH", quantity: "2", preparation: "cut" },
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, "2");
  assert.equal(lines[0].preparation, "cut");
});
test("basket never grows beyond the checkout item limit", () => {
  const rows = Array.from({ length: 50 }, (_, i) => ({
    sku: String(i),
    quantity: "1",
    preparation: "none",
  }));
  assert.equal(
    updateBasket(rows, { sku: "extra", quantity: "1", preparation: "none" })
      .length,
    50,
  );
});
