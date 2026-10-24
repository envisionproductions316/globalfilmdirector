import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthPublicConfig } from "@/lib/auth/config";

export const runtime = "nodejs";

const SESSION_COOKIE = "gfd_auth_session";
const TOKEN_COOKIE = "gfd_auth_tokens";
/** Keep refresh material longer than access tokens (matches Envision refresh TTL order). */
const TOKEN_COOKIE_MAX_AGE_SEC = 14 * 24 * 60 * 60;
const SKEW_MS = 60_000;

type SessionPayload = {
  user: { id: string; email: string; name: string; emailVerified: boolean };
  expiresAt: number;
  source?: "web";
};

type TokenPayload = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

function decodeJwtPayload(token: string) {
  try {
    const part = token.split(".")[1];
    if (!part) return {} as Record<string, unknown>;
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {} as Record<string, unknown>;
  }
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

async function refreshWebTokens(refreshToken: string) {
  const config = getAuthPublicConfig();
  if (!config.configured || !config.tokenEndpoint) return null;
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    refresh_token: refreshToken,
  });
  const secret = (process.env.AUTH_CLIENT_SECRET || "").trim();
  if (secret) form.set("client_secret", secret);
  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form,
  });
  const tokens = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) return null;
  return tokens;
}

export async function GET() {
  const jar = await cookies();
  const rawSession = jar.get(SESSION_COOKIE)?.value;
  const rawTokens = jar.get(TOKEN_COOKIE)?.value;
  if (!rawSession) return NextResponse.json({ session: null });

  let session: SessionPayload;
  try {
    session = JSON.parse(rawSession) as SessionPayload;
  } catch {
    return NextResponse.json({ session: null });
  }
  if (!session?.user?.id) return NextResponse.json({ session: null });

  let tokens: TokenPayload | null = null;
  if (rawTokens) {
    try {
      tokens = JSON.parse(rawTokens) as TokenPayload;
    } catch {
      tokens = null;
    }
  }

  const stillFresh = session.expiresAt > Date.now() + SKEW_MS;
  if (stillFresh) {
    return NextResponse.json({
      session: {
        user: session.user,
        expiresAt: session.expiresAt,
        source: "web" as const,
      },
    });
  }

  if (!tokens?.refreshToken) {
    jar.delete(SESSION_COOKIE);
    jar.delete(TOKEN_COOKIE);
    return NextResponse.json({ session: null, error: "Session expired." });
  }

  const next = await refreshWebTokens(tokens.refreshToken);
  if (!next?.access_token) {
    jar.delete(SESSION_COOKIE);
    jar.delete(TOKEN_COOKIE);
    return NextResponse.json({ session: null, error: "Session expired." });
  }

  const claims = decodeJwtPayload(String(next.id_token || next.access_token || ""));
  const user = {
    id: String(claims.sub || session.user.id),
    email: String(claims.email || session.user.email || ""),
    name: String(claims.name || session.user.name || session.user.email || "Account"),
    emailVerified: Boolean(claims.email_verified ?? session.user.emailVerified),
  };
  const expiresAt = Date.now() + Number(next.expires_in || 3600) * 1000;
  const refreshed: SessionPayload = { user, expiresAt, source: "web" };
  const base = cookieBase();
  jar.set(SESSION_COOKIE, JSON.stringify(refreshed), {
    ...base,
    maxAge: Math.max(60, Math.floor((expiresAt - Date.now()) / 1000)),
  });
  jar.set(
    TOKEN_COOKIE,
    JSON.stringify({
      accessToken: next.access_token || "",
      refreshToken: next.refresh_token || tokens.refreshToken,
      expiresAt,
    }),
    {
      ...base,
      maxAge: TOKEN_COOKIE_MAX_AGE_SEC,
    },
  );

  return NextResponse.json({
    session: {
      user,
      expiresAt,
      source: "web" as const,
    },
  });
}
