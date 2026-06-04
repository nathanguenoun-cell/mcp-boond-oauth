import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema, SearchSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerAccountTools(server: McpServer): void {
  server.registerTool(
    "boond_accounts_search",
    {
      title: "Rechercher des comptes utilisateurs",
      description: `Recherche des comptes utilisateurs dans BoondManager.

Returns: Liste des comptes correspondants.`,
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
      const response = await apiRequest("/accounts", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "compte") }],
      };
    }
  );

  server.registerTool(
    "boond_accounts_get",
    {
      title: "Détails d'un compte utilisateur",
      description: `Récupère les informations détaillées d'un compte utilisateur par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/accounts/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
