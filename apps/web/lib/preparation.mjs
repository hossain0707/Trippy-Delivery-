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
  const prepared = !!selected && choice?.id !== "whole";
  return {
    src: productImageUrl(selected || (usable(raw) ? raw : ""), apiBase),
    prepared,
    missingPreparation:
      !!choice && !["whole", "none"].includes(choice.id) && !prepared,
  };
}
