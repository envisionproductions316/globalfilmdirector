/**
 * Desktop OIDC authorization-code + PKCE.
 * Tokens stored only via Electron safeStorage — never plaintext files / localStorage.
 */
import { safeStorage, shell } from "electron";
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { app } from "electron";
import { verifyIdToken } from "./verify-id-token.mjs";

function base64Url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function randomUrlSafe(size = 32) {
  return base64Url(randomBytes(size));
}

function sha256Base64Url(input) {
  return createHash("sha256").update(input).digest("base64url");
}

function vaultPath() {
  const dir = path.join(app.getPath("userData"), "gfd-auth");
  mkdirSync(dir, { recursive: true });
  return path.join(dir, "session.bin");
}

function readConfig() {
  const issuer = (process.env.AUTH_ISSUER || process.env.NEXT_PUBLIC_AUTH_ISSUER || "").trim().replace(/\/$/, "");
  // Always use the desktop public client unless explicitly overridden — never the web client_id.
  const clientId = (process.env.AUTH_DESKTOP_CLIENT_ID || "gfd-desktop").trim();
  const authorizationEndpoint =
    (process.env.AUTH_AUTHORIZATION_ENDPOINT || process.env.NEXT_PUBLIC_AUTH_AUTHORIZATION_ENDPOINT || "").trim() ||
    (issuer ? `${issuer}/oauth/authorize` : "");
  const tokenEndpoint =
    (process.env.AUTH_TOKEN_ENDPOINT || process.env.NEXT_PUBLIC_AUTH_TOKEN_ENDPOINT || "").trim() ||
    (issuer ? `${issuer}/oauth/token` : "");
  const scopes = (process.env.AUTH_SCOPES || process.env.NEXT_PUBLIC_AUTH_SCOPES || "openid profile email offline_access").trim();
  return {
    configured: Boolean(issuer && clientId && authorizationEndpoint && tokenEndpoint),
    issuer,
    clientId,
    authorizationEndpoint,
    tokenEndpoint,
    scopes,
  };
}

function encodeVault(payload) {
  const json = JSON.stringify(payload);
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(json);
  }
  // Fallback is still under userData; marked so we never pretend it is OS-encrypted.
  return Buffer.from(JSON.stringify({ insecureFallback: true, json }), "utf8");
}

function decodeVault(buffer) {
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return JSON.parse(safeStorage.decryptString(buffer));
    } catch {
      /* try insecure shape */
    }
  }
  try {
    const parsed = JSON.parse(buffer.toString("utf8"));
    if (parsed?.insecureFallback && typeof parsed.json === "string") return JSON.parse(parsed.json);
    return parsed;
  } catch {
    return null;
  }
}

function readVaultPayload() {
  const file = vaultPath();
  if (!existsSync(file)) return null;
  try {
    const payload = decodeVault(readFileSync(file));
    if (!payload?.user?.id) return null;
    return payload;
  } catch {
    return null;
  }
}

export function loadDesktopSession() {
  const payload = readVaultPayload();
  if (!payload?.expiresAt || payload.expiresAt < Date.now()) return null;
  return {
    user: payload.user,
    expiresAt: payload.expiresAt,
    accessToken: payload.accessToken || "",
    refreshToken: payload.refreshToken || "",
    source: "desktop",
  };
}

async function revokeRefreshToken(refreshToken) {
  if (!refreshToken) return;
  const config = readConfig();
  if (!config.configured) return;
  const form = new URLSearchParams({
    token: refreshToken,
    token_type_hint: "refresh_token",
    client_id: config.clientId,
  });
  try {
    await fetch(`${config.issuer}/oauth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form,
    });
  } catch {
    /* best-effort */
  }
}

export async function clearDesktopSession() {
  const payload = readVaultPayload();
  if (payload?.refreshToken) await revokeRefreshToken(payload.refreshToken);
  const file = vaultPath();
  if (existsSync(file)) unlinkSync(file);
}

function saveDesktopSession(payload) {
  writeFileSync(vaultPath(), encodeVault(payload));
}

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

function waitForCode(port, expectedState) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        server.close();
      } catch {
        /* ignore */
      }
      fn(value);
    };
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
        if (url.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const error = url.searchParams.get("error");
        const code = url.searchParams.get("code") || "";
        const state = url.searchParams.get("state") || "";
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<html><body><p>You can close this window and return to Global Film Director.</p></body></html>");
        if (error) finish(reject, new Error(error));
        else if (!code || state !== expectedState) finish(reject, new Error("Invalid auth callback."));
        else finish(resolve, code);
      } catch (error) {
        finish(reject, error instanceof Error ? error : new Error("Auth callback failed."));
      }
    });
    const timer = setTimeout(() => {
      finish(reject, new Error("Sign-in timed out. Try again."));
    }, 5 * 60 * 1000);
    server.listen(port, "127.0.0.1");
    server.on("error", (error) => finish(reject, error));
  });
}

async function exchangeCode({ tokenEndpoint, clientId, redirectUri, code, verifier }) {
  // gfd-desktop is a public client — never send a client_secret from the desktop binary.
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error_description || json.error || "Token exchange failed.");
  }
  return json;
}

async function refreshTokens({ tokenEndpoint, clientId, refreshToken }) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken,
  });
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error_description || json.error || "Token refresh failed.");
  }
  return json;
}

function decodeJwtPayload(token) {
  try {
    const part = String(token).split(".")[1];
    if (!part) return {};
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

export async function beginDesktopAuth({ mode = "login" } = {}) {
  const config = readConfig();
  if (!config.configured) {
    return {
      error:
        "Sign-in is not configured. Set AUTH_ISSUER to your Envision Cloud origin (desktop client defaults to gfd-desktop). GFD does not store passwords.",
    };
  }
  if (!safeStorage.isEncryptionAvailable() && process.env.AUTH_REQUIRE_SAFE_STORAGE === "1") {
    return { error: "OS secure storage is unavailable. Enable encryption or unset AUTH_REQUIRE_SAFE_STORAGE." };
  }
  const verifier = randomUrlSafe(32);
  const challenge = sha256Base64Url(verifier);
  const state = randomUrlSafe(16);
  const nonce = randomUrlSafe(16);
  const port = await pickFreePort();
  const redirectUri = `http://127.0.0.1:${port}/callback`;
  const authorize = new URL(config.authorizationEndpoint);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", config.scopes);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("nonce", nonce);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  if (mode === "signup") {
    authorize.searchParams.set("prompt", "login");
    authorize.searchParams.set("screen_hint", "signup");
  }
  const codePromise = waitForCode(port, state);
  await shell.openExternal(authorize.toString());
  const code = await codePromise;
  const tokens = await exchangeCode({
    tokenEndpoint: config.tokenEndpoint,
    clientId: config.clientId,
    redirectUri,
    code,
    verifier,
  });
  if (!tokens.id_token) return { error: "IdP did not return an id_token." };
  let claims;
  try {
    claims = await verifyIdToken({
      idToken: tokens.id_token,
      issuer: config.issuer,
      clientId: config.clientId,
      nonce,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "ID token validation failed." };
  }
  const user = {
    id: String(claims.sub || ""),
    email: String(claims.email || ""),
    name: String(claims.name || claims.preferred_username || claims.email || "Account"),
    emailVerified: Boolean(claims.email_verified),
  };
  if (!user.id) return { error: "IdP token did not include a user id (sub)." };
  const expiresAt = Date.now() + Number(tokens.expires_in || 3600) * 1000;
  saveDesktopSession({
    user,
    expiresAt,
    accessToken: tokens.access_token || "",
    refreshToken: tokens.refresh_token || "",
  });
  return {
    session: {
      user,
      expiresAt,
      source: "desktop",
    },
  };
}

export async function getDesktopAuthSnapshot() {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  let payload = readVaultPayload();
  if (!payload?.user?.id) return { session: null, encryptionAvailable };

  const skewMs = 60_000;
  if (payload.expiresAt && payload.expiresAt > Date.now() + skewMs) {
    return {
      session: { user: payload.user, expiresAt: payload.expiresAt, source: "desktop" },
      encryptionAvailable,
    };
  }

  if (!payload.refreshToken) {
    clearDesktopSession();
    return { session: null, encryptionAvailable, error: "Session expired." };
  }

  try {
    const config = readConfig();
    if (!config.configured) {
      clearDesktopSession();
      return { session: null, encryptionAvailable };
    }
    const tokens = await refreshTokens({
      tokenEndpoint: config.tokenEndpoint,
      clientId: config.clientId,
      refreshToken: payload.refreshToken,
    });
    const claims = decodeJwtPayload(tokens.id_token || "");
    const user = {
      id: String(claims.sub || payload.user.id),
      email: String(claims.email || payload.user.email || ""),
      name: String(claims.name || payload.user.name || payload.user.email || "Account"),
      emailVerified: Boolean(claims.email_verified ?? payload.user.emailVerified),
    };
    const expiresAt = Date.now() + Number(tokens.expires_in || 3600) * 1000;
    saveDesktopSession({
      user,
      expiresAt,
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token || payload.refreshToken,
    });
    return {
      session: { user, expiresAt, source: "desktop" },
      encryptionAvailable,
    };
  } catch (error) {
    clearDesktopSession();
    return {
      session: null,
      encryptionAvailable,
      error: error instanceof Error ? error.message : "Session refresh failed.",
    };
  }
}
