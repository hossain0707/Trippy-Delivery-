export const emptyCheckoutDefaults = {
  address_line: "",
  area: "",
  city: "Dhaka",
  postal_code: "",
  instructions: "",
  preparation_notes: "",
  payment_method: "cod",
};
export const emptyCheckoutForm = {
  name: "",
  phone: "",
  ...emptyCheckoutDefaults,
  promo_code: "",
  delivery_distance_km: "",
  payment_reference: "",
};
const defaultKeys = Object.keys(emptyCheckoutDefaults);
/** Explicit allowlist: identity, payment credentials and order-only values never enter defaults. */
export function editableProfile(profile) {
  return {
    name: profile.name,
    phone: profile.phone,
    language: profile.language,
    ...(profile.checkout_defaults
      ? {
          checkout_defaults: Object.fromEntries(
            defaultKeys.map((key) => [
              key,
              profile.checkout_defaults[key] ?? emptyCheckoutDefaults[key],
            ]),
          ),
        }
      : {}),
  };
}
export function checkoutProfilePayload(form, language) {
  return editableProfile({
    name: form.name,
    phone: form.phone,
    language,
    checkout_defaults: form,
  });
}
/** A late fetch or profile refresh must not overwrite fields already edited in this checkout. */
export function applyProfileDefaults(current, profile, touched = []) {
  const saved = {
    ...emptyCheckoutDefaults,
    ...profile.checkout_defaults,
    name: profile.name || "",
    phone: profile.phone || "",
  };
  return Object.fromEntries(
    Object.entries(current).map(([key, value]) => [
      key,
      Object.hasOwn(saved, key) && !touched.includes(key) ? saved[key] : value,
    ]),
  );
}
