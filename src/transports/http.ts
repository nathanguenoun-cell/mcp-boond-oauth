import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger, generateCorrelationId } from "../services/logger.js";
import { buildProtectedResourceMetadata, extractBearerToken, oauthContext } from "../services/oauth.js";
import {
  deleteAuthCode,
  deletePendingAuth,
  generateToken,
  getAccessToken,
  getAuthCode,
  getPendingAuth,
  getRegisteredClient,
  registerClient,
  storeAccessToken,
  storeAuthCode,
  storePendingAuth,
  verifyPKCE,
} from "../services/oauth-state.js";

export interface HttpTransportOptions {
  host: string;
  port: number;
  path: string;
  stateless: boolean;
  enableJsonResponse: boolean;
  sessionTtlMs?: number;
  sessionSweepIntervalMs?: number;
  allowedHosts?: string[];
  /**
   * Public URL of the MCP endpoint — e.g. `https://my-app.up.railway.app/mcp`.
   * Used as the `resource` field in OAuth discovery and as the base for deriving
   * the issuer URL. Required in production; defaults to `http://host:port/path`.
   */
  publicUrl?: string;
}

export interface HttpServerHandle {
  close: () => Promise<void>;
  address: { host: string; port: number; path: string };
  /** Always 0 — stateful sessions are not used in this transport. */
  sessionCount: () => number;
  /** No-op — kept for interface compatibility. */
  sweepIdleSessions: () => Promise<number>;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const LOCALHOST_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function readEnv(key: string): string | undefined {
  const v = process.env[key];
  if (!v || v.startsWith("${")) return undefined;
  return v;
}

function readPositiveInt(key: string, fallback: number): number {
  const raw = readEnv(key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function readAllowedHosts(): string[] | undefined {
  const raw = readEnv("MCP_HTTP_ALLOWED_HOSTS");
  if (raw === undefined) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts;
}

export function resolveAllowedHosts(configured: string[] | undefined, host: string): string[] {
  if (configured && configured.length > 0) {
    if (configured.includes("*")) return [];
    return configured;
  }
  if (LOOPBACK_HOSTS.has(host)) return LOCALHOST_ALLOWED_HOSTS;
  return [];
}

function extractHostname(hostHeader: string | string[] | undefined): string | undefined {
  if (!hostHeader) return undefined;
  const value = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!value) return undefined;
  try {
    return new URL(`http://${value}`).hostname;
  } catch {
    return undefined;
  }
}

export function resolveHttpOptions(): HttpTransportOptions {
  // Railway sets PORT; MCP_HTTP_PORT is the per-project override.
  const portRaw = readEnv("MCP_HTTP_PORT") ?? readEnv("PORT");
  const port = portRaw ? Number.parseInt(portRaw, 10) : 3000;
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid MCP_HTTP_PORT: ${portRaw}`);
  }

  const stateless = (readEnv("MCP_HTTP_STATEFUL") ?? "false").toLowerCase() !== "true";
  const enableJsonResponse = (readEnv("MCP_HTTP_JSON_RESPONSE") ?? "false").toLowerCase() === "true";

  return {
    host: readEnv("MCP_HTTP_HOST") ?? "127.0.0.1",
    port,
    path: readEnv("MCP_HTTP_PATH") ?? "/mcp",
    stateless,
    enableJsonResponse,
    sessionTtlMs: readPositiveInt("MCP_HTTP_SESSION_TTL_MS", 30 * 60_000),
    sessionSweepIntervalMs: readPositiveInt("MCP_HTTP_SESSION_SWEEP_INTERVAL_MS", 5 * 60_000),
    allowedHosts: readAllowedHosts(),
    publicUrl: readEnv("MCP_HTTP_PUBLIC_URL"),
  };
}

/**
 * Derive the base URL (scheme + host, no path) from a full endpoint URL.
 * `https://my-app.up.railway.app/mcp` → `https://my-app.up.railway.app`
 */
function resolveBaseUrl(options: HttpTransportOptions): string {
  const source = options.publicUrl ?? `http://${options.host}:${options.port}${options.path}`;
  try {
    const u = new URL(source);
    return `${u.protocol}//${u.host}`;
  } catch {
    return source;
  }
}

/** Full URL of the MCP endpoint (used as the OAuth2 `resource` identifier). */
function resolveResourceUrl(options: HttpTransportOptions): string {
  if (options.publicUrl) return options.publicUrl.replace(/\/$/, "") || options.publicUrl;
  return `http://${options.host}:${options.port}${options.path}`;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function readUrlEncodedBody(req: IncomingMessage): Promise<Record<string, string>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  const params = new URLSearchParams(raw);
  const result: Record<string, string> = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

// CORS headers required for browser-based MCP clients (e.g. Dust).
// Applied to all public OAuth and discovery endpoints.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
};

function writeJson(res: ServerResponse, status: number, body: unknown, extraHeaders?: Record<string, string>): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      res.setHeader(k, v);
    }
  }
  res.end(JSON.stringify(body));
}

function writeJsonRpcError(res: ServerResponse, status: number, message: string): void {
  writeJson(res, status, { jsonrpc: "2.0", error: { code: -32000, message }, id: null });
}

function writeOAuthError(res: ServerResponse, status: number, wwwAuthenticate: string, message: string): void {
  writeJson(
    res,
    status,
    { jsonrpc: "2.0", error: { code: -32001, message }, id: null },
    {
      "WWW-Authenticate": wwwAuthenticate,
    }
  );
}

export async function startHttpTransport(
  createServerFactory: () => McpServer,
  options: HttpTransportOptions
): Promise<HttpServerHandle> {
  const allowedHosts = resolveAllowedHosts(options.allowedHosts, options.host);
  const resourceUrl = resolveResourceUrl(options);
  const baseUrl = resolveBaseUrl(options);

  // The MCP server itself is the OAuth Authorization Server proxy.
  // The resource_metadata points to the base URL discovery endpoint.
  const resourceMetadataUrl = `${baseUrl}/.well-known/oauth-protected-resource`;
  const wwwAuthenticate = `Bearer realm="${resourceUrl}", resource_metadata="${resourceMetadataUrl}"`;

  // BoondManager OAuth app credentials (required for the proxy flow).
  const boondClientId = readEnv("BOOND_OAUTH_CLIENT_ID") ?? "";
  const boondClientSecret = readEnv("BOOND_OAUTH_CLIENT_SECRET") ?? "";
  const boondAuthUrl = readEnv("BOOND_OAUTH_AUTH_URL") ?? "https://ui.boondmanager.com/oauth/authorize";
  const boondTokenUrl = readEnv("BOOND_OAUTH_TOKEN_URL") ?? "https://ui.boondmanager.com/oauth/token";
  const boondRedirectUri = readEnv("BOOND_OAUTH_REDIRECT_URI") ?? `${baseUrl}/auth/callback`;

  const httpServer = createServer(async (req, res) => {
    const corrId = generateCorrelationId();
    const reqLogger = logger.child({ corrId, method: req.method, path: req.url });

    try {
      // DNS rebinding protection (CVE-2025-66414).
      if (allowedHosts.length > 0) {
        const hostname = extractHostname(req.headers.host);
        if (!hostname) {
          writeJsonRpcError(res, 403, "Missing or invalid Host header");
          return;
        }
        if (!allowedHosts.includes(hostname)) {
          writeJsonRpcError(res, 403, `Invalid Host: ${hostname}`);
          return;
        }
      }

      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
      const { pathname } = url;

      // CORS preflight — browser clients (Dust) send OPTIONS before every
      // cross-origin request. Respond immediately with the allowed headers.
      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
        res.end();
        return;
      }

      // ── RFC 9728: OAuth2 protected-resource metadata ──────────────────────
      // The MCP server is the authorization server proxy — authorization_servers
      // points to itself (baseUrl), not to BoondManager directly.
      if (
        req.method === "GET" &&
        (pathname === "/.well-known/oauth-protected-resource" ||
          pathname === `/.well-known/oauth-protected-resource${options.path}`)
      ) {
        const doc = buildProtectedResourceMetadata({
          resource: resourceUrl,
          authorizationServers: [baseUrl],
        });
        res.statusCode = 200;
        for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.end(JSON.stringify(doc));
        return;
      }

      // ── RFC 8414: OAuth2 Authorization Server metadata ────────────────────
      if (req.method === "GET" && pathname === "/.well-known/oauth-authorization-server") {
        writeJson(
          res,
          200,
          {
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/authorize`,
            token_endpoint: `${baseUrl}/token`,
            registration_endpoint: `${baseUrl}/register`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code"],
            code_challenge_methods_supported: ["S256", "plain"],
            token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
          },
          { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" }
        );
        return;
      }

      // ── RFC 7591: Dynamic Client Registration ─────────────────────────────
      if (req.method === "POST" && pathname === "/register") {
        const body = (await readJsonBody(req)) as Record<string, unknown> | undefined;
        const redirectUris = (body?.["redirect_uris"] as string[] | undefined) ?? [];
        const clientName = (body?.["client_name"] as string | undefined) ?? "Unknown client";

        const clientId = generateToken();
        const clientSecret = generateToken();
        registerClient({ clientId, clientSecret, redirectUris, clientName });

        writeJson(
          res,
          201,
          {
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uris: redirectUris,
            client_name: clientName,
            client_id_issued_at: Math.floor(Date.now() / 1000),
            grant_types: ["authorization_code"],
            response_types: ["code"],
            token_endpoint_auth_method: "client_secret_post",
          },
          CORS_HEADERS
        );
        return;
      }

      // ── Authorization endpoint: redirect to BoondManager OAuth ───────────
      if (req.method === "GET" && pathname === "/authorize") {
        const clientId = url.searchParams.get("client_id") ?? "";
        const redirectUri = url.searchParams.get("redirect_uri") ?? "";
        const clientState = url.searchParams.get("state") ?? "";
        const codeChallenge = url.searchParams.get("code_challenge") ?? "";
        const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "plain";

        // ourState links this pending request to the BoondManager callback.
        const ourState = generateToken();
        storePendingAuth(ourState, {
          clientId,
          redirectUri,
          clientState,
          codeChallenge,
          codeChallengeMethod,
        });

        const boondUrl = new URL(boondAuthUrl);
        boondUrl.searchParams.set("client_id", boondClientId);
        boondUrl.searchParams.set("redirect_uri", boondRedirectUri);
        boondUrl.searchParams.set("response_type", "code");
        boondUrl.searchParams.set("state", ourState);

        res.statusCode = 302;
        res.setHeader("Location", boondUrl.toString());
        res.end();
        return;
      }

      // ── OAuth callback: exchange BoondManager code → store mapping ────────
      if (req.method === "GET" && pathname === "/auth/callback") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state") ?? "";

        const pending = getPendingAuth(state);
        // Always redirect — never show an error page in the callback.
        if (!pending) {
          reqLogger.warn({ state }, "OAuth callback with unknown state");
          res.statusCode = 302;
          res.setHeader("Location", baseUrl);
          res.end();
          return;
        }
        deletePendingAuth(state);

        const redirectToClient = (extraParams: Record<string, string>): void => {
          const redirectUrl = new URL(pending.redirectUri);
          redirectUrl.searchParams.set("state", pending.clientState);
          for (const [k, v] of Object.entries(extraParams)) {
            redirectUrl.searchParams.set(k, v);
          }
          res.statusCode = 302;
          res.setHeader("Location", redirectUrl.toString());
          res.end();
        };

        if (!code) {
          redirectToClient({ error: url.searchParams.get("error") ?? "access_denied" });
          return;
        }

        try {
          const tokenRes = await fetch(boondTokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              client_id: boondClientId,
              client_secret: boondClientSecret,
              code,
              redirect_uri: boondRedirectUri,
            }).toString(),
          });

          if (!tokenRes.ok) {
            reqLogger.error({ status: tokenRes.status }, "BoondManager token exchange failed");
            redirectToClient({ error: "server_error" });
            return;
          }

          const tokenData = (await tokenRes.json()) as Record<string, unknown>;
          const boondToken = tokenData["access_token"] as string | undefined;
          if (!boondToken) {
            redirectToClient({ error: "server_error" });
            return;
          }

          const ourCode = generateToken();
          storeAuthCode(ourCode, {
            clientId: pending.clientId,
            redirectUri: pending.redirectUri,
            codeChallenge: pending.codeChallenge,
            codeChallengeMethod: pending.codeChallengeMethod,
            boondToken,
            createdAt: Date.now(),
          });

          redirectToClient({ code: ourCode });
        } catch (err) {
          reqLogger.error({ err }, "BoondManager token exchange error");
          redirectToClient({ error: "server_error" });
        }
        return;
      }

      // ── Token endpoint: exchange our auth code → our access token ─────────
      if (req.method === "POST" && pathname === "/token") {
        const ct = req.headers["content-type"] ?? "";
        const body = ct.includes("application/x-www-form-urlencoded")
          ? await readUrlEncodedBody(req)
          : (((await readJsonBody(req)) as Record<string, string> | undefined) ?? {});

        const { grant_type, code, client_id, client_secret, code_verifier } = body;

        if (grant_type !== "authorization_code") {
          writeJson(res, 400, { error: "unsupported_grant_type" }, CORS_HEADERS);
          return;
        }

        const storedCode = getAuthCode(code ?? "");
        if (!storedCode) {
          writeJson(res, 400, { error: "invalid_grant" }, CORS_HEADERS);
          return;
        }
        deleteAuthCode(code ?? "");

        if (storedCode.clientId !== client_id) {
          writeJson(res, 401, { error: "invalid_client" }, CORS_HEADERS);
          return;
        }

        const registeredClient = getRegisteredClient(client_id ?? "");
        if (!registeredClient || registeredClient.clientSecret !== client_secret) {
          writeJson(res, 401, { error: "invalid_client" }, CORS_HEADERS);
          return;
        }

        if (storedCode.codeChallenge) {
          if (!code_verifier || !verifyPKCE(code_verifier, storedCode.codeChallenge, storedCode.codeChallengeMethod)) {
            writeJson(
              res,
              400,
              { error: "invalid_grant", error_description: "PKCE verification failed" },
              CORS_HEADERS
            );
            return;
          }
        }

        const accessToken = generateToken();
        storeAccessToken(accessToken, {
          boondToken: storedCode.boondToken,
          clientId: client_id ?? "",
          createdAt: Date.now(),
        });

        writeJson(
          res,
          200,
          {
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: 3600,
          },
          CORS_HEADERS
        );
        return;
      }

      // ── MCP endpoint: served at /mcp and / (Dust connects to the root) ────
      const isMcpEndpoint = pathname === options.path || pathname === "/";
      if (!isMcpEndpoint) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }

      // Check method before auth so a GET without a token gets 405, not 401.
      if (req.method !== "POST") {
        writeJsonRpcError(res, 405, "Only POST is supported");
        return;
      }

      const ourToken = extractBearerToken(req.headers["authorization"]);
      if (!ourToken) {
        writeOAuthError(res, 401, wwwAuthenticate, "Missing Bearer token. Complete the OAuth flow first.");
        return;
      }

      const tokenData = getAccessToken(ourToken);
      if (!tokenData) {
        writeOAuthError(res, 401, wwwAuthenticate, "Invalid or expired Bearer token.");
        return;
      }

      // Map our token → BoondManager token and inject into the per-request context.
      await oauthContext.run({ accessToken: tokenData.boondToken }, async () => {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: options.enableJsonResponse,
        });
        const server = createServerFactory();
        res.on("close", () => {
          void transport.close();
          void server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res);
      });
    } catch (error) {
      reqLogger.error({ err: error }, "HTTP transport error");
      if (!res.headersSent) {
        writeJsonRpcError(res, 500, "Internal server error");
      } else {
        res.end();
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(options.port, options.host, () => {
      httpServer.removeListener("error", reject);
      resolve();
    });
  });

  return {
    address: { host: options.host, port: options.port, path: options.path },
    sessionCount: () => 0,
    sweepIdleSessions: () => Promise.resolve(0),
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
