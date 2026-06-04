import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPlanningAbsenceTools } from "./planning-absences.js";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

describe("registerPlanningAbsenceTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register 1 planning absence tool", () => {
    registerPlanningAbsenceTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(1);
  });

  it("should register the search tool", () => {
    registerPlanningAbsenceTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_planning_absences_search");
  });

  it("should register search as readOnly", () => {
    registerPlanningAbsenceTools(server);
    const [, metadata] = vi.mocked(server.registerTool).mock.calls[0];
    expect(metadata.annotations?.readOnlyHint).toBe(true);
  });
});
