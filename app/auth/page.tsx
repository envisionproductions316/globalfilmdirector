"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function AuthPage() {
  const auth = useAuth();

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-ink">
      <h1 className="m-0 text-2xl font-bold">Account</h1>
      <p className="mt-2 text-sm text-muted">
        One account for the website and Windows desktop. Signing in does <strong>not</strong> sync projects to the cloud.
      </p>
      <div className="mt-6 rounded-[10px] bg-card p-4">
        <p className="m-0 text-sm" data-testid="auth-status">
          {auth.user ? `Signed in as ${auth.user.email || auth.user.name}` : auth.statusLabel}
        </p>
        {auth.message ? (
          <p className="mt-2 text-sm text-muted" data-testid="auth-message">
            {auth.message}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {auth.user ? (
            <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-[13px]" data-testid="auth-sign-out" onClick={() => void auth.signOut()}>
              Sign out
            </button>
          ) : (
            <>
              <button type="button" className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent" data-testid="auth-sign-in" onClick={() => void auth.signIn()}>
                Sign in
              </button>
              <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-[13px]" data-testid="auth-register" onClick={() => void auth.register()}>
                Create account
              </button>
              <button type="button" className="h-9 rounded-[7px] bg-inset px-3 text-[13px]" data-testid="auth-reset" onClick={() => void auth.openPasswordReset()}>
                Reset password
              </button>
            </>
          )}
        </div>
        {!auth.configured ? (
          <p className="mt-4 text-xs text-muted">
            IdP not configured. Set <code>AUTH_ISSUER</code> / <code>AUTH_CLIENT_ID</code> (and <code>NEXT_PUBLIC_</code> mirrors). GFD does not store passwords.
          </p>
        ) : null}
      </div>
      <Link href="/projects" className="mt-6 inline-block text-sm text-accent">
        Back to Projects
      </Link>
    </main>
  );
}
