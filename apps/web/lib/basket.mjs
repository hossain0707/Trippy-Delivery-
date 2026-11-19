export const basketKey = "trippy-basket-v1";
export function readBasket() {
  try {
    const data = JSON.parse(localStorage.getItem(basketKey) || "[]");
    return Array.isArray(data)
      ? data
          .filter(
            (l) =>
              typeof l.sku === "string" &&
              Number(l.quantity) > 0 &&
              Number(l.quantity) <= 50 &&
              typeof l.preparation === "string",
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
export function writeBasket(lines) {
  localStorage.setItem(basketKey, JSON.stringify(lines));
  window.dispatchEvent(new Event("trippy-basket"));
}
export function updateBasket(lines, line) {
  return [...lines.filter((l) => l.sku !== line.sku), line].slice(0, 50);
}
export function lineTotal(product, line) {
  const option = product.details?.preparation_options?.find(
    (o) => o.id === line.preparation && o.enabled,
  );
  return (
    (Number(product.price_bdt) + Number(option?.fee_bdt || 0)) *
    Number(line.quantity)
  );
}
