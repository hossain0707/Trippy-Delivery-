import type { Product, Preparation } from "./commerce";
export function preparationOptions(product: Product): Preparation[];
export type ProductPhotoResult = {
  src: string;
  prepared: boolean;
  missingPreparation: boolean;
  generated?: boolean;
  tile?: { column: number; row: number; columns: number; rows: number };
};
export function productPhoto(
  product: Product,
  choice?: Preparation,
  failed?: string[],
  apiBase?: string,
): ProductPhotoResult;

export function productImageUrl(src: string, apiBase?: string): string;
