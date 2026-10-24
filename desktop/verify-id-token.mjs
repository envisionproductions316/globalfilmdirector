/**
 * Desktop ID token validation (issuer, audience, expiry, nonce, RS256 via JWKS).
 */
import { createPublicKey, createVerify } from "node:crypto";

function b64urlJson(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function audienceIncludes(aud, clientId) {
  if (!aud) return false;
  if (typeof aud === "string") return aud === clientId;
  return Array.isArray(aud) && aud.includes(clientId);
}

async function fetchJwks(issuer) {
  const discovery = await fetch(`${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`, {
    headers: { Accept: "application/json" },
  });
  if (!discovery.ok) throw new Error("OIDC discovery failed.");
  const meta = await discovery.json();
  if (!meta.jwks_uri) throw new Error("OIDC discovery missing jwks_uri.");
  const jwksResponse = await fetch(meta.jwks_uri, { headers: { Accept: "application/json" } });
  if (!jwksResponse.ok) throw new Error("JWKS fetch failed.");
  const jwks = await jwksResponse.json();
  return { keys: jwks.keys || [], discoveryIssuer: meta.issuer || issuer };
}

export async function verifyIdToken({ idToken, issuer, clientId, nonce, clockSkewSec = 60 }) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new Error("ID token is malformed.");
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = b64urlJson(headerB64);
  const payload = b64urlJson(payloadB64);
  if (header.alg !== "RS256") throw new Error("Unsupported ID token algorithm.");

  const expectedIssuer = issuer.replace(/\/$/, "");
  const { keys, discoveryIssuer } = await fetchJwks(expectedIssuer);
  if (String(discoveryIssuer || "").replace(/\/$/, "") !== expectedIssuer) {
    throw new Error("OIDC discovery issuer mismatch.");
  }
  if (String(payload.iss || "").replace(/\/$/, "") !== expectedIssuer) {
    throw new Error("ID token issuer mismatch.");
  }
  if (!audienceIncludes(payload.aud, clientId)) {
    throw new Error("ID token audience mismatch.");
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp + clockSkewSec < now) {
    throw new Error("ID token expired.");
  }
  if (typeof payload.nbf === "number" && payload.nbf - clockSkewSec > now) {
    throw new Error("ID token not yet valid.");
  }
  if (nonce) {
    if (!payload.nonce || payload.nonce !== nonce) {
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
