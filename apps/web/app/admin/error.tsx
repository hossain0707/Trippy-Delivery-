"use client";
import Link from "next/link";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <main className="wrap" style={{ paddingTop: 64 }}>
      <section className="panel" role="alert">
        <p className="kicker">TRIPPY DELIVERY</p>
        <h1>The admin view could not load</h1>
        <p>
          An unexpected display error occurred. Your saved records have not been
          removed. Retry this view or reopen the dashboard.
        </p>
        <div className="actions">
          <button className="primary" onClick={reset}>
            Retry this view
          </button>
          <Link
            className="secondary"
            href="/admin"
            onClick={() => window.location.assign("/admin")}
          >
            Reopen dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
