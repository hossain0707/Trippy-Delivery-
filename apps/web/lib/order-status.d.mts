export function orderLabel(status: string, bn?: boolean): string;
export function canCancelOrder(status: string): boolean;
export function orderStage(status: string): number;
export function paymentLabel(
  status: string,
  paymentStatus: string,
  method: string,
  bn?: boolean,
): string;
