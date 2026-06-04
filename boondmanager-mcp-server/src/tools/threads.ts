import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema, SearchSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerThreadTools(server: McpServer): void {
  server.registerTool(
    "boond_threads_search",
    {
      title: "Rechercher des fils de discussion",
      description: `Recherche des fils de discussion (messagerie interne) dans BoondManager.

Returns: Liste des fils de discussion correspondants.`,
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
      const response = await apiRequest("/threads", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "fil de discussion") }],
      };
    }
  );

  server.registerTool(
    "boond_threads_get",
    {
      title: "Détails d'un fil de discussion",
      description: `Récupère les informations détaillées d'un fil de discussion par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/threads/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
