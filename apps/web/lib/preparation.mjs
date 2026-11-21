export function preparationOptions(product) {
  return product.category === "fresh"
    ? product.details?.preparation_options || []
    : [];
}

// The API exposes preparation images only after owner approval.
// Never substitute a generated legacy picture or mislabel a whole photo as prepared.
export function productPhoto(product, choice, failed = []) {
  const usable = (src) =>
    typeof src === "string" &&
    src.startsWith("/") &&
    !src.startsWith("//") &&
    !src.startsWith("/preparation/") &&
    !failed.includes(src);
  const selected = usable(choice?.image) ? choice.image : "";
  const prepared = !!selected && choice?.id !== "whole";
  return {
    src:
      selected || (usable(product.details?.image) ? product.details.image : ""),
    prepared,
    missingPreparation:
      !!choice && !["whole", "none"].includes(choice.id) && !prepared,
  };
}
