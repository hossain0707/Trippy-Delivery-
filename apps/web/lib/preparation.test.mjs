import test from "node:test";
import assert from "node:assert/strict";
import { productPhoto } from "./preparation.mjs";
const product = { details: { image: "/real-products/fish-rohu.webp" } };
test("selected preparation changes the primary image, not only a secondary preview", () => {
  assert.deepEqual(
    productPhoto(product, {
      id: "cut",
      image: "/real-products/approved-rohu-cut.webp",
    }),
    {
      src: "/real-products/approved-rohu-cut.webp",
      prepared: true,
      missingPreparation: false,
    },
  );
});
test("missing and failed preparation photographs retain an honestly labeled whole photo", () => {
  assert.deepEqual(productPhoto(product, { id: "cleaned", image: "" }), {
    src: product.details.image,
    prepared: false,
    missingPreparation: true,
  });
  assert.equal(
    productPhoto(
      product,
      { id: "cut", image: "/real-products/approved-rohu-cut.webp" },
      ["/real-products/approved-rohu-cut.webp"],
    ).missingPreparation,
    true,
  );
});
test("legacy generated preparations and external image paths cannot be used as real photos", () => {
  for (const image of [
    "/preparation/rohu-cut.webp",
    "//other.example/image.jpg",
    "https://other.example/image.jpg",
  ])
    assert.equal(
      productPhoto(product, { id: "cut", image }).src,
      product.details.image,
    );
  assert.equal(
    productPhoto(product, { id: "whole", image: "" }).missingPreparation,
    false,
  );
});
