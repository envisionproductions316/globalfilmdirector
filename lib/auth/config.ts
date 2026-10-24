import type { AuthPublicConfig } from "@/lib/auth/types";

function trim(value: string | undefined) {
  return (value || "").trim().replace(/\/$/, "");
}

/** Public / shared auth config. Never includes client secrets. */
export function getAuthPublicConfig(origin?: string): AuthPublicConfig {
  const issuer = trim(process.env.NEXT_PUBLIC_AUTH_ISSUER || process.env.AUTH_ISSUER);
  const clientId = trim(process.env.NEXT_PUBLIC_AUTH_CLIENT_ID || process.env.AUTH_CLIENT_ID) || (issuer ? "gfd-web" : "");
  const authorizationEndpoint =
    trim(process.env.NEXT_PUBLIC_AUTH_AUTHORIZATION_ENDPOINT) ||
    (issuer ? `${issuer}/oauth/authorize` : "");
  const tokenEndpoint =
    trim(process.env.NEXT_PUBLIC_AUTH_TOKEN_ENDPOINT) || (issuer ? `${issuer}/oauth/token` : "");
  const endSessionEndpoint =
    trim(process.env.NEXT_PUBLIC_AUTH_END_SESSION_ENDPOINT) ||
    (issuer ? `${issuer}/oauth/logout` : "");
  const redirectUri =
    trim(process.env.NEXT_PUBLIC_AUTH_REDIRECT_URI) ||
    (origin ? `${origin.replace(/\/$/, "")}/auth/callback` : "");
  const scopes = trim(process.env.NEXT_PUBLIC_AUTH_SCOPES) || "openid profile email offline_access";
  const configured = Boolean(issuer && clientId && authorizationEndpoint && tokenEndpoint);

  return {
    configured,
    issuer,
    clientId,
    authorizationEndpoint,
    tokenEndpoint,
    endSessionEndpoint,
    redirectUri,
    scopes,
  };
}

export function authNotConfiguredMessage() {
  return "Sign-in is not configured. Point AUTH_ISSUER at your Envision Cloud origin (OIDC discovery at /.well-known/openid-configuration) and set AUTH_CLIENT_ID=gfd-web (desktop: gfd-desktop). GFD does not store passwords.";
}
