import type { Metadata } from "next";
import { CustomerAccount } from "@/features/account/CustomerAccount";

export const metadata: Metadata = { title: "My account | TRIPPY Delivery" };
export default function Page() {
  return <CustomerAccount />;
}
