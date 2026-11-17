"use client";

import Script from "next/script";
import { useRef, useState, type ReactNode } from "react";
import { API_BASE } from "@/lib/api";

type Profile = { name: string | null; email: string; is_admin: boolean };
type GoogleIdentity = {
  initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
  renderButton(element: HTMLElement, options: { theme: "outline"; size: "large"; text: "continue_with" }): void;
};

export function GoogleAccess({ admin = false, children }: { admin?: boolean; children?: ReactNode }) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const button = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(credential: string) {
    setBusy(true);
    setStatus("");
    setProfile(null);
    try {
      const response = await fetch(API_BASE + (admin ? "/api/v1/admin/session" : "/api/v1/account"), {
        headers: { Authorization: "Bearer " + credential },
        cache: "no-store",
      });
      if (response.status === 403) {
        setStatus("This Google account does not have administrator access.");
        return;
      }
      if (!response.ok) throw new Error("Sign-in failed");
      setProfile(await response.json() as Profile);
    } catch {
      setStatus("Google sign-in could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <section className="panel">
      <h2>{admin ? "Administrator sign-in" : "Google account"}</h2>
      {clientId ? <>
        <Script src="https://accounts.google.com/gsi/client" onReady={() => {
          const identity = (window as Window & { google?: { accounts: { id: GoogleIdentity } } }).google?.accounts.id;
          if (!identity || !button.current) return;
          identity.initialize({ client_id: clientId, callback: ({ credential }) => { void signIn(credential); } });
          identity.renderButton(button.current, { theme: "outline", size: "large", text: "continue_with" });
        }} onError={() => setStatus("The Google sign-in button could not load.")} />
        <div ref={button} hidden={!!profile || busy} />
      </> : <p>Google sign-in is unavailable on this deployment.</p>}
      <p role="status">{busy ? "Verifying your Google account…" : status}</p>
      {profile && <div>
        <p><strong>{profile.name || profile.email}</strong></p>
        <p>{profile.email}</p>
        {!admin && profile.is_admin && <p><a href="/admin">Admin dashboard</a></p>}
        <button className="secondary" type="button" onClick={() => setProfile(null)}>Sign out</button>
      </div>}
    </section>
    {profile && (!admin || profile.is_admin) && children}
  </>;
}
