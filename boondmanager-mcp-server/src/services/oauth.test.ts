import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_AUTHORIZATION_SERVER,
  buildProtectedResourceMetadata,
  extractBearerToken,
  oauthContext,
  resolveAdvertisedScopes,
  resolveAuthorizationServer,
} from "./oauth.js";

describe("extractBearerToken", () => {
  it("returns the token when the header is a valid Bearer string", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("is case-insensitive on the scheme name", () => {
    expect(extractBearerToken("bearer abc")).toBe("abc");
    expect(extractBearerToken("BEARER abc")).toBe("abc");
  });

  it("ignores leading/trailing whitespace", () => {
    expect(extractBearerToken("  Bearer   tok  ")).toBe("tok");
  });

  it("returns null for missing or empty headers", () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken("")).toBeNull();
  });

  it("returns null when the scheme is not Bearer", () => {
    expect(extractBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(extractBearerToken("Token abc")).toBeNull();
  });

  it("returns null when the Bearer value is empty", () => {
    expect(extractBearerToken("Bearer ")).toBeNull();
    expect(extractBearerToken("Bearer   ")).toBeNull();
  });

  it("returns the first element when given an array header (Node's IncomingMessage shape)", () => {
    expect(extractBearerToken(["Bearer tok1", "Bearer tok2"])).toBe("tok1");
  });
});

describe("oauthContext (AsyncLocalStorage)", () => {
  it("returns undefined outside any run() scope", () => {
    expect(oauthContext.getStore()).toBeUndefined();
  });

  it("makes the access token visible synchronously inside run()", () => {
    oauthContext.run({ accessToken: "AT" }, () => {
      expect(oauthContext.getStore()?.accessToken).toBe("AT");
    });
  });

  it("propagates the context across async boundaries", async () => {
    await oauthContext.run({ accessToken: "AT" }, async () => {
      // Cross a microtask boundary — AsyncLocalStorage must still carry the value.
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 1));
      expect(oauthContext.getStore()?.accessToken).toBe("AT");
    });
  });

  it("isolates concurrent runs from each other", async () => {
    const tokens = await Promise.all([
      oauthContext.run({ accessToken: "A" }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return oauthContext.getStore()?.accessToken;
      }),
      oauthContext.run({ accessToken: "B" }, async () => {
        await new Promise((r) => setTimeout(r, 2));
        return oauthContext.getStore()?.accessToken;
      }),
      oauthContext.run({ accessToken: "C" }, async () => {
        return oauthContext.getStore()?.accessToken;
      }),
    ]);
    expect(tokens).toEqual(["A", "B", "C"]);
  });
});

describe("buildProtectedResourceMetadata", () => {
  it("emits the required RFC 9728 fields", () => {
    const doc = buildProtectedResourceMetadata({
      resource: "https://mcp.example.com/mcp",
      authorizationServers: ["https://ui.boondmanager.com"],
    });
    expect(doc).toEqual({
      resource: "https://mcp.example.com/mcp",
      authorization_servers: ["https://ui.boondmanager.com"],
      bearer_methods_supported: ["header"],
    });
  });

  it("includes scopes_supported when provided", () => {
    const doc = buildProtectedResourceMetadata({
      resource: "https://mcp.example.com/mcp",
      authorizationServers: ["https://ui.boondmanager.com"],
      scopesSupported: ["candidates", "resources"],
    });
    expect(doc["scopes_supported"]).toEqual(["candidates", "resources"]);
  });

  it("omits scopes_supported when the list is empty", () => {
    const doc = buildProtectedResourceMetadata({
      resource: "r",
      authorizationServers: ["a"],
      scopesSupported: [],
    });
    expect(doc).not.toHaveProperty("scopes_supported");
  });
});

describe("resolveAuthorizationServer", () => {
  const original = process.env["BOOND_OAUTH_AUTHORIZATION_SERVER"];
  afterEach(() => {
    if (original === undefined) delete process.env["BOOND_OAUTH_AUTHORIZATION_SERVER"];
    else process.env["BOOND_OAUTH_AUTHORIZATION_SERVER"] = original;
  });

  it("falls back to the default Boond authorization server", () => {
    delete process.env["BOOND_OAUTH_AUTHORIZATION_SERVER"];
    expect(resolveAuthorizationServer()).toBe(DEFAULT_AUTHORIZATION_SERVER);
  });

  it("uses the override when configured", () => {
    process.env["BOOND_OAUTH_AUTHORIZATION_SERVER"] = "https://custom.boondmanager.com";
    expect(resolveAuthorizationServer()).toBe("https://custom.boondmanager.com");
  });

  it("ignores unresolved ${...} placeholders", () => {
    process.env["BOOND_OAUTH_AUTHORIZATION_SERVER"] = "${user_config.issuer}";
    expect(resolveAuthorizationServer()).toBe(DEFAULT_AUTHORIZATION_SERVER);
  });
});

describe("resolveAdvertisedScopes", () => {
  const original = process.env["BOOND_OAUTH_SCOPES"];
  afterEach(() => {
    if (original === undefined) delete process.env["BOOND_OAUTH_SCOPES"];
    else process.env["BOOND_OAUTH_SCOPES"] = original;
  });

  it("returns an empty list when unset", () => {
    delete process.env["BOOND_OAUTH_SCOPES"];
    expect(resolveAdvertisedScopes()).toEqual([]);
  });

  it("splits on comma or whitespace", () => {
    process.env["BOOND_OAUTH_SCOPES"] = "candidates, resources companies";
    expect(resolveAdvertisedScopes()).toEqual(["candidates", "resources", "companies"]);
  });
});
