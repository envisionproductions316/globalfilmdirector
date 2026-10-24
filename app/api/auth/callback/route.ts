import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthPublicConfig } from "@/lib/auth/config";
import { verifyIdToken } from "@/lib/auth/verify-id-token";

export const runtime = "nodejs";

const SESSION_COOKIE = "gfd_auth_session";
const TOKEN_COOKIE = "gfd_auth_tokens";

export async function POST(request: Request) {
  const config = getAuthPublicConfig(new URL(request.url).origin);
  if (!config.configured) {
    return NextResponse.json({ error: "Auth is not configured on the server." }, { status: 503 });
  }
  let body: { code?: string; verifier?: string; redirectUri?: string; nonce?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.code || !body.verifier || !body.nonce) {
    return NextResponse.json({ error: "code, verifier, and nonce required" }, { status: 400 });
  }
  const redirectUri = body.redirectUri || config.redirectUri;
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code: body.code,
    redirect_uri: redirectUri,
    code_verifier: body.verifier,
  });
  const secret = (process.env.AUTH_CLIENT_SECRET || "").trim();
  if (secret) form.set("client_secret", secret);

  const tokenResponse = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form,
  });
  const tokens = (await tokenResponse.json().catch(() => ({}))) as Record<string, unknown>;
  if (!tokenResponse.ok) {
    return NextResponse.json(
      { error: String(tokens.error_description || tokens.error || "Token exchange failed.") },
      { status: 400 },
    );
  }

  const idToken = String(tokens.id_token || "");
  if (!idToken) {
    return NextResponse.json({ error: "IdP did not return an id_token." }, { status: 400 });
  }

  let claims;
  try {
    claims = await verifyIdToken({
      idToken,
      issuer: config.issuer,
      clientId: config.clientId,
      nonce: body.nonce,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ID token validation failed." },
      { status: 400 },
    );
  }

  const user = {
    id: String(claims.sub || ""),
    email: String(claims.email || ""),
    name: String(claims.name || claims.preferred_username || claims.email || "Account"),
    emailVerified: Boolean(claims.email_verified),
  };
  if (!user.id) {
    return NextResponse.json({ error: "IdP token did not include a user id (sub)." }, { status: 400 });
  }
  const expiresAt = Date.now() + Number(tokens.expires_in || 3600) * 1000;
  const session = { user, expiresAt, source: "web" as const };
  const jar = await cookies();
  const cookieBase = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  jar.set(SESSION_COOKIE, JSON.stringify(session), {
    ...cookieBase,
    maxAge: Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)),
  });
  jar.set(
    TOKEN_COOKIE,
    JSON.stringify({
      accessToken: tokens.access_token || "",
      refreshToken: tokens.refresh_token || "",
      expiresAt,
    }),
    {
      ...cookieBase,
      maxAge: 14 * 24 * 60 * 60,
    },
  );
  return NextResponse.json({ session });
}
