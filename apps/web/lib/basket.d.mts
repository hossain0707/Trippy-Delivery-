import type { BasketLine, Product } from "./commerce";
export const basketKey: string;
export function readBasket(): BasketLine[];
export function writeBasket(lines: BasketLine[]): void;
export function updateBasket(
  lines: BasketLine[],
  line: BasketLine,
): BasketLine[];
export function lineTotal(product: Product, line: BasketLine): number;
