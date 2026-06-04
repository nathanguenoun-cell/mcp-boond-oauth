import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTimesheetTools } from "./timesheets.js";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

describe("registerTimesheetTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register 3 timesheet tools", () => {
    registerTimesheetTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(3);
  });

  it("should register boond_resources_timesheets tool", () => {
    registerTimesheetTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_resources_timesheets");
  });

  it("should register boond_timesheets_search tool", () => {
    registerTimesheetTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_timesheets_search");
  });

  it("should register boond_timesheets_get tool", () => {
    registerTimesheetTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_timesheets_get");
  });

  it("should register all tools as readOnly", () => {
    registerTimesheetTools(server);
    for (const call of vi.mocked(server.registerTool).mock.calls) {
      const [, metadata] = call;
      expect(metadata.annotations?.readOnlyHint).toBe(true);
      expect(metadata.annotations?.destructiveHint).toBe(false);
    }
  });
});
