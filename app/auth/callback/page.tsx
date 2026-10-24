"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { takeWebPkce } from "@/lib/auth/web-pkce";

function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    const error = params.get("error");
    const code = params.get("code");
    const state = params.get("state");
    if (error) {
      setMessage(`Sign-in failed: ${error}`);
      return;
    }
    const pkce = takeWebPkce();
    if (!code || !pkce || pkce.state !== state) {
      setMessage("Sign-in callback was invalid or expired. Return to Projects and try again.");
      return;
    }
    void fetch("/api/auth/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        verifier: pkce.verifier,
        nonce: pkce.nonce,
        redirectUri: `${window.location.origin}/auth/callback`,
      }),
    })
      .then(async (response) => {
        const body = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(body.error || "Sign-in failed.");
        setMessage("Signed in. Returning to Projects…");
        router.replace("/projects");
      })
      .catch((err: unknown) => {
        setMessage(err instanceof Error ? err.message : "Sign-in failed.");
      });
  }, [params, router]);

  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-ink">
      <h1 className="m-0 text-2xl font-bold">Account</h1>
      <p className="mt-4 text-sm text-muted" data-testid="auth-callback-message">
        {message}
      </p>
      <p className="mt-6 text-xs text-muted">Signing in does not upload your projects to Envision Cloud.</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<main className="px-4 py-16 text-sm text-muted">Completing sign-in…</main>}>
      <AuthCallbackInner />
    </Suspense>
  );
}
