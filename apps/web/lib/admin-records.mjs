/** A response belongs to one section; never render it as another section's schema. */
export function recordsForView(snapshot, view) {
  if (!snapshot || snapshot.view !== view)
    return { items: [], products: [], total: 0 };
  return {
    items: view === "products" ? [] : snapshot.items,
    products: view === "products" ? snapshot.products : [],
    total: snapshot.total,
  };
}
