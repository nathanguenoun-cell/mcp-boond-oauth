import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFlagTools } from "./flags.js";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

describe("registerFlagTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register 2 flag tools", () => {
    registerFlagTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(2);
  });

  it("should register all expected tool names", () => {
    registerFlagTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_flags_search");
    expect(names).toContain("boond_flags_get");
  });

  it("should register all tools as readOnly", () => {
    registerFlagTools(server);
    for (const call of vi.mocked(server.registerTool).mock.calls) {
      expect(call[1].annotations?.readOnlyHint).toBe(true);
    }
  });
});
