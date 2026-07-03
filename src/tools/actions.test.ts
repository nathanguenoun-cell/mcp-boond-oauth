import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerActionTools } from "./actions.js";
import * as boondClient from "../services/boond-client.js";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

describe("registerActionTools", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register 4 action tools", () => {
    registerActionTools(server);
    expect(server.registerTool).toHaveBeenCalledTimes(4);
  });

  it("should register all expected tool names", () => {
    registerActionTools(server);
    const names = vi.mocked(server.registerTool).mock.calls.map((c) => c[0]);
    expect(names).toContain("boond_actions_search");
    expect(names).toContain("boond_actions_get");
    expect(names).toContain("boond_actions_create");
    expect(names).toContain("boond_actions_delete");
  });

  it("should register search and get as readOnly", () => {
    registerActionTools(server);
    const readOnlyCalls = vi
      .mocked(server.registerTool)
      .mock.calls.filter(
        (c) => typeof c[0] === "string" && ["boond_actions_search", "boond_actions_get"].includes(c[0] as string)
      );
    for (const call of readOnlyCalls) {
      expect(call[1].annotations?.readOnlyHint).toBe(true);
    }
  });

  it("should register delete as destructive", () => {
    registerActionTools(server);
    const deleteCall = vi.mocked(server.registerTool).mock.calls.find((c) => c[0] === "boond_actions_delete");
    expect(deleteCall?.[1].annotations?.destructiveHint).toBe(true);
  });

  describe("boond_actions_search entity filters", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function getSearchHandler(): any {
      registerActionTools(server);
      const call = vi.mocked(server.registerTool).mock.calls.find((c) => c[0] === "boond_actions_search");
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

    it("translates contactId into a CCON keywords prefix", async () => {
      const api = spyApi();
      await getSearchHandler()({ contactId: "86017", page: 1, pageSize: 30 });
      const query = api.mock.calls[0][3] as Record<string, unknown>;
      expect(query.keywords).toBe("CCON86017");
      // The bogus verbatim param must NOT be forwarded to the API.
      expect(query.contactId).toBeUndefined();
    });

    it("translates resourceId into a COMP keywords prefix", async () => {
      const api = spyApi();
      await getSearchHandler()({ resourceId: "141660", page: 1, pageSize: 30 });
      const query = api.mock.calls[0][3] as Record<string, unknown>;
      expect(query.keywords).toBe("COMP141660");
      expect(query.resourceId).toBeUndefined();
    });

    it("translates candidateId and companyId into CAND / CSOC prefixes", async () => {
      const api1 = spyApi();
      await getSearchHandler()({ candidateId: "123", page: 1, pageSize: 30 });
      expect((api1.mock.calls[0][3] as Record<string, unknown>).keywords).toBe("CAND123");

      vi.restoreAllMocks();
      const api2 = spyApi();
      await getSearchHandler()({ companyId: "6420", page: 1, pageSize: 30 });
      expect((api2.mock.calls[0][3] as Record<string, unknown>).keywords).toBe("CSOC6420");
    });

    it("appends the entity prefix to free-text keywords", async () => {
      const api = spyApi();
      await getSearchHandler()({ keywords: "call", contactId: "86017", page: 1, pageSize: 30 });
      const query = api.mock.calls[0][3] as Record<string, unknown>;
      expect(query.keywords).toBe("call CCON86017");
    });

    it("leaves keywords untouched when no entity filter is given", async () => {
      const api = spyApi();
      await getSearchHandler()({ keywords: "meeting", page: 1, pageSize: 30 });
      const query = api.mock.calls[0][3] as Record<string, unknown>;
      expect(query.keywords).toBe("meeting");
    });
  });
});
