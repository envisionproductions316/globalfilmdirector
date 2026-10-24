/**
 * Server-side ID token validation (issuer, audience, expiry, optional nonce, RS256 via JWKS).
 * Used by the web BFF only — never ship verification secrets to the browser.
 */
import { createPublicKey, createVerify } from "node:crypto";

type JwtHeader = { alg?: string; kid?: string; typ?: string };
type JwtPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  sub?: string;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
};

function b64urlJson<T>(part: string): T {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as T;
}

function audienceIncludes(aud: string | string[] | undefined, clientId: string) {
  if (!aud) return false;
  if (typeof aud === "string") return aud === clientId;
  return Array.isArray(aud) && aud.includes(clientId);
}

async function fetchJwks(issuer: string) {
  const discovery = await fetch(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!discovery.ok) throw new Error("OIDC discovery failed.");
  const meta = (await discovery.json()) as { jwks_uri?: string; issuer?: string };
  if (!meta.jwks_uri) throw new Error("OIDC discovery missing jwks_uri.");
  const jwksResponse = await fetch(meta.jwks_uri, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!jwksResponse.ok) throw new Error("JWKS fetch failed.");
  const jwks = (await jwksResponse.json()) as { keys?: Array<Record<string, unknown>> };
  return { keys: jwks.keys || [], discoveryIssuer: meta.issuer || issuer };
}

export async function verifyIdToken(input: {
  idToken: string;
  issuer: string;
  clientId: string;
  nonce?: string;
  clockSkewSec?: number;
}): Promise<JwtPayload> {
  const parts = String(input.idToken || "").split(".");
  if (parts.length !== 3) throw new Error("ID token is malformed.");
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];
  const header = b64urlJson<JwtHeader>(headerB64);
  const payload = b64urlJson<JwtPayload>(payloadB64);
  if (header.alg !== "RS256") throw new Error("Unsupported ID token algorithm.");

  const expectedIssuer = input.issuer.replace(/\/$/, "");
  const { keys, discoveryIssuer } = await fetchJwks(expectedIssuer);
  if ((discoveryIssuer || "").replace(/\/$/, "") !== expectedIssuer) {
    throw new Error("OIDC discovery issuer mismatch.");
  }
  if ((payload.iss || "").replace(/\/$/, "") !== expectedIssuer) {
    throw new Error("ID token issuer mismatch.");
  }
  if (!audienceIncludes(payload.aud, input.clientId)) {
    throw new Error("ID token audience mismatch.");
  }
  const skew = input.clockSkewSec ?? 60;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp + skew < now) {
    throw new Error("ID token expired.");
  }
  if (typeof payload.nbf === "number" && payload.nbf - skew > now) {
    throw new Error("ID token not yet valid.");
  }
  if (input.nonce) {
    if (!payload.nonce || payload.nonce !== input.nonce) {
      throw new Error("ID token nonce mismatch.");
    }
  }
  if (!payload.sub) throw new Error("ID token missing subject.");

  const jwk = keys.find((key) => key.kid === header.kid) || keys.find((key) => key.kty === "RSA");
  if (!jwk) throw new Error("No matching JWKS key for ID token.");
  const keyObject = createPublicKey({ key: jwk, format: "jwk" });
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signature = Buffer.from(signatureB64, "base64url");
  if (!verifier.verify(keyObject, signature)) {
    throw new Error("ID token signature invalid.");
  }
  return payload;
}
