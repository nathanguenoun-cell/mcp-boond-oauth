import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerContractTools } from "./contracts.js";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

describe("registerContractTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register 2 contract tools", () => {
    registerContractTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(2);
  });

  it("should register all expected tool names", () => {
    registerContractTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_contracts_get");
    expect(names).toContain("boond_contracts_create");
  });

  it("should register get as readOnly", () => {
    registerContractTools(server);
    const getCall = vi.mocked(server.registerTool).mock.calls.find(
      (c) => c[0] === "boond_contracts_get"
    );
    expect(getCall?.[1].annotations?.readOnlyHint).toBe(true);
  });

  it("should register create as non-readOnly", () => {
    registerContractTools(server);
    const createCall = vi.mocked(server.registerTool).mock.calls.find(
      (c) => c[0] === "boond_contracts_create"
    );
    expect(createCall?.[1].annotations?.readOnlyHint).toBe(false);
    expect(createCall?.[1].annotations?.destructiveHint).toBe(false);
  });
});
