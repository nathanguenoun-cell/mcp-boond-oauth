import { describe, it, expect } from "vitest";
import {
  createCredentials,
  getAccessToken,
  getCredentials,
  getRefreshToken,
  revokeCredentials,
  seedTokenPairForTesting,
  storeAccessToken,
  storeRefreshToken,
  updateCredentials,
  sweepExpired,
} from "./oauth-state.js";

describe("oauth-state credential model", () => {
  it("joins an access token to its shared credentials", () => {
    const credId = createCredentials({
      boondToken: "boond-a",
      boondRefreshToken: "refresh-a",
      boondExpiresAt: 123,
      clientId: "client-1",
    });
    storeAccessToken("access-1", credId);

    const resolved = getAccessToken("access-1");
    expect(resolved).toBeDefined();
    expect(resolved?.boondToken).toBe("boond-a");
    expect(resolved?.boondRefreshToken).toBe("refresh-a");
    expect(resolved?.boondExpiresAt).toBe(123);
    expect(resolved?.credId).toBe(credId);
  });

  it("returns undefined for an unknown access token", () => {
    expect(getAccessToken("does-not-exist")).toBeUndefined();
  });

  it("updateCredentials is visible through both the access and refresh handles (no drift)", () => {
    const credId = createCredentials({
      boondToken: "old",
      boondRefreshToken: "old-refresh",
      boondExpiresAt: 1,
      clientId: "client-2",
    });
    storeAccessToken("access-2", credId);
    storeRefreshToken("refresh-2", credId);

    updateCredentials(credId, { boondToken: "new", boondRefreshToken: "new-refresh", boondExpiresAt: 999 });

    expect(getAccessToken("access-2")?.boondToken).toBe("new");
    expect(getRefreshToken("refresh-2")?.boondToken).toBe("new");
    expect(getCredentials(credId)?.boondRefreshToken).toBe("new-refresh");
    expect(getRefreshToken("refresh-2")?.boondExpiresAt).toBe(999);
  });

  it("revokeCredentials drops the creds and every handle pointing at them", () => {
    const credId = createCredentials({
      boondToken: "x",
      boondRefreshToken: "y",
      boondExpiresAt: 0,
      clientId: "client-3",
    });
    storeAccessToken("access-3", credId);
    storeRefreshToken("refresh-3", credId);

    revokeCredentials(credId);

    expect(getAccessToken("access-3")).toBeUndefined();
    expect(getRefreshToken("refresh-3")).toBeUndefined();
    expect(getCredentials(credId)).toBeUndefined();
  });

  it("seedTokenPairForTesting creates a usable access token with no refresh/expiry", () => {
    seedTokenPairForTesting("seeded-access", "seeded-boond");
    const resolved = getAccessToken("seeded-access");
    expect(resolved?.boondToken).toBe("seeded-boond");
    expect(resolved?.boondRefreshToken).toBe("");
    expect(resolved?.boondExpiresAt).toBe(0);
  });

  it("sweepExpired removes expired tokens and the credentials they orphaned", () => {
    const credId = createCredentials({
      boondToken: "sweep-me",
      boondRefreshToken: "",
      boondExpiresAt: 0,
      clientId: "client-4",
    });
    storeAccessToken("access-4", credId);

    // 25h later: access token TTL (24h) has elapsed.
    sweepExpired(Date.now() + 25 * 60 * 60_000);

    expect(getAccessToken("access-4")).toBeUndefined();
    expect(getCredentials(credId)).toBeUndefined();
  });
});
