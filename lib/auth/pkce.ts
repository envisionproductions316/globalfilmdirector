/** OAuth 2.1 / OIDC PKCE helpers (authorization code). No secrets. */

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  const base = typeof btoa === "function" ? btoa(binary) : Buffer.from(bytes).toString("base64");
  return base.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomUrlSafe(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(buffer);
  else {
    for (let i = 0; i < bytes; i += 1) buffer[i] = Math.floor(Math.random() * 256);
  }
  return base64Url(buffer);
}

export async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  // Web Crypto only — avoids bundling `node:crypto` into the Next.js client (UnhandledSchemeError).
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto SHA-256 is required for PKCE (browser or Node with globalThis.crypto.subtle).");
  }
  const digest = await subtle.digest("SHA-256", data);
  return base64Url(new Uint8Array(digest));
}

export async function createPkcePair() {
  const verifier = randomUrlSafe(32);
  const challenge = await sha256Base64Url(verifier);
  return { verifier, challenge, method: "S256" as const };
}

export function buildAuthorizeUrl(input: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod?: string;
  nonce?: string;
}) {
  const url = new URL(input.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.scopes);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", input.codeChallengeMethod || "S256");
  if (input.nonce) url.searchParams.set("nonce", input.nonce);
  return url.toString();
}
