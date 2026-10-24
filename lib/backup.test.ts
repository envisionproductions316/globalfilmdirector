import assert from "node:assert/strict";
import test from "node:test";
import { BACKUP_FORMAT, scrubAuthFromStudioSnapshot, validateBackup } from "./backup.ts";

test("validateBackup accepts gfd-backup-v1 and rejects bad formats", () => {
  const ok = validateBackup({
    format: BACKUP_FORMAT,
    createdAt: "2026-10-23T00:00:00.000Z",
    appVersion: "0.1.0",
    studio: { schemaVersion: 3, projects: [] },
    media: [{ id: "m1", projectId: "p1", takeId: "", mime: "video/webm", bytes: 4, createdAt: "", dataBase64: "AAAA" }],
  });
  assert.equal(ok.ok, true);

  const bad = validateBackup({ format: "other", studio: {}, media: [] });
  assert.equal(bad.ok, false);
});

test("scrubAuthFromStudioSnapshot removes token-like fields", () => {
  const scrubbed = scrubAuthFromStudioSnapshot({
    schemaVersion: 4,
    accessToken: "secret",
    refreshToken: "secret",
    projects: [],
    auth: { accessToken: "x", user: { id: "u" } },
  }) as Record<string, unknown>;
  assert.equal("accessToken" in scrubbed, false);
  assert.equal("refreshToken" in scrubbed, false);
  assert.deepEqual((scrubbed.auth as Record<string, unknown>).user, { id: "u" });
  assert.equal("accessToken" in (scrubbed.auth as object), false);
});
