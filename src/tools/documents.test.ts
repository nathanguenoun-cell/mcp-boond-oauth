import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerDocumentTools } from "./documents.js";

function createMockServer() {
  return { registerTool: vi.fn() } as unknown as McpServer;
}

describe("registerDocumentTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register 1 tool", () => {
    registerDocumentTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(1);
  });

  it("should register boond_documents_download", () => {
    registerDocumentTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_documents_download");
  });

  it("should register the tool as readOnly and non-destructive", () => {
    registerDocumentTools(server);
    for (const call of vi.mocked(server.registerTool).mock.calls) {
      expect(call[1].annotations?.readOnlyHint).toBe(true);
      expect(call[1].annotations?.destructiveHint).toBe(false);
    }
  });

  it("should use a schema with id and conversationId", () => {
    registerDocumentTools(server);
    const [, metadata] = vi.mocked(server.registerTool).mock.calls[0];
    const schema = metadata.inputSchema as { shape?: Record<string, unknown> };
    expect(schema.shape).toHaveProperty("id");
    expect(schema.shape).toHaveProperty("conversationId");
  });
});
