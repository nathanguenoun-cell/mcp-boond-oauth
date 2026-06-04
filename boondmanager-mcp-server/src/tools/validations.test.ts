import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerValidationTools } from "./validations.js";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

describe("registerValidationTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register 2 validation tools", () => {
    registerValidationTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(2);
  });

  it("should register all expected tool names", () => {
    registerValidationTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_validations_search");
    expect(names).toContain("boond_validations_get");
  });

  it("should register all tools as readOnly", () => {
    registerValidationTools(server);
    for (const call of vi.mocked(server.registerTool).mock.calls) {
      expect(call[1].annotations?.readOnlyHint).toBe(true);
    }
  });
});
