import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPositioningTools } from "./positionings.js";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

describe("registerPositioningTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register 4 positioning tools", () => {
    registerPositioningTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(4);
  });

  it("should register all expected tool names", () => {
    registerPositioningTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_positionings_search");
    expect(names).toContain("boond_positionings_get");
    expect(names).toContain("boond_positionings_create");
    expect(names).toContain("boond_positionings_delete");
  });

  it("should register search and get as readOnly", () => {
    registerPositioningTools(server);
    const readOnlyCalls = vi.mocked(server.registerTool).mock.calls.filter(
      (c) => typeof c[0] === "string" && ["boond_positionings_search", "boond_positionings_get"].includes(c[0] as string)
    );
    for (const call of readOnlyCalls) {
      expect(call[1].annotations?.readOnlyHint).toBe(true);
    }
  });

  it("should register delete as destructive", () => {
    registerPositioningTools(server);
    const deleteCall = vi.mocked(server.registerTool).mock.calls.find(
      (c) => c[0] === "boond_positionings_delete"
    );
    expect(deleteCall?.[1].annotations?.destructiveHint).toBe(true);
  });
});
