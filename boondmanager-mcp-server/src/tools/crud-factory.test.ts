import { describe, it, expect, vi, beforeEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildJsonApiBody,
  registerSearchTool,
  registerGetTool,
  registerCreateTool,
  registerUpdateTool,
  registerDeleteTool,
} from "./crud-factory.js";
import { z } from "zod";

function createMockServer() {
  return {
    registerTool: vi.fn(),
  } as unknown as McpServer;
}

const OPTS = {
  entityName: "test-entity",
  entityNamePlural: "test-entities",
  apiPath: "/tests",
  prefix: "boond_tests",
};

describe("buildJsonApiBody", () => {
  it("should build correct JSON:API structure", () => {
    const result = buildJsonApiBody("candidate", { firstName: "Jean", lastName: "Dupont" });
    expect(result).toEqual({
      data: {
        type: "candidate",
        attributes: { firstName: "Jean", lastName: "Dupont" },
      },
    });
  });

  it("should include id when provided", () => {
    const result = buildJsonApiBody("candidate", { firstName: "Jean" }, "123") as {
      data: { id: string; type: string; attributes: Record<string, unknown> };
    };
    expect(result.data.id).toBe("123");
  });

  it("should filter out undefined values", () => {
    const result = buildJsonApiBody("candidate", {
      firstName: "Jean",
      lastName: undefined,
      city: "Paris",
    }) as { data: { attributes: Record<string, unknown> } };
    expect(result.data.attributes).toEqual({ firstName: "Jean", city: "Paris" });
    expect(result.data.attributes).not.toHaveProperty("lastName");
  });

  it("should handle empty attributes", () => {
    const result = buildJsonApiBody("candidate", {}) as {
      data: { attributes: Record<string, unknown> };
    };
    expect(result.data.attributes).toEqual({});
  });
});

describe("registerSearchTool", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register a tool with correct name", () => {
    registerSearchTool(server, OPTS);
    expect(server.registerTool).toHaveBeenCalledOnce();
    const [name] = vi.mocked(server.registerTool).mock.calls[0];
    expect(name).toBe("boond_tests_search");
  });

  it("should register with readOnly annotations", () => {
    registerSearchTool(server, OPTS);
    const [, metadata] = vi.mocked(server.registerTool).mock.calls[0];
    expect(metadata.annotations?.readOnlyHint).toBe(true);
    expect(metadata.annotations?.destructiveHint).toBe(false);
  });
});

describe("registerGetTool", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register a tool with correct name", () => {
    registerGetTool(server, OPTS);
    const [name] = vi.mocked(server.registerTool).mock.calls[0];
    expect(name).toBe("boond_tests_get");
  });

  it("should register with readOnly annotations", () => {
    registerGetTool(server, OPTS);
    const [, metadata] = vi.mocked(server.registerTool).mock.calls[0];
    expect(metadata.annotations?.readOnlyHint).toBe(true);
  });
});

describe("registerCreateTool", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register a tool with correct name", () => {
    const schema = z.object({ name: z.string() });
    registerCreateTool(server, OPTS, schema, (p) => buildJsonApiBody("test", p));
    const [name] = vi.mocked(server.registerTool).mock.calls[0];
    expect(name).toBe("boond_tests_create");
  });

  it("should register with non-readOnly, non-destructive annotations", () => {
    const schema = z.object({ name: z.string() });
    registerCreateTool(server, OPTS, schema, (p) => buildJsonApiBody("test", p));
    const [, metadata] = vi.mocked(server.registerTool).mock.calls[0];
    expect(metadata.annotations?.readOnlyHint).toBe(false);
    expect(metadata.annotations?.destructiveHint).toBe(false);
  });
});

describe("registerUpdateTool", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register a tool with correct name", () => {
    const schema = z.object({ id: z.string(), name: z.string().optional() });
    registerUpdateTool(server, OPTS, schema, (p) => buildJsonApiBody("test", p));
    const [name] = vi.mocked(server.registerTool).mock.calls[0];
    expect(name).toBe("boond_tests_update");
  });

  it("should register as idempotent", () => {
    const schema = z.object({ id: z.string() });
    registerUpdateTool(server, OPTS, schema, (p) => buildJsonApiBody("test", p));
    const [, metadata] = vi.mocked(server.registerTool).mock.calls[0];
    expect(metadata.annotations?.idempotentHint).toBe(true);
  });
});

describe("registerDeleteTool", () => {
  let server: McpServer;

  beforeEach(() => {
    server = createMockServer();
  });

  it("should register a tool with correct name", () => {
    registerDeleteTool(server, OPTS);
    const [name] = vi.mocked(server.registerTool).mock.calls[0];
    expect(name).toBe("boond_tests_delete");
  });

  it("should register with destructive annotation", () => {
    registerDeleteTool(server, OPTS);
    const [, metadata] = vi.mocked(server.registerTool).mock.calls[0];
    expect(metadata.annotations?.destructiveHint).toBe(true);
  });
});
