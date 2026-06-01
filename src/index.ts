#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initClient, initClientWithAuth, oauthContextAuth } from "./services/boond-client.js";
import { createMcpServer, REGISTERED_DOMAINS } from "./server.js";
import { runUpdateNotification } from "./services/update-checker.js";
import { resolveHttpOptions, startHttpTransport } from "./transports/http.js";

type TransportKind = "stdio" | "http";

function resolveTransport(): TransportKind {
  const raw = (process.env["MCP_TRANSPORT"] ?? "").toLowerCase().trim();
  if (raw === "http" || raw === "streamable-http" || raw === "streamablehttp") return "http";
  return "stdio";
}

function readLocalPackageMeta(): { name: string; version: string } | null {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(here, "..", "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { name?: unknown; version?: unknown };
    if (typeof pkg.name !== "string" || typeof pkg.version !== "string") return null;
    return { name: pkg.name, version: pkg.version };
  } catch {
    return null;
  }
}

function scheduleUpdateCheck(): void {
  const meta = readLocalPackageMeta();
  if (!meta) return;
  void runUpdateNotification({ currentVersion: meta.version, packageName: meta.name });
}

async function main(): Promise<void> {
  const kind = resolveTransport();

  if (kind === "http") {
    // HTTP transport: OAuth2 proxy mode.
    // The MCP server acts as an Authorization Server proxy between Dust/MCP
    // clients and BoondManager. It brokers the OAuth dance (Dynamic Client
    // Registration, /authorize, /token) and maps Dust tokens to BoondManager
    // tokens per user. No client secrets are stored past the OAuth flow.
    initClientWithAuth(oauthContextAuth);
    const options = resolveHttpOptions();
    const handle = await startHttpTransport(createMcpServer, options);
    console.error("🚀 BoondManager MCP Server running (streamable HTTP + OAuth proxy)");
    console.error(`📡 MCP endpoint : http://${handle.address.host}:${handle.address.port}${handle.address.path}`);
    console.error(`📡 Root endpoint: http://${handle.address.host}:${handle.address.port}/`);
    console.error("🔐 Auth: OAuth2 proxy (Dust Connect button supported)");
    console.error(`📦 Domains: ${REGISTERED_DOMAINS.join(", ")}`);

    const shutdown = async (signal: string): Promise<void> => {
      console.error(`\n🛑 Received ${signal}, shutting down...`);
      await handle.close();
      process.exit(0);
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    scheduleUpdateCheck();
    return;
  }

  // stdio path: existing JWT / BasicAuth env vars (unchanged).
  try {
    initClient();
  } catch (error) {
    console.error("⚠️  Configuration warning:", (error as Error).message);
    console.error("The server will start but API calls will fail without proper credentials.");
  }

  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 BoondManager MCP Server running (stdio transport)");
  console.error(`📦 Domains: ${REGISTERED_DOMAINS.join(", ")}`);
  scheduleUpdateCheck();
}

main().catch((error) => {
  console.error("Fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
