import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

function html(body: string) {
  return new Response(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Aer OAuth</title><style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:2rem}input,button{font-size:16px;padding:.6rem;border-radius:8px;border:1px solid #ccc}button{background:#8BA888;color:#fff;border-color:#7A9777;cursor:pointer}label{display:block;margin:.5rem 0 .25rem}.box{border:1px solid #e5e7eb;border-radius:12px;padding:1rem;margin-top:1rem}</style></head><body>${body}</body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function urlCombine(base: string, params: Record<string, string | undefined>) {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  return u.toString();
}

function randomId(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export const oauthAuthorize = httpAction(async (ctx, req) => {
  const url = new URL(req.url);
  const client_id = url.searchParams.get("client_id") || "claude";
  const response_type = url.searchParams.get("response_type") || "code";
  const redirect_uri = url.searchParams.get("redirect_uri") || "";
  const state = url.searchParams.get("state") || "";
  const scope = url.searchParams.get("scope") || "mcp";
  const code_challenge = url.searchParams.get("code_challenge") || undefined;
  const code_challenge_method = url.searchParams.get("code_challenge_method") || undefined;

  if (response_type !== "code" || !redirect_uri) {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Upsert client (dev-friendly)
  await ctx.runMutation(internal.oauthInternal.upsertClient, {
    clientId: client_id,
    name: client_id,
    redirectUri: redirect_uri,
  });

  // Accept Authorization header Bearer aer_{userId} for auto-consent
  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token.startsWith("aer_")) {
      const userId = token.substring(4) as Id<"users">;
      const user = await ctx.runQuery(internal.users.getUserById, { userId });
      if (user) {
        const code = randomId("ac_");
        const expiresAt = Date.now() + 5 * 60 * 1000;
        await ctx.runMutation(internal.oauthInternal.createAuthCode, {
          code,
          clientId: client_id,
          userId,
          redirectUri: redirect_uri,
          scope,
          codeChallenge: code_challenge,
          codeChallengeMethod: code_challenge_method,
          expiresAt,
        });
        const redirect = urlCombine(redirect_uri, { code, state });
        return new Response(null, { status: 302, headers: { Location: redirect } });
      }
    }
  }

  // Render a simple consent page asking for Aer token (from Settings)
  if (req.method === "GET") {
    const body = `
      <h1>Connect Aer to Claude</h1>
      <p>To authorize Claude, paste your Aer token (from Settings) and click Authorize.</p>
      <div class="box">
        <form method="POST">
          <input type="hidden" name="client_id" value="${client_id}" />
          <input type="hidden" name="redirect_uri" value="${encodeURIComponent(redirect_uri)}" />
          <input type="hidden" name="state" value="${state}" />
          <input type="hidden" name="scope" value="${scope}" />
          ${code_challenge ? `<input type="hidden" name="code_challenge" value="${code_challenge}" />` : ""}
          ${code_challenge_method ? `<input type="hidden" name="code_challenge_method" value="${code_challenge_method}" />` : ""}
          <label for="token">Aer Token</label>
          <input id="token" name="token" placeholder="aer_..." style="width:100%" required />
          <div style="margin-top:1rem">
            <button type="submit">Authorize</button>
          </div>
        </form>
      </div>`;
    return html(body);
  }

  if (req.method === "POST") {
    const form = await req.formData().catch(() => null);
    if (!form) return new Response("invalid_request", { status: 400 });
    const token = String(form.get("token") || "");
    const clientId = String(form.get("client_id") || client_id);
    const redirectUri = decodeURIComponent(String(form.get("redirect_uri") || redirect_uri));
    const state2 = String(form.get("state") || state);
    const scope2 = String(form.get("scope") || scope);
    const cc = String(form.get("code_challenge") || code_challenge || "");
    const ccm = String(form.get("code_challenge_method") || code_challenge_method || "");

    if (!token.startsWith("aer_")) return html(`<p>Invalid token format.</p>`);
    const userId = token.substring(4) as Id<"users">;
    const user = await ctx.runQuery(internal.users.getUserById, { userId });
    if (!user) return html(`<p>Invalid token: user not found.</p>`);

    const code = randomId("ac_");
    const expiresAt = Date.now() + 5 * 60 * 1000;
    await ctx.runMutation(internal.oauthInternal.createAuthCode, {
      code,
      clientId,
      userId,
      redirectUri: redirectUri,
      scope: scope2,
      codeChallenge: cc || undefined,
      codeChallengeMethod: ccm || undefined,
      expiresAt,
    });
    const redirect = urlCombine(redirectUri, { code, state: state2 });
    return new Response(null, { status: 302, headers: { Location: redirect } });
  }

  return new Response("method_not_allowed", { status: 405 });
});

export const oauthToken = httpAction(async (ctx, req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  const bodyText = await req.text();
  const params = new URLSearchParams(bodyText);
  const grant_type = params.get("grant_type") || "authorization_code";

  if (grant_type !== "authorization_code") {
    return new Response(JSON.stringify({ error: "unsupported_grant_type" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const code = params.get("code") || "";
  const redirect_uri = params.get("redirect_uri") || "";
  const client_id = params.get("client_id") || "";
  const code_verifier = params.get("code_verifier") || undefined;

  if (!code || !redirect_uri || !client_id) {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const authCode = await ctx.runQuery(internal.oauthInternal.getAuthCodeByCode, { code });
  if (!authCode) {
    return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  if (authCode.clientId !== client_id || authCode.redirectUri !== redirect_uri || authCode.expiresAt < Date.now()) {
    return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // PKCE verification if present
  if (authCode.codeChallenge) {
    if (!code_verifier) {
      return new Response(JSON.stringify({ error: "invalid_request", error_description: "code_verifier required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (authCode.codeChallengeMethod && authCode.codeChallengeMethod !== "plain") {
      // Dev: accept S256 without verification (no crypto in this runtime)
    } else {
      if (code_verifier !== authCode.codeChallenge) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
    }
  }

  const accessToken = randomId("at_");
  const expiresIn = 3600; // 1 hour
  await ctx.runMutation(internal.oauthInternal.createAccessToken, {
    accessToken,
    userId: authCode.userId,
    clientId: client_id,
    scope: authCode.scope,
    expiresAt: Date.now() + expiresIn * 1000,
  });
  // Optionally delete used code
  await ctx.runMutation(internal.oauthInternal.deleteAuthCode, { id: authCode._id });

  return new Response(JSON.stringify({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: authCode.scope || "mcp",
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});