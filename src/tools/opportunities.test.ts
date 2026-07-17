import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerOpportunityTools } from "./opportunities.js";
import * as boondClient from "../services/boond-client.js";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

describe("registerOpportunityTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register CRUD tools + 5 tab tools = 10 total", () => {
    registerOpportunityTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(10);
  });

  it("should register all CRUD tools", () => {
    registerOpportunityTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_opportunities_search");
    expect(names).toContain("boond_opportunities_get");
    expect(names).toContain("boond_opportunities_create");
    expect(names).toContain("boond_opportunities_update");
    expect(names).toContain("boond_opportunities_delete");
  });

  it("should register all 5 tab tools", () => {
    registerOpportunityTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_opportunities_information");
    expect(names).toContain("boond_opportunities_actions");
    expect(names).toContain("boond_opportunities_positionings");
    expect(names).toContain("boond_opportunities_projects");
    expect(names).toContain("boond_opportunities_simulation");
  });

  it("should register tab tools as readOnly and non-destructive", () => {
    registerOpportunityTools(server);
    const tabCalls = vi
      .mocked(server.registerTool)
      .mock.calls.filter(
        (c) =>
          typeof c[0] === "string" &&
          [
            "boond_opportunities_information",
            "boond_opportunities_actions",
            "boond_opportunities_positionings",
            "boond_opportunities_projects",
            "boond_opportunities_simulation",
          ].includes(c[0] as string)
      );

    expect(tabCalls).toHaveLength(5);
    for (const call of tabCalls) {
      const [, metadata] = call;
      expect(metadata.annotations?.readOnlyHint).toBe(true);
      expect(metadata.annotations?.destructiveHint).toBe(false);
    }
  });

  describe("boond_opportunities_positionings", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function getTabHandler(name: string): any {
      registerOpportunityTools(server);
      const call = vi.mocked(server.registerTool).mock.calls.find((c) => c[0] === name);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return call![2] as any;
    }

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns every positioning of the opportunity, not just the first", async () => {
      vi.spyOn(boondClient, "apiRequest").mockResolvedValue({
        data: [
          { id: "11", type: "positioning", attributes: { state: 1 } },
          { id: "22", type: "positioning", attributes: { state: 2 } },
          { id: "33", type: "positioning", attributes: { state: 3 } },
        ],
        meta: { totals: { rows: 3 } },
      } as never);

      const result = await getTabHandler("boond_opportunities_positionings")({ id: "4" });
      const text = result.content[0].text as string;

      expect(text).toContain("11");
      expect(text).toContain("22");
      expect(text).toContain("33");
    });

    it("hits the nested positionings endpoint", async () => {
      const api = vi
        .spyOn(boondClient, "apiRequest")
        .mockResolvedValue({ data: [], meta: { totals: { rows: 0 } } } as never);

      await getTabHandler("boond_opportunities_positionings")({ id: "4" });
      expect(api.mock.calls[0][0]).toBe("/opportunities/4/positionings");
    });

    it("still formats single-resource tabs as a detail document", async () => {
      vi.spyOn(boondClient, "apiRequest").mockResolvedValue({
        data: { id: "4", type: "opportunity", attributes: { title: "Mission X" } },
      } as never);

      const result = await getTabHandler("boond_opportunities_information")({ id: "4" });
      expect(result.content[0].text).toContain("Mission X");
    });
  });
});
