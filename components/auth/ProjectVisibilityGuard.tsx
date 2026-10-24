"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useStudio } from "@/lib/studio";

/** When sign-in/out changes visibility, keep activeProjectId on a visible project. */
export function ProjectVisibilityGuard() {
  const auth = useAuth();
  const studio = useStudio();

  useEffect(() => {
    if (!auth.ready) return;
    studio.ensureVisibleActiveProject(auth.user?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on auth/project identity changes only
  }, [auth.ready, auth.user?.id, studio.activeProjectId, studio.projects]);

  return null;
}
