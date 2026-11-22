export type CheckoutDefaults = {
  address_line: string;
  area: string;
  city: string;
  postal_code: string;
  instructions: string;
  preparation_notes: string;
  payment_method: "cod" | "bkash" | "nagad" | "rocket" | "bank";
};
export type CheckoutValues = CheckoutDefaults & {
  name: string;
  phone: string;
  promo_code: string;
  delivery_distance_km: string;
  payment_reference: string;
};
export type EditableProfile = {
  name: string;
  phone: string;
  language: "en" | "bn";
  checkout_defaults?: CheckoutDefaults;
};
export type CustomerProfile = EditableProfile & {
  subject?: string;
  email?: string;
  updated_at?: string;
};
export const emptyCheckoutDefaults: CheckoutDefaults;
export const emptyCheckoutForm: CheckoutValues;
export function editableProfile(profile: EditableProfile): EditableProfile;
export function checkoutProfilePayload(
  form: CheckoutValues,
  language: "en" | "bn",
): EditableProfile;
export function applyProfileDefaults(
  current: CheckoutValues,
  profile: CustomerProfile,
  touched?: string[],
): CheckoutValues;
