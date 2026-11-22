import Link from "next/link";
import type { Metadata } from "next";
import { GoogleAccess } from "@/features/account/GoogleAccess";
import { AdminWorkspace } from "@/features/admin/Workspace";
export const metadata: Metadata = {
  title: "TRIPPY Delivery | Owner dashboard",
  robots: { index: false, follow: false },
};
export default function AdminPage() {
  return (
    <div className="admin-gateway">
      <div className="admin-gateway-heading">
        <Link className="wordmark" href="/">
          TRIPPY Delivery
        </Link>
        <span>Owner administration</span>
      </div>
      <GoogleAccess admin>
        <AdminWorkspace />
      </GoogleAccess>
    </div>
  );
}
