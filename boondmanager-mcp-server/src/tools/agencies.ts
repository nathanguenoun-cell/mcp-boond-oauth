import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema, SearchSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerAgencyTools(server: McpServer): void {
  server.registerTool(
    "boond_agencies_search",
    {
      title: "Rechercher des agences",
      description: `Recherche des agences dans BoondManager.

Returns: Liste des agences correspondantes.`,
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
      const response = await apiRequest("/agencies", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "agence") }],
      };
    }
  );

  server.registerTool(
    "boond_agencies_get",
    {
      title: "Détails d'une agence",
      description: `Récupère les informations détaillées d'une agence par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/agencies/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
