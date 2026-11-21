import { catalogPreviews } from "./catalog-previews.mjs";

export function preparationOptions(product) {
  return product.category === "fresh"
    ? product.details?.preparation_options || []
    : [];
}

// The API exposes preparation images only after owner approval.
// Never substitute a generated legacy picture or mislabel a whole photo as prepared.
export function productImageUrl(src, apiBase = "") {
  return src?.startsWith("/api/v1/commerce/media/") ? apiBase + src : src;
}
export function productPhoto(product, choice, failed = [], apiBase = "") {
  const usable = (src) =>
    typeof src === "string" &&
    src.startsWith("/") &&
    !src.startsWith("//") &&
    !src.startsWith("/preparation/") &&
    !failed.includes(productImageUrl(src, apiBase));
  const uploaded =
    product.details?.photo_variants?.[choice?.id || "whole"]?.image;
  const whole = product.details?.photo_variants?.whole?.image;
  const raw = usable(whole) ? whole : product.details?.image;
  const selected = usable(uploaded)
    ? uploaded
    : usable(choice?.image)
      ? choice.image
      : "";
  // Use the owner's earlier catalog style only as an explicitly labeled AI preview.
  // Preserve verified uploads and any explicitly approved owner photography.
  const preview = catalogPreviews[product.sku];
  const variant = choice?.id === "none" ? "whole" : choice?.id || "whole";
  const column = { whole: 0, cleaned: 1, "cut-only": 2, cut: 3 }[variant];
  if (
    !selected &&
    !(variant === "whole" && usable(whole)) &&
    !product.details?.images_approved &&
    preview &&
    column !== undefined
  ) {
    const atlas = usable(preview.sheet) && column >= 0;
    const src = atlas
      ? preview.sheet
      : variant === "whole" && usable(preview.whole)
        ? preview.whole
        : "";
    if (src)
      return {
        src,
        prepared: variant !== "whole",
        missingPreparation: false,
        generated: true,
        ...(atlas
          ? { tile: { column, row: preview.row, columns: 4, rows: 4 } }
          : {}),
      };
  }
  const prepared = !!selected && choice?.id !== "whole";
  return {
    src: productImageUrl(selected || (usable(raw) ? raw : ""), apiBase),
    prepared,
    missingPreparation:
      !!choice && !["whole", "none"].includes(choice.id) && !prepared,
  };
}
