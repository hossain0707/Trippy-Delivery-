import Link from "next/link";
import type { Metadata } from "next";
import { GoogleAccess } from "@/features/account/GoogleAccess";
import { CommerceConsole } from "@/features/admin/CommerceConsole";
import { OperationsPreview } from "@/features/admin/OperationsPreview";

export const metadata: Metadata = { title: "TRIPPY Delivery | Admin preview", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <main className="wrap admin"><Link className="wordmark" href="/">TRIPPY<span> Delivery</span></Link>
    <section className="service"><p className="kicker">ADMIN PREVIEW</p><h1>Delivery operations</h1>
      <p>Owner access only. View persisted records and manage the grocery catalog.</p>
      <GoogleAccess admin><CommerceConsole /><OperationsPreview /></GoogleAccess>
    </section>
  </main>;
}
