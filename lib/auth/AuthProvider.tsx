"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authNotConfiguredMessage } from "@/lib/auth/config";
import { buildAuthorizeUrl, createPkcePair, randomUrlSafe } from "@/lib/auth/pkce";
import type { AuthPublicConfig, AuthSession, AuthUser } from "@/lib/auth/types";
import { storeWebPkce } from "@/lib/auth/web-pkce";
import { getDesktopApi } from "@/lib/desktop-bridge";

type AuthContextValue = {
  ready: boolean;
  configured: boolean;
  session: AuthSession | null;
  user: AuthUser | null;
  statusLabel: string;
  message: string;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  register: () => Promise<void>;
  openPasswordReset: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_CONFIG: AuthPublicConfig = {
  configured: false,
  issuer: "",
  clientId: "",
  authorizationEndpoint: "",
  tokenEndpoint: "",
  endSessionEndpoint: "",
  redirectUri: "",
  scopes: "openid profile email offline_access",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [message, setMessage] = useState("");
  const [config, setConfig] = useState<AuthPublicConfig>(EMPTY_CONFIG);
  const desktop = typeof window !== "undefined" ? getDesktopApi() : null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const refresh = useCallback(async () => {
    if (desktop) {
      const info = await desktop.getAuthSession();
      if (info.session?.user) {
        setSession({
          user: info.session.user,
          expiresAt: info.session.expiresAt,
          source: "desktop",
        });
      } else {
        setSession(null);
      }
      if (typeof info.configured === "boolean") {
        setConfig((current) => ({ ...current, configured: info.configured === true }));
      }
      setMessage(info.error || "");
      return;
    }
    try {
      const [sessionResponse, configResponse] = await Promise.all([
        fetch("/api/auth/session", { cache: "no-store" }),
        fetch("/api/auth/config", { cache: "no-store" }),
      ]);
      if (configResponse.ok) {
        const body = (await configResponse.json()) as { config?: AuthPublicConfig };
        if (body.config) setConfig(body.config);
      }
      if (!sessionResponse.ok) {
        setSession(null);
        return;
      }
      const body = (await sessionResponse.json()) as { session?: AuthSession | null; error?: string };
      setSession(body.session || null);
      setMessage(body.error || "");
    } catch {
      setSession(null);
    }
  }, [desktop]);

  useEffect(() => {
    void refresh().finally(() => setReady(true));
  }, [refresh]);

  const signIn = useCallback(async () => {
    setMessage("");
    if (desktop) {
      const result = await desktop.beginAuth({ mode: "login" });
      if (result.error) setMessage(result.error);
      await refresh();
      return;
    }
    if (!config.configured) {
      setMessage(authNotConfiguredMessage());
      return;
    }
    const pair = await createPkcePair();
    const state = randomUrlSafe(16);
    const nonce = randomUrlSafe(16);
    storeWebPkce({ verifier: pair.verifier, state, nonce });
    const url = buildAuthorizeUrl({
      authorizationEndpoint: config.authorizationEndpoint,
      clientId: config.clientId,
      redirectUri: config.redirectUri || `${origin}/auth/callback`,
      scopes: config.scopes,
      state,
      codeChallenge: pair.challenge,
      nonce,
    });
    window.location.assign(url);
  }, [config, desktop, origin, refresh]);

  const register = useCallback(async () => {
    setMessage("");
    if (desktop) {
      const result = await desktop.beginAuth({ mode: "signup" });
      if (result.error) setMessage(result.error);
      await refresh();
      return;
    }
    if (!config.configured) {
      setMessage(authNotConfiguredMessage());
      return;
    }
    const pair = await createPkcePair();
    const state = randomUrlSafe(16);
    const nonce = randomUrlSafe(16);
    storeWebPkce({ verifier: pair.verifier, state, nonce });
    const url = new URL(
      buildAuthorizeUrl({
        authorizationEndpoint: config.authorizationEndpoint,
        clientId: config.clientId,
        redirectUri: config.redirectUri || `${origin}/auth/callback`,
        scopes: config.scopes,
        state,
        codeChallenge: pair.challenge,
        nonce,
      }),
    );
    url.searchParams.set("prompt", "login");
    url.searchParams.set("screen_hint", "signup");
    window.location.assign(url.toString());
  }, [config, desktop, origin, refresh]);

  const openPasswordReset = useCallback(async () => {
    // Envision first-party recovery UI lives on the account surface; override via env when customized.
    const reset =
      process.env.NEXT_PUBLIC_AUTH_PASSWORD_RESET_URL ||
      (config.issuer ? `${config.issuer}/#signin` : "");
    if (!config.configured && !desktop) {
      setMessage(authNotConfiguredMessage());
      return;
    }
    if (!reset) {
      setMessage("Password reset URL is not configured (NEXT_PUBLIC_AUTH_PASSWORD_RESET_URL). Use your IdP email reset flow.");
      return;
    }
    if (desktop) {
      await desktop.openExternal(reset);
      return;
    }
    window.open(reset, "_blank", "noopener,noreferrer");
  }, [config, desktop]);

  const signOut = useCallback(async () => {
    setMessage("");
    if (desktop) {
      await desktop.signOutAuth();
      setSession(null);
      setMessage("Signed out. Local projects and recordings on this device were kept.");
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    setMessage("Signed out. Local projects and recordings on this device were kept.");
  }, [desktop]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured: config.configured,
      session,
      user: session?.user ?? null,
      statusLabel: session ? "Signed in · on this device (not cloud-synced)" : config.configured ? "Signed out · local device" : "Local only · auth not configured",
      message,
      signIn,
      signOut,
      register,
      openPasswordReset,
      refresh,
    }),
    [ready, config.configured, session, message, signIn, signOut, register, openPasswordReset, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requires AuthProvider");
  return value;
}
