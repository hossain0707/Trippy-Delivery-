import { authenticatedFetch } from "./customer-session";
import { API_BASE } from "./api";
export async function authApi<T>(
  token: string,
  path: string,
  method = "GET",
  payload?: unknown,
): Promise<T> {
  const response = await authenticatedFetch(
    API_BASE + "/api/v1" + path,
    {
      method,
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    },
    token,
  );
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Request failed (" + response.status + ")",
    );
  return data as T;
}
