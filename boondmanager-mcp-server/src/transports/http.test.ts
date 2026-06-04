import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { request as httpRequest } from "node:http";
import { resolveAllowedHosts, resolveHttpOptions, startHttpTransport, type HttpServerHandle } from "./http.js";
import { seedTokenPairForTesting } from "../services/oauth-state.js";
import { createMcpServer } from "../server.js";

/**
 * Performs a low-level HTTP POST so we can override the Host header (which
 * `fetch`/undici treats as a forbidden header and silently overrides).
 */
function postWithHost(
  port: number,
  path: string,
  hostHeader: string,
  body: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          Host: hostHeader,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...extraHeaders,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    req.end(body);
  });
}

const ENV_KEYS = [
  "MCP_HTTP_PORT",
  "MCP_HTTP_HOST",
  "MCP_HTTP_PATH",
  "MCP_HTTP_STATEFUL",
  "MCP_HTTP_JSON_RESPONSE",
  "MCP_HTTP_SESSION_TTL_MS",
  "MCP_HTTP_SESSION_SWEEP_INTERVAL_MS",
  "MCP_HTTP_ALLOWED_HOSTS",
  "MCP_HTTP_PUBLIC_URL",
];

// Pre-seeded token pair used throughout integration tests.
const TEST_OUR_TOKEN = "test-our-token-for-http-tests";
const TEST_BOOND_TOKEN = "test-boond-token-for-http-tests";

function clearEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("resolveHttpOptions", () => {
  beforeEach(() => clearEnv());
  afterEach(() => clearEnv());

  it("returns sensible defaults when no env vars are set", () => {
    const opts = resolveHttpOptions();
    expect(opts.host).toBe("127.0.0.1");
    expect(opts.port).toBe(3000);
    expect(opts.path).toBe("/mcp");
    expect(opts.stateless).toBe(true);
    expect(opts.enableJsonResponse).toBe(false);
    expect(opts.publicUrl).toBeUndefined();
    expect(opts.sessionTtlMs).toBe(30 * 60_000);
    expect(opts.sessionSweepIntervalMs).toBe(5 * 60_000);
  });

  it("reads session lifecycle knobs from env", () => {
    process.env["MCP_HTTP_SESSION_TTL_MS"] = "60000";
    process.env["MCP_HTTP_SESSION_SWEEP_INTERVAL_MS"] = "10000";
    const opts = resolveHttpOptions();
    expect(opts.sessionTtlMs).toBe(60_000);
    expect(opts.sessionSweepIntervalMs).toBe(10_000);
  });

  it("falls back to defaults on bad session lifecycle values", () => {
    process.env["MCP_HTTP_SESSION_TTL_MS"] = "0";
    process.env["MCP_HTTP_SESSION_SWEEP_INTERVAL_MS"] = "lots";
    const opts = resolveHttpOptions();
    expect(opts.sessionTtlMs).toBe(30 * 60_000);
    expect(opts.sessionSweepIntervalMs).toBe(5 * 60_000);
  });

  it("reads configuration from environment variables", () => {
    process.env["MCP_HTTP_PORT"] = "4242";
    process.env["MCP_HTTP_HOST"] = "0.0.0.0";
    process.env["MCP_HTTP_PATH"] = "/api/mcp";
    process.env["MCP_HTTP_STATEFUL"] = "true";
    process.env["MCP_HTTP_JSON_RESPONSE"] = "true";
    process.env["MCP_HTTP_PUBLIC_URL"] = "https://mcp.example.com/api/mcp";

    const opts = resolveHttpOptions();
    expect(opts.port).toBe(4242);
    expect(opts.host).toBe("0.0.0.0");
    expect(opts.path).toBe("/api/mcp");
    expect(opts.stateless).toBe(false);
    expect(opts.enableJsonResponse).toBe(true);
    expect(opts.publicUrl).toBe("https://mcp.example.com/api/mcp");
  });

  it("ignores unresolved ${...} placeholders", () => {
    process.env["MCP_HTTP_HOST"] = "${user_config.host}";
    const opts = resolveHttpOptions();
    expect(opts.host).toBe("127.0.0.1");
  });

  it("throws on an invalid port value", () => {
    process.env["MCP_HTTP_PORT"] = "not-a-port";
    expect(() => resolveHttpOptions()).toThrow(/Invalid MCP_HTTP_PORT/);
  });

  it("parses MCP_HTTP_ALLOWED_HOSTS as a comma-separated list", () => {
    process.env["MCP_HTTP_ALLOWED_HOSTS"] = "example.com, mcp.internal ,";
    const opts = resolveHttpOptions();
    expect(opts.allowedHosts).toEqual(["example.com", "mcp.internal"]);
  });

  it("leaves allowedHosts undefined when MCP_HTTP_ALLOWED_HOSTS is unset", () => {
    const opts = resolveHttpOptions();
    expect(opts.allowedHosts).toBeUndefined();
  });
});

describe("resolveAllowedHosts", () => {
  it("returns the localhost allow-list by default when bound to a loopback interface", () => {
    expect(resolveAllowedHosts(undefined, "127.0.0.1")).toEqual(["localhost", "127.0.0.1", "[::1]"]);
    expect(resolveAllowedHosts(undefined, "::1")).toEqual(["localhost", "127.0.0.1", "[::1]"]);
    expect(resolveAllowedHosts(undefined, "localhost")).toEqual(["localhost", "127.0.0.1", "[::1]"]);
  });

  it("returns an empty list (validation disabled) when bound to a non-loopback interface with no config", () => {
    expect(resolveAllowedHosts(undefined, "0.0.0.0")).toEqual([]);
    expect(resolveAllowedHosts([], "0.0.0.0")).toEqual([]);
  });

  it("treats `*` as an explicit opt-out", () => {
    expect(resolveAllowedHosts(["*"], "127.0.0.1")).toEqual([]);
    expect(resolveAllowedHosts(["*", "example.com"], "0.0.0.0")).toEqual([]);
  });

  it("uses the configured allow-list verbatim when provided", () => {
    expect(resolveAllowedHosts(["mcp.internal"], "0.0.0.0")).toEqual(["mcp.internal"]);
  });
});

describe("startHttpTransport (integration)", () => {
  let handle: HttpServerHandle | undefined;

  beforeEach(async () => {
    // Pre-seed the token pair so integration tests can use it without going
    // through the OAuth dance.
    await seedTokenPairForTesting(TEST_OUR_TOKEN, TEST_BOOND_TOKEN);
  });

  afterEach(async () => {
    if (handle) await handle.close();
    handle = undefined;
  });

  it("returns 404 for unknown paths", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34567,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
    });
    const res = await fetch(`http://127.0.0.1:${handle.address.port}/not-mcp`);
    expect(res.status).toBe(404);
  });

  it("rejects GET in stateless mode with 405", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34568,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
    });
    // Method check fires before token validation — GET always yields 405.
    const res = await fetch(`http://127.0.0.1:${handle.address.port}/mcp`, {
      headers: { Authorization: `Bearer ${TEST_OUR_TOKEN}` },
    });
    expect(res.status).toBe(405);
  });

  it("returns 401 with a WWW-Authenticate challenge when no Bearer token is present", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34569,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
    });
    const res = await fetch(`http://127.0.0.1:${handle.address.port}/mcp`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(401);
    const challenge = res.headers.get("www-authenticate") ?? "";
    expect(challenge).toMatch(/^Bearer /);
    expect(challenge).toContain("resource_metadata=");
    expect(challenge).toContain("/.well-known/oauth-protected-resource");
  });

  it("rejects requests with a non-Bearer Authorization scheme", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34579,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
    });
    const res = await fetch(`http://127.0.0.1:${handle.address.port}/mcp`, {
      method: "POST",
      headers: { Authorization: "Basic dGVzdDp0ZXN0" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an unknown Bearer token (not in our token map)", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34575,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
    });
    const res = await fetch(`http://127.0.0.1:${handle.address.port}/mcp`, {
      method: "POST",
      headers: { Authorization: "Bearer unknown-token-not-in-map" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });

  it("publishes RFC 9728 protected-resource metadata at /.well-known/oauth-protected-resource", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34580,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
      publicUrl: "https://mcp.example.com/mcp",
    });
    const res = await fetch(`http://127.0.0.1:${handle.address.port}/.well-known/oauth-protected-resource`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const doc = (await res.json()) as Record<string, unknown>;
    expect(doc["resource"]).toBe("https://mcp.example.com/mcp");
    // In proxy mode the authorization server is the MCP server itself.
    expect(doc["authorization_servers"]).toEqual(["https://mcp.example.com"]);
    expect(doc["bearer_methods_supported"]).toEqual(["header"]);
  });

  it("serves the path-suffixed metadata variant per RFC 9728 §3.2", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34581,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
    });
    const res = await fetch(`http://127.0.0.1:${handle.address.port}/.well-known/oauth-protected-resource/mcp`);
    expect(res.status).toBe(200);
    const doc = (await res.json()) as Record<string, unknown>;
    expect(typeof doc["resource"]).toBe("string");
  });

  it("publishes RFC 8414 authorization-server metadata at /.well-known/oauth-authorization-server", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34582,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
      publicUrl: "https://mcp.example.com/mcp",
    });
    const res = await fetch(`http://127.0.0.1:${handle.address.port}/.well-known/oauth-authorization-server`);
    expect(res.status).toBe(200);
    const doc = (await res.json()) as Record<string, unknown>;
    expect(doc["issuer"]).toBe("https://mcp.example.com");
    expect(doc["authorization_endpoint"]).toBe("https://mcp.example.com/authorize");
    expect(doc["token_endpoint"]).toBe("https://mcp.example.com/token");
    expect(doc["registration_endpoint"]).toBe("https://mcp.example.com/register");
    expect((doc["code_challenge_methods_supported"] as string[]).includes("S256")).toBe(true);
  });

  it("registers a new OAuth client via POST /register", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34583,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
    });
    const res = await fetch(`http://127.0.0.1:${handle.address.port}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "Dust test client",
        redirect_uris: ["https://dust.tt/oauth/callback"],
      }),
    });
    expect(res.status).toBe(201);
    const doc = (await res.json()) as Record<string, unknown>;
    expect(typeof doc["client_id"]).toBe("string");
    expect(typeof doc["client_secret"]).toBe("string");
    expect(doc["grant_types"]).toEqual(["authorization_code"]);
  });

  it("rejects requests with a Host header outside the allow-list", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34572,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
    });
    const res = await postWithHost(handle.address.port, "/mcp", "evil.example.com", "{}");
    expect(res.status).toBe(403);
    const parsed = JSON.parse(res.body) as { error?: { message?: string } };
    expect(parsed.error?.message).toMatch(/Invalid Host/);
  });

  it("accepts requests with a Host header in the configured allow-list", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "0.0.0.0",
      port: 34573,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
      allowedHosts: ["mcp.internal"],
    });
    const okRes = await postWithHost(
      handle.address.port,
      "/mcp",
      "mcp.internal",
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0.0" },
        },
      }),
      { Accept: "application/json, text/event-stream", Authorization: `Bearer ${TEST_OUR_TOKEN}` }
    );
    expect(okRes.status).toBe(200);

    const koRes = await postWithHost(handle.address.port, "/mcp", "other.example.com", "{}");
    expect(koRes.status).toBe(403);
  });

  it("disables host validation when allowedHosts is `['*']`", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34574,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
      allowedHosts: ["*"],
    });
    const res = await postWithHost(
      handle.address.port,
      "/mcp",
      "anything.example.com",
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0.0" },
        },
      }),
      { Accept: "application/json, text/event-stream", Authorization: `Bearer ${TEST_OUR_TOKEN}` }
    );
    expect(res.status).toBe(200);
  });

  it("responds to an MCP initialize request in stateless mode", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34570,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
    });
    const res = await fetch(`http://127.0.0.1:${handle.address.port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${TEST_OUR_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0.0" },
        },
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      result?: { serverInfo?: { name?: string } };
    };
    expect(json.result?.serverInfo?.name).toBe("boondmanager-mcp-server");
  });

  it("serves the MCP endpoint at / as well as /mcp", async () => {
    handle = await startHttpTransport(createMcpServer, {
      host: "127.0.0.1",
      port: 34576,
      path: "/mcp",
      stateless: true,
      enableJsonResponse: true,
    });
    // POST to root without a token → 401 (endpoint is live)
    const res = await fetch(`http://127.0.0.1:${handle.address.port}/`, {
      method: "POST",
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});
