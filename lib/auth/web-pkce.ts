const WEB_PKCE_KEY = "gfd.auth.pkce";
const WEB_PKCE_USED_KEY = "gfd.auth.pkce.used";

export function storeWebPkce(value: { verifier: string; state: string; nonce: string }) {
  sessionStorage.setItem(WEB_PKCE_KEY, JSON.stringify(value));
  sessionStorage.removeItem(WEB_PKCE_USED_KEY);
}

/**
 * Read PKCE once per authorize round-trip. Survives React Strict Mode double-mount
 * (first take clears storage; remount would otherwise fail the callback).
 */
export function takeWebPkce(): { verifier: string; state: string; nonce: string } | null {
  try {
    const raw = sessionStorage.getItem(WEB_PKCE_KEY);
    if (raw) {
      sessionStorage.removeItem(WEB_PKCE_KEY);
      sessionStorage.setItem(WEB_PKCE_USED_KEY, raw);
      const parsed = JSON.parse(raw) as { verifier?: string; state?: string; nonce?: string };
      if (!parsed.verifier || !parsed.state || !parsed.nonce) return null;
      return { verifier: parsed.verifier, state: parsed.state, nonce: parsed.nonce };
    }
    const used = sessionStorage.getItem(WEB_PKCE_USED_KEY);
    if (!used) return null;
    sessionStorage.removeItem(WEB_PKCE_USED_KEY);
    const parsed = JSON.parse(used) as { verifier?: string; state?: string; nonce?: string };
    if (!parsed.verifier || !parsed.state || !parsed.nonce) return null;
    return { verifier: parsed.verifier, state: parsed.state, nonce: parsed.nonce };
  } catch {
    sessionStorage.removeItem(WEB_PKCE_KEY);
    sessionStorage.removeItem(WEB_PKCE_USED_KEY);
    return null;
  }
}
