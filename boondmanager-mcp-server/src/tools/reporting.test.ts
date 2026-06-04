import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReportingTools } from "./reporting.js";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

describe("registerReportingTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register 5 reporting tools", () => {
    registerReportingTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(5);
  });

  it("should register all expected tool names", () => {
    registerReportingTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_reporting_companies");
    expect(names).toContain("boond_reporting_projects");
    expect(names).toContain("boond_reporting_resources");
    expect(names).toContain("boond_reporting_synthesis");
    expect(names).toContain("boond_reporting_production_plans");
  });

  it("should register all tools as readOnly", () => {
    registerReportingTools(server);
    for (const call of vi.mocked(server.registerTool).mock.calls) {
      expect(call[1].annotations?.readOnlyHint).toBe(true);
    }
  });
});
