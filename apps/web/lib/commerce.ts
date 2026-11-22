import { API_BASE } from "./api";
export type Preparation = {
  id: string;
  name_en: string;
  name_bn: string;
  fee_bdt: string;
  fee_unit?: "selling_unit" | "kg";
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
    photo_variants?: Partial<
      Record<
        "whole" | "cleaned" | "cut-only" | "cut",
        {
          image: string;
          credit: string;
          source_url: string;
          uploaded_at: string;
        }
      >
    >;
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
    photo_credit?: {
      source_url: string;
      creator: string;
      license: string;
      license_url: string;
      title: string;
      representative: boolean;
    } | null;
    catalog_version?: string;
    market_price?: {
      amount_bdt: string;
      unit: string;
      source_url: string;
      source_name: string;
      checked_on: string;
      basis: string;
    } | null;
  };
};
export type BasketLine = {
  sku: string;
  quantity: string;
  preparation: string;
  preparation_weight_kg?: string;
};
export type Configuration = {
  preview_checkout?: boolean;
  cod_ordering_open?: boolean;
  ordering_open: boolean;
  setup_issues?: string[];
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
    delivery_base_area?: string;
    delivery_base_fee_bdt?: string | null;
    delivery_per_km_bdt?: string | null;
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
