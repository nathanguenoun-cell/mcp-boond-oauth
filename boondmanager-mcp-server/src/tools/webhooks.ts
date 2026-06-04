import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema, SearchSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerWebhookTools(server: McpServer): void {
  server.registerTool(
    "boond_webhooks_search",
    {
      title: "Rechercher des webhooks",
      description: `Recherche des webhooks configurés dans BoondManager.

Returns: Liste des webhooks correspondants.`,
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
      const response = await apiRequest("/webhooks", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "webhook") }],
      };
    }
  );

  server.registerTool(
    "boond_webhooks_get",
    {
      title: "Détails d'un webhook",
      description: `Récupère les informations détaillées d'un webhook par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/webhooks/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
