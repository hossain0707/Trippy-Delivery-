export function normalizeQuery(value: unknown): string;
export function searchScore(
  product: {
    sku: string;
    name_en: string;
    name_bn: string;
    category: string;
    unit: string;
    details?: { department?: string };
  },
  query: string,
): number;
