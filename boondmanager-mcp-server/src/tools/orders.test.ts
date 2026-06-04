import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOrderTools } from "./orders.js";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

describe("registerOrderTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register 5 order tools", () => {
    registerOrderTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(5);
  });

  it("should register all expected tool names", () => {
    registerOrderTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_orders_search");
    expect(names).toContain("boond_orders_get");
    expect(names).toContain("boond_orders_create");
    expect(names).toContain("boond_orders_update");
    expect(names).toContain("boond_orders_delete");
  });

  it("should register search and get as readOnly", () => {
    registerOrderTools(server);
    const readOnlyCalls = vi.mocked(server.registerTool).mock.calls.filter(
      (c) => typeof c[0] === "string" && ["boond_orders_search", "boond_orders_get"].includes(c[0] as string)
    );
    for (const call of readOnlyCalls) {
      expect(call[1].annotations?.readOnlyHint).toBe(true);
    }
  });

  it("should register delete as destructive", () => {
    registerOrderTools(server);
    const deleteCall = vi.mocked(server.registerTool).mock.calls.find(
      (c) => c[0] === "boond_orders_delete"
    );
    expect(deleteCall?.[1].annotations?.destructiveHint).toBe(true);
  });
});
