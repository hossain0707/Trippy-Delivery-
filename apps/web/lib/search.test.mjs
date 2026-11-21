import test from "node:test";
import assert from "node:assert/strict";
import { searchScore } from "./search.mjs";
const potato = {
  sku: "VEG-POTATO",
  name_en: "Potatoes",
  name_bn: "আলু",
  category: "fresh",
  unit: "kg",
  details: { department: "vegetables" },
};
for (const q of [
  "alu",
  "aloo",
  "আলু",
  "potato",
  "potatoe",
  "cut potato",
  "clean alu",
])
  test("find potato: " + q, () => assert.ok(searchScore(potato, q) > 0));
test("unrelated keywords do not match", () =>
  assert.equal(searchScore(potato, "beef"), 0));
test("all keywords must match", () =>
  assert.equal(searchScore(potato, "potato fish"), 0));
