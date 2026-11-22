"use client";
import type { CheckoutDefaults } from "@/lib/profile.mjs";
export const paymentPreferences = [
  ["cod", "Cash on Delivery", "ক্যাশ অন ডেলিভারি"],
  ["bkash", "bKash", "বিকাশ"],
  ["nagad", "Nagad", "নগদ"],
  ["rocket", "Rocket", "রকেট"],
  ["bank", "Bank transfer", "ব্যাংক ট্রান্সফার"],
] as const;
export function SavedCheckoutFields({
  value,
  onChange,
  bn = false,
}: {
  value: CheckoutDefaults;
  onChange: (value: CheckoutDefaults) => void;
  bn?: boolean;
}) {
  const t = (en: string, b: string) => (bn ? b : en);
  return (
    <fieldset className="saved-checkout-fields">
      <legend>{t("Saved checkout details", "সংরক্ষিত ডেলিভারির তথ্য")}</legend>
      <div className="fields">
        {(
          [
            [
              "address_line",
              "House, road & delivery address",
              "বাড়ি, সড়ক ও ঠিকানা",
              300,
            ],
            ["area", "Area", "এলাকা", 120],
            ["city", "City", "শহর", 80],
            ["postal_code", "Postal code (optional)", "পোস্ট কোড (ঐচ্ছিক)", 20],
          ] as const
        ).map(([key, en, bangla, length]) => (
          <label key={key}>
            {t(en, bangla)}
            <input
              value={value[key]}
              maxLength={length}
              autoComplete={
                key === "address_line"
                  ? "street-address"
                  : key === "postal_code"
                    ? "postal-code"
                    : key === "city"
                      ? "address-level2"
                      : "address-level3"
              }
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <label>
        {t("Delivery instructions", "ডেলিভারির নির্দেশনা")}
        <textarea
          maxLength={1000}
          value={value.instructions}
          onChange={(e) => onChange({ ...value, instructions: e.target.value })}
        />
      </label>
      <label>
        {t("Preparation instructions", "প্রস্তুতের নির্দেশনা")}
        <textarea
          maxLength={500}
          value={value.preparation_notes}
          onChange={(e) =>
            onChange({ ...value, preparation_notes: e.target.value })
          }
        />
      </label>
      <label>
        {t(
          "Preferred payment method (saved preference only)",
          "পছন্দের পেমেন্ট পদ্ধতি (শুধু পছন্দ সংরক্ষণ)",
        )}
        <select
          value={value.payment_method}
          onChange={(e) =>
            onChange({
              ...value,
              payment_method: e.target
                .value as CheckoutDefaults["payment_method"],
            })
          }
        >
          {paymentPreferences.map(([id, en, b]) => (
            <option key={id} value={id}>
              {t(en, b)}
            </option>
          ))}
        </select>
      </label>
      <small>
        {t(
          "Payments remain disabled. Never enter a payment PIN, password or OTP.",
          "পেমেন্ট বন্ধ আছে। পেমেন্ট পিন, পাসওয়ার্ড বা ওটিপি লিখবেন না।",
        )}
      </small>
    </fieldset>
  );
}
