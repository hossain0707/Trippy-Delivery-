// First-party cookie bridge: long-lived session secrets never enter JavaScript storage.
// Fixed upstream prevents open-proxy/SSRF behavior. No new service or binding is required.
const UPSTREAM =
  "https://trippy-delivery-api-dev-1010753880203.asia-south1.run.app";
export async function proxyAuth(request, send = (input, init) => globalThis.fetch(input, init)) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (
    (origin && origin !== url.origin) ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  ) {
    return new Response("Untrusted origin", { status: 403 });
  }
  if (!["GET", "POST"].includes(request.method))
    return new Response("Method not allowed", { status: 405 });
  const route = url.pathname.slice("/api/v1/auth/".length);
  if (
    ![
      "configuration",
      "google",
      "signup",
      "signin",
      "verify-email",
      "forgot-password",
      "reset-password",
      "session",
      "signout",
    ].includes(route)
  ) {
    return new Response("Not found", { status: 404 });
  }
  const headers = new Headers({
    "Content-Type": "application/json",
    Origin: url.origin,
  });
  const cookie = request.headers.get("Cookie");
  if (cookie) {
    const session = cookie.split(";").map(v=>v.trim()).find(v=>v.startsWith("__Host-trippy_session="));
    if(session) headers.set("Cookie", session);
  }
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > 16000) return new Response("Request too large", { status: 413 });
  const body = request.method === "POST" ? await request.text() : undefined;
  if (body && new TextEncoder().encode(body).length > 16000)
    return new Response("Request too large", { status: 413 });
  let upstream;
  try {
    upstream = await send(UPSTREAM + "/api/v1/auth/" + route, {
      method: request.method, headers, body,
      // Workers supports manual/follow only. Never follow a redirect with session cookies.
      redirect: "manual",
    });
  } catch {
    return Response.json({detail:"The sign-in service is temporarily unavailable. Please retry."}, {status:502,headers:{"Cache-Control":"no-store"}});
  }
  if (upstream.status >= 300 && upstream.status < 400) {
    return Response.json({detail:"The sign-in service returned an unexpected redirect. Please retry later."}, {status:502,headers:{"Cache-Control":"no-store"}});
  }
  const output = new Headers(upstream.headers);
  output.set("Cache-Control", "no-store");
  output.set("Pragma", "no-cache");
  output.delete("Access-Control-Allow-Origin");
  output.delete("Access-Control-Allow-Credentials");
  return new Response(upstream.body, {
    status: upstream.status,
    headers: output,
  });
}
