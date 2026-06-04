import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema, SearchSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerLogTools(server: McpServer): void {
  server.registerTool(
    "boond_logs_search",
    {
      title: "Rechercher des logs d'audit",
      description: `Recherche des logs d'audit dans BoondManager (historique des actions utilisateurs).

Returns: Liste des logs correspondants.`,
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
      const response = await apiRequest("/logs", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "log") }],
      };
    }
  );

  server.registerTool(
    "boond_logs_get",
    {
      title: "Détails d'un log d'audit",
      description: `Récupère les informations détaillées d'un log d'audit par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/logs/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
