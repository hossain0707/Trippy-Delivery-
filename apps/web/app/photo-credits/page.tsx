"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type Credit = {
  image: string;
  title: string;
  source_url: string;
  creator: string;
  license: string;
  license_url: string;
};
export default function Page() {
  const [credits, setCredits] = useState<Record<string, Credit>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/real-products/credits.json")
      .then((r) => {
        if (!r.ok) throw Error("Credits could not be loaded");
        return r.json();
      })
      .then(setCredits)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="wrap commerce-page">
      <Link href="/groceries">Back to groceries</Link>
      <h1>Product images and photo credits</h1>
      <p>
        Images labeled “AI-generated preview” are illustrative product and
        packaging previews created for TRIPPY. They are not photographs of
        actual stock. Preparation, pack size and presentation may vary.
        Owner-uploaded photographs replace these previews where supplied.
      </p>
      <p>
        The licensed photographs listed below are representative photographs of
        real ingredients and products, not photographs of TRIPPY stock or a
        guarantee of a particular brand, size or variety. Product details and
        the final quote determine your order. Individual photographs retain
        their stated licenses; resized WebP versions carry the same image
        license.
      </p>
      <p role="status">{error}</p>
      {Object.entries(credits).map(([sku, c]) => (
        <article className="panel" key={sku}>
          <h2>{sku}</h2>
          <p>
            {c.title} · {c.creator}
          </p>
          <a href={c.source_url} target="_blank" rel="noreferrer">
            Original and attribution
          </a>{" "}
          ·{" "}
          <a
            href={c.license_url || c.source_url}
            target="_blank"
            rel="noreferrer"
          >
            {c.license}
          </a>
        </article>
      ))}
    </main>
  );
}
