const WEB_PKCE_KEY = "gfd.auth.pkce";

export function storeWebPkce(value: { verifier: string; state: string; nonce: string }) {
  sessionStorage.setItem(WEB_PKCE_KEY, JSON.stringify(value));
}

export function takeWebPkce(): { verifier: string; state: string; nonce: string } | null {
  try {
    const raw = sessionStorage.getItem(WEB_PKCE_KEY);
    sessionStorage.removeItem(WEB_PKCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { verifier?: string; state?: string; nonce?: string };
    if (!parsed.verifier || !parsed.state || !parsed.nonce) return null;
    return { verifier: parsed.verifier, state: parsed.state, nonce: parsed.nonce };
  } catch {
    sessionStorage.removeItem(WEB_PKCE_KEY);
    return null;
  }
}
