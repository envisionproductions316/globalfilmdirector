import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAuthorizeUrl, createPkcePair, randomUrlSafe } from "./pkce.ts";
import { isProjectVisibleToUser, syncStatusLabel } from "./types.ts";

test("PKCE pair produces S256 challenge", async () => {
  const pair = await createPkcePair();
  assert.equal(pair.method, "S256");
  assert.ok(pair.verifier.length > 20);
  assert.ok(pair.challenge.length > 20);
  assert.notEqual(pair.verifier, pair.challenge);
});

test("authorize URL includes PKCE params and nonce", () => {
  const url = buildAuthorizeUrl({
    authorizationEndpoint: "https://idp.example/authorize",
    clientId: "gfd",
    redirectUri: "http://127.0.0.1:5180/auth/callback",
    scopes: "openid email",
    state: randomUrlSafe(8),
    codeChallenge: "challenge",
    nonce: "nonce-value",
  });
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
  assert.equal(parsed.searchParams.get("code_challenge"), "challenge");
  assert.equal(parsed.searchParams.get("nonce"), "nonce-value");
});

test("project visibility isolates other owners when signed in", () => {
  assert.equal(isProjectVisibleToUser({ ownerUserId: "" }, "user-a"), true);
  assert.equal(isProjectVisibleToUser({ ownerUserId: "user-a" }, "user-a"), true);
  assert.equal(isProjectVisibleToUser({ ownerUserId: "user-b" }, "user-a"), false);
  assert.equal(isProjectVisibleToUser({ ownerUserId: "user-b" }, null), false);
  assert.equal(isProjectVisibleToUser({ ownerUserId: "" }, null), true);
});

test("sync labels stay honest", () => {
  assert.match(syncStatusLabel("local-only"), /Local/);
  assert.match(syncStatusLabel("linked-local"), /this device/);
  assert.doesNotMatch(syncStatusLabel("linked-local"), /Synced/);
  assert.match(syncStatusLabel("cloud-synced"), /not available/);
  assert.doesNotMatch(syncStatusLabel("cloud-synced"), /^Synced/);
});
