import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPositioningTools } from "./positionings.js";
import * as boondClient from "../services/boond-client.js";

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
    const readOnlyCalls = vi
      .mocked(server.registerTool)
      .mock.calls.filter(
        (c) =>
          typeof c[0] === "string" && ["boond_positionings_search", "boond_positionings_get"].includes(c[0] as string)
      );
    for (const call of readOnlyCalls) {
      expect(call[1].annotations?.readOnlyHint).toBe(true);
    }
  });

  it("should register delete as destructive", () => {
    registerPositioningTools(server);
    const deleteCall = vi.mocked(server.registerTool).mock.calls.find((c) => c[0] === "boond_positionings_delete");
    expect(deleteCall?.[1].annotations?.destructiveHint).toBe(true);
  });

  describe("boond_positionings_search entity filters", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function getSearchHandler(): any {
      registerPositioningTools(server);
      const call = vi.mocked(server.registerTool).mock.calls.find((c) => c[0] === "boond_positionings_search");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return call![2] as any;
    }

    function spyApi() {
      return vi
        .spyOn(boondClient, "apiRequest")
        .mockResolvedValue({ data: [], meta: { totals: { rows: 0 } } } as never);
    }

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("translates opportunityId into an AO keywords prefix", async () => {
      const api = spyApi();
      await getSearchHandler()({ opportunityId: "4", page: 1, pageSize: 30 });
      const query = api.mock.calls[0][3] as Record<string, unknown>;
      expect(query.keywords).toBe("AO4");
      // The bogus verbatim param must NOT be forwarded to the API.
      expect(query.opportunityId).toBeUndefined();
    });

    it("translates candidateId into a CAND keywords prefix", async () => {
      const api = spyApi();
      await getSearchHandler()({ candidateId: "123", page: 1, pageSize: 30 });
      const query = api.mock.calls[0][3] as Record<string, unknown>;
      expect(query.keywords).toBe("CAND123");
      expect(query.candidateId).toBeUndefined();
    });

    it("translates resourceId into a COMP keywords prefix", async () => {
      const api = spyApi();
      await getSearchHandler()({ resourceId: "141660", page: 1, pageSize: 30 });
      const query = api.mock.calls[0][3] as Record<string, unknown>;
      expect(query.keywords).toBe("COMP141660");
      expect(query.resourceId).toBeUndefined();
    });

    it("appends the entity prefix to free-text keywords", async () => {
      const api = spyApi();
      await getSearchHandler()({ keywords: "dev", opportunityId: "4", page: 1, pageSize: 30 });
      const query = api.mock.calls[0][3] as Record<string, unknown>;
      expect(query.keywords).toBe("dev AO4");
    });

    it("leaves keywords untouched when no entity filter is given", async () => {
      const api = spyApi();
      await getSearchHandler()({ keywords: "dev", page: 1, pageSize: 30 });
      const query = api.mock.calls[0][3] as Record<string, unknown>;
      expect(query.keywords).toBe("dev");
    });

    it("hits the paginated /positionings endpoint with server-side pagination", async () => {
      const api = spyApi();
      await getSearchHandler()({ opportunityId: "4", page: 2, pageSize: 10 });
      expect(api.mock.calls[0][0]).toBe("/positionings");
      const query = api.mock.calls[0][3] as Record<string, unknown>;
      expect(query.page).toBe(2);
      expect(query.maxResults).toBe(10);
    });
  });
});
