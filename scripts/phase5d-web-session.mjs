/**
 * Phase 5D — GFD website BFF session lifecycle (callback cookies → retain → logout).
 * Requires Envision (:8000) and GFD (:5180) running locally.
 */
import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const envision = (process.env.ENVISION_ORIGIN || "http://127.0.0.1:8000").replace(/\/$/, "");
const gfd = (process.env.GFD_ORIGIN || "http://127.0.0.1:5180").replace(/\/$/, "");
const email = `gfd-phase5d-web-${Date.now()}@example.test`;
const password = "Phase5D-web-session-12";
const redirectUri = `${gfd}/auth/callback`;

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function pkce() {
  const verifier = b64url(randomBytes(32));
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
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
  const discovery = await (await fetch(`${envision}/.well-known/openid-configuration`)).json();
  const gfdConfigRes = await (await fetch(`${gfd}/api/auth/config`)).json();
  const gfdConfig = gfdConfigRes.config || gfdConfigRes;
  assert.ok(gfdConfig.configured, "GFD /api/auth/config must report configured");

  const signup = await fetch(`${envision}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: envision },
    body: JSON.stringify({ email, password, passwordConfirm: password, displayName: "Phase5D Web" }),
  });
  assert.ok(signup.ok, await signup.text());
  let jar = cookieFrom(signup);
  assert.ok(jar, "envision session cookie");

  const { verifier, challenge } = pkce();
  const state = b64url(randomBytes(16));
  const nonce = b64url(randomBytes(16));
  const authorizeUrl = new URL(discovery.authorization_endpoint);
  authorizeUrl.searchParams.set("client_id", "gfd-web");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid profile email offline_access");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("nonce", nonce);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  let location = authorizeUrl.toString();
  let code = "";
  for (let hops = 0; hops < 8; hops += 1) {
    const res = await fetch(location, { redirect: "manual", headers: { Cookie: jar } });
    jar = mergeCookies(jar, res);
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      const absolute = new URL(next, envision);
      if (absolute.href.startsWith(redirectUri) || absolute.pathname === "/auth/callback") {
        assert.equal(absolute.searchParams.get("state"), state);
        code = absolute.searchParams.get("code") || "";
        break;
      }
      location = absolute.href;
      continue;
    }
    throw new Error(`Authorize did not redirect with code (${res.status})`);
  }
  assert.ok(code, "missing authorization code");

  const exchange = await fetch(`${gfd}/api/auth/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, verifier, nonce, redirectUri }),
  });
  const exchangeBody = await exchange.json().catch(() => ({}));
  assert.equal(exchange.ok, true, JSON.stringify(exchangeBody));
  let gfdJar = cookieFrom(exchange);
  assert.match(gfdJar, /gfd_auth_session=/, `session cookie missing: ${gfdJar}`);

  const session1 = await (await fetch(`${gfd}/api/auth/session`, { headers: { Cookie: gfdJar } })).json();
  assert.ok(session1.session?.user?.id, "session after callback");
  const sub = session1.session.user.id;

  const session2 = await (await fetch(`${gfd}/api/auth/session`, { headers: { Cookie: gfdJar } })).json();
  assert.equal(session2.session?.user?.id, sub, "session retained");

  const logout = await fetch(`${gfd}/api/auth/logout`, { method: "POST", headers: { Cookie: gfdJar } });
  assert.ok(logout.ok, await logout.text());
  const after = await (
    await fetch(`${gfd}/api/auth/session`, {
      headers: {
        Cookie: gfdJar
          .split(";")
          .map((p) => p.trim())
          .filter((p) => p && !p.startsWith("gfd_auth_session=") && !p.startsWith("gfd_auth_tokens="))
          .join("; "),
      },
    })
  ).json();
  assert.equal(after.session, null, "logout clears session");

  console.log(JSON.stringify({ ok: true, sub, email, sessionRetained: true, logoutClearsSession: true }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
