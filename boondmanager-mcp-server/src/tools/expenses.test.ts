import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerExpenseTools } from "./expenses.js";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

describe("registerExpenseTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register 5 expense tools", () => {
    registerExpenseTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(5);
  });

  it("should register all expected tool names", () => {
    registerExpenseTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_expenses_search");
    expect(names).toContain("boond_expenses_get");
    expect(names).toContain("boond_expenses_create");
    expect(names).toContain("boond_expenses_update");
    expect(names).toContain("boond_expenses_delete");
  });

  it("should register search and get as readOnly", () => {
    registerExpenseTools(server);
    const readOnlyCalls = vi.mocked(server.registerTool).mock.calls.filter(
      (c) => typeof c[0] === "string" && ["boond_expenses_search", "boond_expenses_get"].includes(c[0] as string)
    );
    for (const call of readOnlyCalls) {
      expect(call[1].annotations?.readOnlyHint).toBe(true);
    }
  });

  it("should register delete as destructive", () => {
    registerExpenseTools(server);
    const deleteCall = vi.mocked(server.registerTool).mock.calls.find(
      (c) => c[0] === "boond_expenses_delete"
    );
    expect(deleteCall?.[1].annotations?.destructiveHint).toBe(true);
  });
});
