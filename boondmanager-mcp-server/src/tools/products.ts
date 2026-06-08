import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ProductCreateSchema, ProductUpdateSchema } from "../schemas/index.js";
import {
  registerSearchTool,
  registerGetTool,
  registerCreateTool,
  registerUpdateTool,
  registerDeleteTool,
  buildJsonApiBody,
} from "./crud-factory.js";

const OPTS = {
  entityName: "produit",
  entityNamePlural: "produits",
  apiPath: "/products",
  prefix: "boond_products",
};

export function registerProductTools(server: McpServer): void {
  registerSearchTool(server, OPTS);
  registerGetTool(server, OPTS);

  registerCreateTool(server, OPTS, ProductCreateSchema, (params) => {
    const { ...attrs } = params;
    return buildJsonApiBody("product", attrs);
  });

  registerUpdateTool(
    server, OPTS, ProductUpdateSchema,
    (params) => { const { id, ...attrs } = params; return buildJsonApiBody("product", attrs, id as string); },
    (id, apiPath) => `${apiPath}/${id}/information`
  );

  registerDeleteTool(server, OPTS);
}
