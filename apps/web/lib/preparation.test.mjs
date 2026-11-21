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
test("uploaded photos map each preparation to the persistent backend image", () => {
  const id = "a".repeat(40);
  const item = {
    details: {
      image: "/real-products/fish-rohu.webp",
      photo_variants: {
        whole: { image: "/api/v1/commerce/media/" + id },
        cut: { image: "/api/v1/commerce/media/" + "b".repeat(40) },
      },
    },
  };
  assert.equal(
    productPhoto(item, { id: "whole" }, [], "https://api.example").src,
    "https://api.example/api/v1/commerce/media/" + id,
  );
  assert.equal(
    productPhoto(item, { id: "cut" }, [], "https://api.example").prepared,
    true,
  );
  assert.equal(
    productPhoto(item, { id: "cleaned" }, [], "https://api.example")
      .missingPreparation,
    true,
  );
});

test("a failed uploaded whole photo falls back to the existing real product photograph", () => {
  const path = "/api/v1/commerce/media/" + "c".repeat(40);
  const item = {
    details: {
      image: "/real-products/fish-rohu.webp",
      photo_variants: { whole: { image: path } },
    },
  };
  assert.equal(
    productPhoto(
      item,
      { id: "whole" },
      ["https://api.example" + path],
      "https://api.example",
    ).src,
    "/real-products/fish-rohu.webp",
  );
});

import { catalogPreviews } from "./catalog-previews.mjs";
import { existsSync, readFileSync } from "node:fs";

test("every eligible fresh product has four distinct, labeled generated preview states", () => {
  const catalog = JSON.parse(
    readFileSync(
      new URL(
        "../../../services/api/catalog/bd-groceries-v1.json",
        import.meta.url,
      ),
    ),
  );
  const eligible = catalog.products.filter(
    (p) =>
      p.category === "fresh" &&
      ["vegetables", "fruit", "fish", "meat"].includes(p.details.department) &&
      !["EGGS", "BEEF-MINCE", "JACKFRUIT-PODS"].includes(p.sku),
  );
  assert.equal(eligible.length, 64);
  for (const product of eligible) {
    const seen = new Set();
    for (const id of ["whole", "cleaned", "cut-only", "cut"]) {
      const photo = productPhoto(product, { id });
      assert.equal(
        photo.generated,
        true,
        `${product.sku}/${id} must be labeled`,
      );
      assert.equal(photo.missingPreparation, false, `${product.sku}/${id}`);
      assert.equal(photo.prepared, id !== "whole");
      assert.ok(photo.tile, `${product.sku}/${id} needs a matching cell`);
      assert.ok(
        existsSync(new URL("../public" + photo.src, import.meta.url)),
        photo.src,
      );
      seen.add(`${photo.src}:${photo.tile.row}:${photo.tile.column}`);
    }
    assert.equal(seen.size, 4, product.sku);
  }
});

test("owner uploads and explicitly approved real photographs override generated defaults", () => {
  const product = {
    sku: "BITTER-GOURD",
    details: {
      image: "/real-products/bitter-gourd.webp",
      photo_variants: {
        cut: { image: "/api/v1/commerce/media/" + "d".repeat(40) },
      },
    },
  };
  assert.equal(productPhoto(product, { id: "cut" }).generated, undefined);
  assert.equal(productPhoto(product, { id: "cut" }).tile, undefined);
  product.details.images_approved = true;
  assert.equal(
    productPhoto(product, {
      id: "cleaned",
      image: "/real-products/owner-cleaned.webp",
    }).src,
    "/real-products/owner-cleaned.webp",
  );
  assert.equal(productPhoto(product, { id: "whole" }).generated, undefined);
});

test("a failed generated atlas keeps an honestly labeled raw fallback", () => {
  const item = {
    sku: "BITTER-GOURD",
    details: { image: "/real-products/bitter-gourd.webp" },
  };
  const photo = productPhoto(item, { id: "cut" }, [
    catalogPreviews[item.sku].sheet,
  ]);
  assert.equal(photo.src, item.details.image);
  assert.equal(photo.prepared, false);
  assert.equal(photo.missingPreparation, true);
  assert.equal(photo.generated, undefined);
});
