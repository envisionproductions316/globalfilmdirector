import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthPublicConfig } from "@/lib/auth/config";

export const runtime = "nodejs";

const SESSION_COOKIE = "gfd_auth_session";
const TOKEN_COOKIE = "gfd_auth_tokens";

async function revokeRefreshToken(refreshToken: string) {
  const config = getAuthPublicConfig();
  if (!config.configured || !config.issuer || !refreshToken) return;
  const revokeUrl = `${config.issuer.replace(/\/$/, "")}/oauth/revoke`;
  const form = new URLSearchParams({
    token: refreshToken,
    token_type_hint: "refresh_token",
    client_id: config.clientId,
  });
  const secret = (process.env.AUTH_CLIENT_SECRET || "").trim();
  if (secret) form.set("client_secret", secret);
  try {
    await fetch(revokeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: form,
    });
  } catch {
    /* best-effort revoke — local cookies still cleared */
  }
}

export async function POST() {
  const jar = await cookies();
  const rawTokens = jar.get(TOKEN_COOKIE)?.value;
  if (rawTokens) {
    try {
      const tokens = JSON.parse(rawTokens) as { refreshToken?: string };
      if (tokens.refreshToken) await revokeRefreshToken(tokens.refreshToken);
    } catch {
      /* ignore */
    }
  }
  const response = NextResponse.json({
    ok: true,
    message: "Signed out. Local projects and recordings on this device were kept.",
  });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(TOKEN_COOKIE);
  return response;
}
