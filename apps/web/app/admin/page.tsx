import type { Metadata } from "next";
import { GoogleAccess } from "@/features/account/GoogleAccess";
import { OperationsPreview } from "@/features/admin/OperationsPreview";

export const metadata: Metadata = { title: "TRIPPY Delivery | Admin preview", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <main className="wrap admin"><a className="wordmark" href="/">TRIPPY<span> Delivery</span></a>
    <section className="service"><p className="kicker">ADMIN PREVIEW</p><h1>Delivery operations</h1>
      <p>Practice with synthetic records. Live staff access and production operations require authentication and authorization.</p>
      <GoogleAccess admin><OperationsPreview /></GoogleAccess>
    </section>
  </main>;
}
