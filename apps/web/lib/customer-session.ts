import { API_BASE } from "./api";
import { createSessionStore } from "./session-store.mjs";
export type AuthProfile = {
  name: string | null;
  email: string;
  is_admin: boolean;
};
export type AuthSession = {
  profile: AuthProfile;
  credential: string;
  expires_in: number;
};
const sessionStore = createSessionStore<AuthSession>(() =>
  authRequest<AuthSession>("session", {}),
);
export const updateSession = sessionStore.set;
export const watchSession = sessionStore.subscribe;
export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function authRequest<T>(
  path: string,
  payload?: unknown,
): Promise<T> {
  // Pages Functions keeps the HttpOnly cookie first-party on the deployed site.
  const base =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? API_BASE
      : "";
  const response = await fetch(base + "/api/v1/auth/" + path, {
    method: payload === undefined ? "GET" : "POST",
    credentials: "include",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok)
    throw new AuthError(
      typeof data.detail === "string"
        ? data.detail
        : "Please check your information and try again.",
      response.status,
    );
  return data as T;
}
export const restoreSession = sessionStore.restore;
export async function authenticatedFetch(
  url: string,
  init: RequestInit,
  token: string,
) {
  const make = (value: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", "Bearer " + value);
    return fetch(url, { ...init, headers });
  };
  const value =
    token.startsWith("td_access_") && sessionStore.get()
      ? sessionStore.get()!.credential
      : token;
  const response = await make(value);
  if (response.status !== 401 || !token.startsWith("td_access_"))
    return response;
  try {
    return await make((await restoreSession()).credential);
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) updateSession(null);
    return response;
  }
}
