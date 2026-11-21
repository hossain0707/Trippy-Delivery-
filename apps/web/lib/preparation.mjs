export function preparationOptions(product) {
  return product.category === "fresh"
    ? product.details?.preparation_options || []
    : [];
}
