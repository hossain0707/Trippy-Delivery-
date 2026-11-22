# Customer authentication and persistent sessions

Customer pages: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password` and `/verify-email`. Embedded checkout/account sign-in uses the same forms. English and Bengali copy and password visibility toggles are included. Owner access continues to require the designated, verified Google identity; email/password never grants admin rights.

Google identity exchange preserves the existing `google:<sub>` key, so profiles, checkout defaults and order history stay attached. Previously registered Google customers should continue using Google, not create a duplicate password account. Different verified identities are never silently merged by email.

## Session continuity

Cloudflare Pages Functions at `apps/web/functions/api/v1/auth/[[path]].ts` bridges the fixed Cloud Run auth routes. This sets a first-party `__Host-trippy_session` cookie with Secure, HttpOnly and SameSite=Lax. No session secret, password or long-lived bearer is saved in localStorage/sessionStorage. Access grants live only in memory for 15 minutes; the root provider restores on reload, refreshes every 10 minutes and on focus, and retries an expired access grant once. The bridge is essential: direct cross-site cookies on run.app can be blocked by browsers.

Customer persistent sessions last 30 days when Keep me signed in is checked. Otherwise the cookie is browser-session-only, capped at 24 hours server-side. Google sign-in uses persistent customer sessions. Owner sessions are capped at 8 hours. Logout revokes the current session and its access grants; other tabs receive a sign-out signal. Password reset revokes all sessions. This does not promise permanent login after explicit sign-out, expiry, deleted cookies, or use of a different browser/device.

## Email activation

No email provider is created, purchased or assumed. Without SMTP configuration, the deployed forms clearly state that email registration/recovery is unavailable and offer working Google sign-in. Do not present a pretend email success or expose reset links in API output/logs.

Set these runtime environment values on the existing Cloud Run service using the existing secret-management process:

| Setting | Meaning |
| --- | --- |
| `SMTP_HOST` | Approved transactional SMTP hostname |
| `SMTP_PORT` | 587 with mandatory STARTTLS, or 465 with TLS |
| `SMTP_USERNAME` | SMTP account |
| `SMTP_PASSWORD` | Secret Manager reference; never commit or paste into chat |
| `SMTP_FROM` | Verified sender address |
| `CUSTOMER_APP_ORIGIN` | Canonical HTTPS frontend, defaults to https://trippy-delivery.pages.dev |

Email signup requires mailbox verification before sign-in. Reset and verification links expire after 30 minutes, are single-use, and use URL fragments to avoid server query logs. Signup and recovery responses do not disclose whether an account exists. Scrypt uses N=131072, r=8, p=1 with random salts. Failed login and mail requests are limited per email over 15 minutes in the database; normal per-instance write throttling also remains enabled. There is no payment credential storage.

The additive `0006_customer_auth` migration adds five auth tables and leaves existing business records untouched. CI checks migration metadata and repeat startup. Automated tests cover verification, expiry, logout, reset revocation, failed mail, password validation, session restoration, Google subject preservation, admin separation, origin checks and login throttling. Live email delivery requires a configured sender and recipient inbox validation.
