import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema, SearchSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerBusinessUnitTools(server: McpServer): void {
  server.registerTool(
    "boond_business_units_search",
    {
      title: "Rechercher des business units",
      description: `Recherche des business units dans BoondManager.

Returns: Liste des business units correspondantes.`,
      inputSchema: SearchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const query = buildSearchQuery(params);
      const response = await apiRequest("/business-units", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "business unit") }],
      };
    }
  );

  server.registerTool(
    "boond_business_units_get",
    {
      title: "Détails d'une business unit",
      description: `Récupère les informations détaillées d'une business unit par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/business-units/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
