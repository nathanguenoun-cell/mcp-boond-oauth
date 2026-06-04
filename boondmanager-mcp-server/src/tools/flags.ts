import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema, SearchSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerFlagTools(server: McpServer): void {
  server.registerTool(
    "boond_flags_search",
    {
      title: "Rechercher des drapeaux/étiquettes",
      description: `Recherche des drapeaux (flags/étiquettes) dans BoondManager.

Returns: Liste des drapeaux correspondants.`,
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
      const response = await apiRequest("/flags", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "drapeau") }],
      };
    }
  );

  server.registerTool(
    "boond_flags_get",
    {
      title: "Détails d'un drapeau/étiquette",
      description: `Récupère les informations détaillées d'un drapeau par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/flags/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
