export type AdminRecords<T, P> = {
  view: string;
  items: T[];
  products: P[];
  total: number;
};
export function recordsForView<T, P>(
  snapshot: AdminRecords<T, P> | null,
  view: string,
): { items: T[]; products: P[]; total: number };
