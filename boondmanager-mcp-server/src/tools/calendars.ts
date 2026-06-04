import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema, SearchSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerCalendarTools(server: McpServer): void {
  server.registerTool(
    "boond_calendars_search",
    {
      title: "Rechercher des calendriers",
      description: `Recherche des calendriers dans BoondManager.

Returns: Liste des calendriers correspondants.`,
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
      const response = await apiRequest("/calendars", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "calendrier") }],
      };
    }
  );

  server.registerTool(
    "boond_calendars_get",
    {
      title: "Détails d'un calendrier",
      description: `Récupère les informations détaillées d'un calendrier par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/calendars/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
