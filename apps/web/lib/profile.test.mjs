import test from "node:test";
import assert from "node:assert/strict";
import { editableProfile } from "./profile.mjs";

test("saving a fetched profile omits identity, timestamps and injected roles", () => {
  const profile = {
    name: "নাজমুল",
    phone: "",
    language: "bn",
    subject: "google:123",
    email: "customer@example.com",
    updated_at: "2026-11-19",
    roles: ["admin"],
  };
  assert.deepEqual(editableProfile(profile), {
    name: "নাজমুল",
    phone: "",
    language: "bn",
  });
  assert.equal(profile.subject, "google:123");
});

test("empty phone and English preference round trip without extra fields", () => {
  assert.deepEqual(
    editableProfile({ name: "Customer", phone: "", language: "en" }),
    { name: "Customer", phone: "", language: "en" },
  );
});

import {
  emptyCheckoutForm,
  applyProfileDefaults,
  checkoutProfilePayload,
} from "./profile.mjs";
test("profile save includes only reusable details, never order or payment credentials", () => {
  const form = {
    ...emptyCheckoutForm,
    name: "Customer",
    phone: "01712345678",
    area: "Uttara",
    instructions: "Call first",
    preparation_notes: "Separate packs",
    payment_method: "bkash",
    promo_code: "ONCE",
    delivery_distance_km: "5",
    payment_reference: "transaction",
    pin: "1234",
  };
  const saved = checkoutProfilePayload(form, "en");
  assert.equal(saved.checkout_defaults.instructions, "Call first");
  assert.equal(saved.checkout_defaults.payment_method, "bkash");
  for (const key of [
    "promo_code",
    "delivery_distance_km",
    "payment_reference",
    "pin",
  ])
    assert.equal(key in saved.checkout_defaults, false);
});
test("saved checkout details auto-fill without overwriting edits or order-only fields", () => {
  const current = {
    ...emptyCheckoutForm,
    name: "Edited recipient",
    promo_code: "ONCE",
    instructions: "This order",
  };
  const p = {
    name: "Saved customer",
    phone: "01712345678",
    language: "en",
    checkout_defaults: {
      area: "Uttara",
      instructions: "Saved instruction",
      preparation_notes: "Wash well",
      payment_method: "nagad",
    },
  };
  const filled = applyProfileDefaults(current, p, ["name", "instructions"]);
  assert.equal(filled.name, "Edited recipient");
  assert.equal(filled.instructions, "This order");
  assert.equal(filled.area, "Uttara");
  assert.equal(filled.phone, p.phone);
  assert.equal(filled.payment_method, "nagad");
  assert.equal(filled.promo_code, "ONCE");
  assert.equal(current.area, "");
});
test("one-order edits leave the fetched profile unchanged and explicit clears stay cleared", () => {
  const p = {
    name: "Customer",
    phone: "",
    language: "en",
    checkout_defaults: { area: "Uttara", instructions: "Saved" },
  };
  const before = JSON.stringify(p);
  const form = applyProfileDefaults(
    { ...emptyCheckoutForm, instructions: "" },
    p,
    ["instructions"],
  );
  assert.equal(form.instructions, "");
  assert.equal(JSON.stringify(p), before);
});
