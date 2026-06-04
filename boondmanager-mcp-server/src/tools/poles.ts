import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema, SearchSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerPoleTools(server: McpServer): void {
  server.registerTool(
    "boond_poles_search",
    {
      title: "Rechercher des pôles",
      description: `Recherche des pôles (départements/services) dans BoondManager.

Returns: Liste des pôles correspondants.`,
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
      const response = await apiRequest("/poles", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "pôle") }],
      };
    }
  );

  server.registerTool(
    "boond_poles_get",
    {
      title: "Détails d'un pôle",
      description: `Récupère les informations détaillées d'un pôle par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/poles/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
