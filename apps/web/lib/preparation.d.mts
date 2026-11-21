import type { Product, Preparation } from "./commerce";
export function preparationOptions(product: Product): Preparation[];
export function productPhoto(
  product: Product,
  choice?: Preparation,
  failed?: string[],
  apiBase?: string,
): { src: string; prepared: boolean; missingPreparation: boolean };

export function productImageUrl(src: string, apiBase?: string): string;
