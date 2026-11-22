import test from "node:test";
import assert from "node:assert/strict";
import { canCancelOrder, orderLabel, orderStage } from "./order-status.mjs";
test("purchase acceptance is confirmed but not preparing until goods arrive", () => {
  assert.equal(orderStage("awaiting_purchase"), 1);
  assert.equal(orderStage("purchased"), 1);
  assert.equal(orderStage("preparing"), 2);
  assert.match(orderLabel("awaiting_purchase"), /awaiting purchase/);
  assert.notEqual(
    orderLabel("awaiting_purchase", true),
    orderLabel("awaiting_purchase"),
  );
});
test("customer cancellation ends when preparation starts, including purchased inventory", () => {
  for (const s of [
    "placed",
    "quoted",
    "confirmed",
    "awaiting_purchase",
    "purchased",
  ])
    assert.equal(canCancelOrder(s), true);
  for (const s of ["preparing", "packed", "delivered", "cancelled", "rejected"])
    assert.equal(canCancelOrder(s), false);
  assert.equal(orderStage("delivered"), 4);
  assert.equal(orderStage("rejected"), -1);
});

test("cancelled COD orders do not instruct customers to pay", async () => {
  const { paymentLabel } = await import("./order-status.mjs");
  assert.equal(paymentLabel("cancelled", "unpaid", "cod"), "No payment due");
  assert.equal(
    paymentLabel("out_for_delivery", "unpaid", "cod"),
    "Pay the courier on delivery",
  );
  assert.equal(
    paymentLabel("delivered", "paid", "cod"),
    "Payment collected / paid",
  );
});
