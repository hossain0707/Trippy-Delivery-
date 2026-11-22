"use client";
import Script from "next/script";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AuthError,
  authRequest,
  restoreSession,
  updateSession,
  watchSession,
  type AuthProfile,
  type AuthSession,
} from "@/lib/customer-session";
import { AuthForm, type AuthMode } from "./AuthForm";

type SessionState = {
  profile: AuthProfile | null;
  credential: string;
  loading: boolean;
  error: string;
  retry: () => void;
};
const SessionContext = createContext<SessionState | null>(null);
const CredentialContext = createContext("");
export const useCredential = () => useContext(CredentialContext);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => watchSession(setSession), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    restoreSession()
      .catch((e) => {
        if (!active) return;
        if (e instanceof AuthError && e.status === 401) {
          updateSession(null);
          setError("");
        } else
          setError(
            "Your account could not be restored. Please check your connection and retry.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const refresh = () => {
      if (document.visibilityState === "visible")
        void restoreSession().catch((e) => {
          if (e instanceof AuthError && e.status === 401) updateSession(null);
        });
    };
    const timer = setInterval(refresh, 10 * 60 * 1000);
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("trippy-auth")
        : null;
    if (channel)
      channel.onmessage = (event) => {
        if (event.data === "signout") updateSession(null);
        else if (event.data === "signin")
          void restoreSession().catch((e) => {
            if (e instanceof AuthError && e.status === 401) updateSession(null);
          });
      };
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      channel?.close();
      window.removeEventListener("focus", refresh);
    };
  }, [retry]);
  return (
    <SessionContext.Provider
      value={{
        profile: session?.profile || null,
        credential: session?.credential || "",
        loading,
        error,
        retry: () => setRetry((v) => v + 1),
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function broadcastAuth(event: "signin" | "signout") {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel("trippy-auth");
    channel.postMessage(event);
    channel.close();
  }
}
export function GoogleButton({
  onStatus,
}: {
  onStatus: (value: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  function initialize() {
    const identity = (
      window as Window & {
        google?: {
          accounts: {
            id: {
              initialize: (options: {
                client_id: string;
                callback: (response: { credential: string }) => void;
              }) => void;
              renderButton: (
                element: HTMLElement,
                options: Record<string, string>,
              ) => void;
            };
          };
        };
      }
    ).google?.accounts.id;
    if (!identity || !ref.current || !clientId) return;
    identity.initialize({
      client_id: clientId,
      callback: ({ credential }) => {
        onStatus("Verifying your Google account…");
        void authRequest<AuthSession>("google", { credential })
          .then((s) => {
            updateSession(s);
            broadcastAuth("signin");
            onStatus("");
          })
          .catch((e) => onStatus(e.message));
      },
    });
    identity.renderButton(ref.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
    });
  }
  return clientId ? (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        onReady={initialize}
        onError={() =>
          onStatus("Google sign-in could not load. Please try again.")
        }
      />
      <div ref={ref} className="auth-google" />
    </>
  ) : (
    <p>Google sign-in is unavailable.</p>
  );
}
export function GoogleAccess({
  admin = false,
  compact = false,
  bn = false,
  mode = "signin",
  children,
}: {
  admin?: boolean;
  compact?: boolean;
  bn?: boolean;
  mode?: AuthMode;
  children?: ReactNode;
}) {
  const session = useContext(SessionContext);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  if (!session) return <p role="alert">Session provider is unavailable.</p>;
  if (session.loading)
    return (
      <section className="panel" role="status">
        {bn ? "আপনার অ্যাকাউন্ট খোঁজা হচ্ছে…" : "Restoring your signed-in account…"}
      </section>
    );
  if (session.error && !session.profile)
    return (
      <section className="panel">
        <p role="alert">{session.error}</p>
        <button className="secondary" onClick={session.retry}>
          Retry account
        </button>
      </section>
    );
  if (!session.profile)
    return (
      <AuthForm
        admin={admin}
        initialMode={mode}
        initialBn={bn}
        compact={compact}
      />
    );
  const { profile, credential } = session;
  return (
    <>
      <section className={compact ? "panel checkout-session" : "panel"}>
        <h2>
          {admin
            ? "Administrator account"
            : bn
              ? "আপনার অ্যাকাউন্টে সাইন ইন করা আছে"
              : "Signed in to your account"}
        </h2>
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
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void authRequest("signout", {})
                .then(() => {
                  updateSession(null);
                  broadcastAuth("signout");
                })
                .catch(() => setStatus("Could not sign out. Please try again."))
                .finally(() => setBusy(false));
            }}
          >
            {bn ? "সাইন আউট" : "Sign out"}
          </button>
          <p role="status">{status}</p>
        </div>
        {admin && !profile.is_admin && (
          <p role="alert">
            This account does not have owner access. Sign in with the designated
            Google owner account.
          </p>
        )}
      </section>
      {(!admin || profile.is_admin) && (
        <CredentialContext.Provider value={credential}>
          {children}
        </CredentialContext.Provider>
      )}
    </>
  );
}
