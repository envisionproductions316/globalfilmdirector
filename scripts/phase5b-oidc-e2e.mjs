/**
 * Phase 5B automated OIDC proof against a running Envision issuer.
 * Registers/logs in via Envision session APIs, then completes gfd-web and gfd-desktop
 * authorization-code + PKCE flows and asserts the same sub.
 *
 * Usage:
 *   node scripts/phase5b-oidc-e2e.mjs
 * Env:
 *   ENVISION_ORIGIN (default http://127.0.0.1:8000)
 */
import { createHash, randomBytes, createPublicKey, createVerify } from "node:crypto";
import assert from "node:assert/strict";

const origin = (process.env.ENVISION_ORIGIN || "http://127.0.0.1:8000").replace(/\/$/, "");
const email = `gfd-phase5b-${Date.now()}@example.test`;
const password = "Phase5b-test-password-12";

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function pkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function decodeJwt(token) {
  const [, payload] = token.split(".");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

async function verifyIdToken(idToken, clientId, nonce) {
  const [headerB64, payloadB64, signatureB64] = idToken.split(".");
  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  const payload = decodeJwt(idToken);
  assert.equal(header.alg, "RS256");
  assert.equal(String(payload.iss || "").replace(/\/$/, ""), origin);
  assert.ok(payload.aud === clientId || (Array.isArray(payload.aud) && payload.aud.includes(clientId)));
  assert.equal(payload.nonce, nonce);
  assert.ok(payload.sub);
  const jwks = await (await fetch(`${origin}/oauth/jwks`)).json();
  const jwk = jwks.keys.find((k) => k.kid === header.kid) || jwks.keys[0];
  const key = createPublicKey({ key: jwk, format: "jwk" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  assert.ok(verifier.verify(key, Buffer.from(signatureB64, "base64url")));
  return payload;
}

function cookieFrom(response) {
  const raw = response.headers.getSetCookie?.() || [];
  if (raw.length) return raw.map((c) => c.split(";")[0]).join("; ");
  const single = response.headers.get("set-cookie");
  return single ? single.split(";")[0] : "";
}

function mergeCookies(existing, response) {
  const jar = new Map();
  for (const piece of String(existing || "")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)) {
    jar.set(piece.split("=")[0], piece);
  }
  const raw = response.headers.getSetCookie?.() || [];
  const extras = raw.length ? raw : response.headers.get("set-cookie") ? [response.headers.get("set-cookie")] : [];
  for (const item of extras) {
    const piece = String(item).split(";")[0].trim();
    if (!piece) continue;
    jar.set(piece.split("=")[0], piece);
  }
  return [...jar.values()].join("; ");
}

async function main() {
  const discovery = await (await fetch(`${origin}/.well-known/openid-configuration`)).json();
  assert.equal(discovery.issuer.replace(/\/$/, ""), origin);
  assert.ok(discovery.code_challenge_methods_supported.includes("S256"));

  const signup = await fetch(`${origin}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password, passwordConfirm: password, displayName: "GFD Phase5B" }),
  });
  if (!signup.ok) throw new Error(`signup failed: ${signup.status} ${await signup.text()}`);
  let cookie = cookieFrom(signup);
  if (!cookie) {
    const login = await fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ email, password }),
    });
    if (!login.ok) throw new Error(`login failed: ${await login.text()}`);
    cookie = cookieFrom(login);
  }
  assert.ok(cookie, "missing Envision session cookie");

  const session = await fetch(`${origin}/api/auth/session`, { headers: { Cookie: cookie, Origin: origin } });
  const sessionBody = await session.json().catch(() => ({}));
  if (!session.ok) throw new Error(`session failed: ${JSON.stringify(sessionBody)}`);
  const sessionUser = sessionBody.user;
  assert.ok(sessionUser?.id, "Envision session missing user id");

  async function codeFlow(clientId, redirectUri) {
    const { verifier, challenge } = pkce();
    const state = b64url(randomBytes(16));
    const nonce = b64url(randomBytes(16));
    const authorizeUrl = new URL(discovery.authorization_endpoint);
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "openid profile email offline_access");
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("nonce", nonce);
    authorizeUrl.searchParams.set("code_challenge", challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    let location = authorizeUrl.toString();
    let hops = 0;
    let code = "";
    let jar = cookie;
    while (hops < 8) {
      hops += 1;
      const res = await fetch(location, { redirect: "manual", headers: { Cookie: jar } });
      jar = mergeCookies(jar, res);
      const next = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && next) {
        const absolute = new URL(next, origin);
        if (
          absolute.href.startsWith(redirectUri) ||
          (redirectUri.includes("/callback") && absolute.pathname === "/callback" && absolute.hostname === "127.0.0.1")
        ) {
          assert.equal(absolute.searchParams.get("state"), state);
          code = absolute.searchParams.get("code") || "";
          break;
        }
        location = absolute.href;
        continue;
      }
      const body = await res.text();
      throw new Error(`Authorize did not redirect with code (${res.status}): ${body.slice(0, 200)}`);
    }
    assert.ok(code, "missing authorization code");

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });
    const tokenRes = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: tokenBody,
    });
    const tokens = await tokenRes.json().catch(() => ({}));
    if (tokenRes.status !== 200) {
      throw new Error(`token exchange failed: ${tokenRes.status} ${JSON.stringify(tokens)}`);
    }
    assert.ok(tokens.id_token);
    assert.ok(tokens.refresh_token);
    const claims = await verifyIdToken(tokens.id_token, clientId, nonce);
    return { claims, tokens };
  }

  const web = await codeFlow("gfd-web", "http://127.0.0.1:5180/auth/callback");
  const desktop = await codeFlow("gfd-desktop", "http://127.0.0.1:54321/callback");
  assert.equal(web.claims.sub, desktop.claims.sub, "web and desktop must share the same sub");
  assert.equal(web.claims.sub, sessionUser.id, "OIDC sub must match Envision user id");

  const refreshed = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: "gfd-desktop",
      refresh_token: desktop.tokens.refresh_token,
    }),
  });
  const refreshedTokens = await refreshed.json().catch(() => ({}));
  if (refreshed.status !== 200) throw new Error(`refresh failed: ${JSON.stringify(refreshedTokens)}`);
  assert.ok(refreshedTokens.access_token);
  assert.ok(refreshedTokens.refresh_token);
  assert.notEqual(refreshedTokens.refresh_token, desktop.tokens.refresh_token, "refresh token should rotate");

  const revoke = await fetch(`${origin}/oauth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      token: refreshedTokens.refresh_token,
      token_type_hint: "refresh_token",
      client_id: "gfd-desktop",
    }),
  });
  assert.ok(revoke.status === 200 || revoke.status === 204, `revoke status ${revoke.status}`);

  const afterRevoke = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: "gfd-desktop",
      refresh_token: refreshedTokens.refresh_token,
    }),
  });
  assert.notEqual(afterRevoke.status, 200, "revoked refresh token must be rejected");

  console.log(
    JSON.stringify(
      {
        ok: true,
        issuer: origin,
        email,
        sub: web.claims.sub,
        webAud: web.claims.aud,
        desktopAud: desktop.claims.aud,
        sameSub: true,
        refreshRotated: true,
        revokeRejectedReuse: true,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
