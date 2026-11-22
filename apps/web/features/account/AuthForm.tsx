"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  authRequest,
  updateSession,
  type AuthSession,
} from "@/lib/customer-session";
import { safeReturnPath } from "@/lib/session-store.mjs";
import { broadcastAuth, GoogleButton, GoogleAccess } from "./GoogleAccess";
export type AuthMode =
  "signin" | "signup" | "forgot-password" | "reset-password" | "verify-email";
export function PasswordField({
  label,
  value,
  onChange,
  confirm = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  confirm?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <span className="auth-password">
        <input
          type={show ? "text" : "password"}
          required
          minLength={12}
          maxLength={128}
          autoComplete={confirm ? "new-password" : "current-password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={(show ? "Hide " : "Show ") + label.toLowerCase()}
          aria-pressed={show}
          onClick={() => setShow((v) => !v)}
        >
          {show ? "Hide" : "Show"}
        </button>
      </span>
    </label>
  );
}
function returnPath() {
  if (typeof window === "undefined") return "/account";
  const next =
    new URLSearchParams(window.location.search).get("next") || "/account";
  return safeReturnPath(next);
}
export function AuthForm({
  initialMode = "signin",
  admin = false,
  initialBn = false,
  compact = false,
}: {
  initialMode?: AuthMode;
  admin?: boolean;
  initialBn?: boolean;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [bn, setBn] = useState(initialBn);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [emailReady, setEmailReady] = useState<boolean | null>(null);
  const [configError, setConfigError] = useState(false);
  const [token, setToken] = useState("");
  const router = useRouter();
  const t = (en: string, bengali: string) => (bn ? bengali : en);
  useEffect(() => {
    let active = true;
    void authRequest<{ email_enabled: boolean }>("configuration")
      .then((v) => {
        if (active) setEmailReady(v.email_enabled);
      })
      .catch(() => {
        if (active) setConfigError(true);
      });
    if (initialMode === "reset-password" || initialMode === "verify-email") {
      setToken(
        new URLSearchParams(window.location.hash.slice(1)).get("token") || "",
      );
      // The fragment never reaches server logs or referrers. Remove it from history after reading.
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
    return () => {
      active = false;
    };
    // Read the link once on mount; do not discard it during form edits.
  }, [initialMode]);
  function change(next: AuthMode) {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirm("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    if (
      (mode === "signup" || mode === "reset-password") &&
      password !== confirm
    ) {
      setError(t("Passwords do not match.", "পাসওয়ার্ড মেলে না।"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const s = await authRequest<AuthSession>("signin", {
          email,
          password,
          remember,
        });
        updateSession(s);
        broadcastAuth("signin");
      } else if (mode === "signup") {
        await authRequest("signup", { email, name, password });
        setPassword("");
        setConfirm("");
        setMessage(
          t(
            "If this address is eligible, check your email for a verification link. Already using Google? Continue with Google below.",
            "ঠিকানাটি যোগ্য হলে যাচাইকরণ লিংকের জন্য ইমেইল দেখুন। আগে Google ব্যবহার করলে নিচে Google দিয়ে সাইন ইন করুন।",
          ),
        );
      } else if (mode === "forgot-password") {
        await authRequest("forgot-password", { email });
        setMessage(
          t(
            "If this address is eligible, check your email for the next steps. Google accounts use Google sign-in.",
            "ঠিকানাটি যোগ্য হলে পরবর্তী ধাপের জন্য ইমেইল দেখুন। Google অ্যাকাউন্টে Google দিয়ে সাইন ইন করুন।",
          ),
        );
      } else if (mode === "reset-password") {
        await authRequest("reset-password", { token, password });
        setToken("");
        setPassword("");
        setConfirm("");
        change("signin");
        setMessage(
          t(
            "Password updated. Sign in with your new password.",
            "পাসওয়ার্ড বদলেছে। নতুন পাসওয়ার্ড দিয়ে সাইন ইন করুন।",
          ),
        );
      } else {
        const s = await authRequest<AuthSession>("verify-email", { token });
        updateSession(s);
        broadcastAuth("signin");
        router.replace("/account");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const title =
    mode === "signin"
      ? t("Welcome back", "আবার স্বাগতম")
      : mode === "signup"
        ? t("Create your account", "আপনার অ্যাকাউন্ট তৈরি করুন")
        : mode === "forgot-password"
          ? t("Reset your password", "পাসওয়ার্ড পুনরুদ্ধার করুন")
          : mode === "reset-password"
            ? t("Choose a new password", "নতুন পাসওয়ার্ড দিন")
            : t("Verify your email", "ইমেইল যাচাই করুন");
  const emailBlocked =
    emailReady !== true && (mode === "signup" || mode === "forgot-password");
  return (
    <section className={"auth-shell " + (compact ? "auth-compact" : "")}>
      <div className="auth-brand">
        <Link href="/">
          TRIPPY <span>Delivery</span>
        </Link>
        <button type="button" onClick={() => setBn((v) => !v)}>
          {bn ? "English" : "বাংলা"}
        </button>
      </div>
      <div className="auth-card">
        <p className="kicker">
          {admin ? "OWNER ACCESS" : "YOUR TRIPPY ACCOUNT"}
        </p>
        <h1>{title}</h1>
        <p>
          {admin
            ? t(
                "Owner administration uses the designated Google account.",
                "মালিকের নির্ধারিত Google অ্যাকাউন্ট ব্যবহার করুন।",
              )
            : t(
                "Your saved details, basket and orders—all in one place.",
                "সংরক্ষিত তথ্য, বাজারের ঝুড়ি ও অর্ডার—এক জায়গায়।",
              )}
        </p>
        {!admin && (
          <>
            {emailReady === false && (
              <p className="auth-notice">
                {t(
                  "Email registration and password-reset delivery are not enabled yet. You can sign in securely with Google and stay signed in.",
                  "ইমেইল নিবন্ধন ও পাসওয়ার্ড রিসেট এখনো চালু হয়নি। Google দিয়ে নিরাপদে সাইন ইন করুন।",
                )}
              </p>
            )}
            {configError && (
              <p role="alert">
                {t(
                  "Could not check sign-in availability. Reload to try again.",
                  "সাইন ইন সেবার তথ্য পাওয়া যায়নি। আবার পৃষ্ঠা খুলুন।",
                )}
              </p>
            )}
            <form onSubmit={submit}>
              {mode === "signup" && (
                <label>
                  {t("Full name", "পুরো নাম")}
                  <input
                    autoComplete="name"
                    required
                    maxLength={120}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              )}
              {["signin", "signup", "forgot-password"].includes(mode) && (
                <label>
                  {t("Email", "ইমেইল")}
                  <input
                    type="email"
                    required
                    maxLength={254}
                    autoComplete={mode === "signin" ? "username" : "email"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              {["signin", "signup", "reset-password"].includes(mode) && (
                <PasswordField
                  label={t(
                    mode === "reset-password" ? "New password" : "Password",
                    mode === "reset-password" ? "নতুন পাসওয়ার্ড" : "পাসওয়ার্ড",
                  )}
                  value={password}
                  onChange={setPassword}
                  confirm={mode !== "signin"}
                />
              )}
              {["signup", "reset-password"].includes(mode) && (
                <>
                  <small>
                    {t("Use 12–128 characters.", "১২–১২৮ অক্ষর ব্যবহার করুন।")}
                  </small>
                  <PasswordField
                    label={t("Confirm password", "পাসওয়ার্ড নিশ্চিত করুন")}
                    value={confirm}
                    onChange={setConfirm}
                    confirm
                  />
                </>
              )}
              {mode === "signin" && (
                <div className="auth-row">
                  <label className="auth-check">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    {t("Keep me signed in", "সাইন ইন রাখা হোক")}
                  </label>
                  <button
                    type="button"
                    className="auth-text"
                    onClick={() => change("forgot-password")}
                  >
                    {t("Forgot password?", "পাসওয়ার্ড ভুলে গেছেন?")}
                  </button>
                </div>
              )}
              {mode === "signup" && (
                <label className="auth-check">
                  <input
                    type="checkbox"
                    required
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  {t(
                    "I have access to this email address.",
                    "এই ইমেইল ঠিকানায় আমার প্রবেশাধিকার আছে।",
                  )}
                </label>
              )}
              {mode === "verify-email" && (
                <p>
                  {t(
                    "Confirm to finish verifying your email and sign in.",
                    "ইমেইল যাচাই শেষ করে সাইন ইন করতে নিশ্চিত করুন।",
                  )}
                </p>
              )}
              {["verify-email", "reset-password"].includes(mode) && !token && (
                <p role="alert">
                  {t(
                    "Open the complete link from your email. If it has expired, request another.",
                    "ইমেইলের সম্পূর্ণ লিংক খুলুন। মেয়াদ শেষ হলে নতুন লিংক নিন।",
                  )}
                </p>
              )}
              <button
                className="primary auth-submit"
                disabled={
                  busy ||
                  emailBlocked ||
                  (mode === "signup" && !ack) ||
                  (["reset-password", "verify-email"].includes(mode) && !token)
                }
              >
                {busy
                  ? t("Please wait…", "অপেক্ষা করুন…")
                  : mode === "signin"
                    ? t("Sign in", "সাইন ইন")
                    : mode === "signup"
                      ? t("Create account", "অ্যাকাউন্ট তৈরি করুন")
                      : mode === "forgot-password"
                        ? t("Send reset link", "রিসেট লিংক পাঠান")
                        : mode === "verify-email"
                          ? t("Verify email & sign in", "ইমেইল যাচাই ও সাইন ইন")
                          : t("Save new password", "নতুন পাসওয়ার্ড সংরক্ষণ করুন")}
              </button>
            </form>
          </>
        )}
        <p role="alert" className="auth-error">
          {error}
        </p>
        <p role="status">{message}</p>
        {(admin || !["verify-email", "reset-password"].includes(mode)) && (
          <>
            <div className="auth-divider">
              {admin
                ? t("Continue securely", "নিরাপদে এগিয়ে যান")
                : t("or", "অথবা")}
            </div>
            <GoogleButton onStatus={setMessage} />
          </>
        )}
        {!admin && (
          <p className="auth-bottom">
            {mode === "signin" ? (
              <>
                {t("New here?", "নতুন ব্যবহারকারী?")}{" "}
                <button className="auth-text" onClick={() => change("signup")}>
                  {t("Create account", "অ্যাকাউন্ট তৈরি করুন")}
                </button>
              </>
            ) : (
              <button className="auth-text" onClick={() => change("signin")}>
                ← {t("Back to sign in", "সাইন ইন পৃষ্ঠায় ফিরুন")}
              </button>
            )}
          </p>
        )}
        <p className="auth-security">
          {t(
            "Your profile stays with your account. Never share your password or verification link.",
            "আপনার প্রোফাইল অ্যাকাউন্টে থাকে। পাসওয়ার্ড বা যাচাইকরণ লিংক কাউকে দেবেন না।",
          )}
        </p>
      </div>
    </section>
  );
}
function RedirectSignedIn() {
  const router = useRouter();
  useEffect(() => router.replace(returnPath()), [router]);
  return <p role="status">Opening your account…</p>;
}
export function AuthPage({ mode }: { mode: AuthMode }) {
  if (mode === "reset-password" || mode === "verify-email")
    return (
      <main className="auth-page">
        <AuthForm initialMode={mode} />
      </main>
    );
  return (
    <main className="auth-page">
      <GoogleAccess mode={mode}>
        <RedirectSignedIn />
      </GoogleAccess>
      <noscript>JavaScript is required to sign in.</noscript>
    </main>
  );
}
