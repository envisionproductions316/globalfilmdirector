/** Sync / ownership honesty labels — never imply Envision Cloud upload until sync ships. */
export type ProjectSyncStatus = "local-only" | "linked-local" | "cloud-pending" | "cloud-synced";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export type AuthSession = {
  user: AuthUser;
  /** Access token kept out of renderer on desktop; web may omit. */
  expiresAt: number;
  source: "web" | "desktop" | "none";
};

export type AuthPublicConfig = {
  configured: boolean;
  issuer: string;
  clientId: string;
  /** Authorization endpoint (discovered or overridden). */
  authorizationEndpoint: string;
  tokenEndpoint: string;
  endSessionEndpoint: string;
  /** Web redirect (Next origin + /auth/callback). */
  redirectUri: string;
  scopes: string;
};

export function syncStatusLabel(status: ProjectSyncStatus): string {
  switch (status) {
    case "local-only":
      return "Local on this device";
    case "linked-local":
      return "Saved for you · on this device";
    case "cloud-pending":
      return "Waiting for Envision Cloud";
    case "cloud-synced":
      // Reserved until real sync ships — never present as active without a tested path.
      return "Cloud sync (not available yet)";
    default:
      return "Local on this device";
  }
}

/**
 * Unowned local projects stay visible to anyone on the device.
 * Account-linked projects are visible only while signed in as that owner
 * (signed out must not expose another account’s linked projects).
 */
export function isProjectVisibleToUser(
  project: { ownerUserId?: string },
  userId: string | null,
): boolean {
  const owner = typeof project.ownerUserId === "string" ? project.ownerUserId.trim() : "";
  if (!owner) return true;
  if (!userId) return false;
  return owner === userId;
}
