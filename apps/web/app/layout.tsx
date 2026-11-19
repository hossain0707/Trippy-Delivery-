import type { Metadata } from "next";
import "./globals.css";
import {SessionProvider} from "@/features/account/GoogleAccess";

export const metadata: Metadata = {
  title: "TRIPPY Delivery | Parcels & Groceries",
  description: "Parcel delivery and first-party fresh and dry groceries. Dhaka-first, nationwide-ready.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><SessionProvider>{children}</SessionProvider></body></html>;
}
