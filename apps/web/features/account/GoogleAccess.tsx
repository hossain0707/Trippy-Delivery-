"use client";

import Script from "next/script";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { API_BASE } from "@/lib/api";

type Profile = { name: string | null; email: string; is_admin: boolean };
type GoogleIdentity = {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }): void;
  renderButton(
    element: HTMLElement,
    options: { theme: "outline"; size: "large"; text: "continue_with" },
  ): void;
};

type Session = {
  profile: Profile | null;
  credential: string;
  setProfile: (p: Profile | null) => void;
  setCredential: (c: string) => void;
};
const SessionContext = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [credential, setCredential] = useState("");
  return (
    <SessionContext.Provider
      value={{ profile, setProfile, credential, setCredential }}
    >
      {children}
    </SessionContext.Provider>
  );
}
const CredentialContext = createContext("");
export const useCredential = () => useContext(CredentialContext);

export function GoogleAccess({
  admin = false,
  children,
}: {
  admin?: boolean;
  children?: ReactNode;
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const button = useRef<HTMLDivElement>(null);
  const session = useContext(SessionContext);
  const [localProfile, localSetProfile] = useState<Profile | null>(null);
  const [localCredential, localSetCredential] = useState("");
  const { profile, setProfile, credential, setCredential } = session || {
    profile: localProfile,
    setProfile: localSetProfile,
    credential: localCredential,
    setCredential: localSetCredential,
  };
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(credential: string) {
    setBusy(true);
    setStatus("");
    setProfile(null);
    setCredential("");
    try {
      const response = await fetch(
        API_BASE + (admin ? "/api/v1/admin/session" : "/api/v1/account"),
        {
          headers: { Authorization: "Bearer " + credential },
          cache: "no-store",
        },
      );
      if (response.status === 403) {
        setStatus("This Google account does not have administrator access.");
        return;
      }
      if (!response.ok) throw new Error("Sign-in failed");
      setProfile((await response.json()) as Profile);
      setCredential(credential);
    } catch {
      setStatus("Google sign-in could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel">
        <h2>{admin ? "Administrator sign-in" : "Google account"}</h2>
        {process.env.NEXT_PUBLIC_INTERNAL_QA === "true" && !profile && (
          <div>
            <p>Isolated internal QA — no live orders or payments</p>
            <button onClick={() => void signIn("qa-customer")}>
              Use isolated customer
            </button>
            <button onClick={() => void signIn("qa-owner")}>
              Use isolated owner
            </button>
          </div>
        )}
        {clientId ? (
          <>
            <Script
              src="https://accounts.google.com/gsi/client"
              onReady={() => {
                const identity = (
                  window as Window & {
                    google?: { accounts: { id: GoogleIdentity } };
                  }
                ).google?.accounts.id;
                if (!identity || !button.current) return;
                identity.initialize({
                  client_id: clientId,
                  callback: ({ credential }) => {
                    void signIn(credential);
                  },
                });
                identity.renderButton(button.current, {
                  theme: "outline",
                  size: "large",
                  text: "continue_with",
                });
              }}
              onError={() =>
                setStatus("The Google sign-in button could not load.")
              }
            />
            <div ref={button} hidden={!!profile || busy} />
          </>
        ) : (
          <p>Google sign-in is unavailable on this deployment.</p>
        )}
        <p role="status">{busy ? "Verifying your Google account…" : status}</p>
        {admin && profile && !profile.is_admin && (
          <p role="alert">
            This Google account does not have administrator access.
          </p>
        )}
        {profile && (
          <div>
            <p>
              <strong>{profile.name || profile.email}</strong>
            </p>
            <p>{profile.email}</p>
            {!admin && profile.is_admin && (
              <p>
                <a href="/admin">Admin dashboard</a>
              </p>
            )}
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setProfile(null);
                setCredential("");
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </section>
      {profile && (!admin || profile.is_admin) && (
        <CredentialContext.Provider value={credential}>
          {children}
        </CredentialContext.Provider>
      )}
    </>
  );
}
