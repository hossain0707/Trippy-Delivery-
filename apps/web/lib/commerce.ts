import { API_BASE } from "./api";
export type Preparation = {
  id: string;
  name_en: string;
  name_bn: string;
  fee_bdt: string;
  enabled: boolean;
  yield_percent: number;
  image: string;
  notes: string;
};
export type Product = {
  sku: string;
  name_en: string;
  name_bn: string;
  category: string;
  unit: string;
  price_bdt: string;
  stock_qty: string;
  processing_fee_bdt: string;
  price_approved: boolean;
  active: boolean;
  details: {
    department?: string;
    description_en?: string;
    description_bn?: string;
    image?: string;
    seasonal?: boolean;
    season?: string;
    packaging?: string;
    preparation_options?: Preparation[];
    minimum_quantity?: string;
    quantity_step?: string;
    variants?: string[];
    images_approved?: boolean;
    catalog_version?: string;
  };
};
export type BasketLine = { sku: string; quantity: string; preparation: string };
export type Configuration = {
  ordering_open: boolean;
  payments: Record<
    string,
    {
      enabled: boolean;
      receiving_number?: string;
      demo_number?: string;
      instructions?: string;
      bank_name?: string;
      account_name?: string;
      account_number?: string;
      branch?: string;
      routing?: string;
    }
  >;
  pilot: {
    zones: { city: string; area: string; active: boolean; fee_bdt: string }[];
    contact_phone: string;
    support_email: string;
    banner_en: string;
    banner_bn: string;
  };
};
export async function commerceApi<T>(
  path: string,
  token = "",
  method = "GET",
  payload?: unknown,
  idempotency?: string,
): Promise<T> {
  const response = await fetch(API_BASE + "/api/v1" + path, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Please check the highlighted information and try again.",
    );
  return data as T;
}
export const money = (n: string | number, bn = false) =>
  new Intl.NumberFormat(bn ? "bn-BD" : "en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(Number(n));
