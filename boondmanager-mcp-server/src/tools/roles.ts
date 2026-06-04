import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema, SearchSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerRoleTools(server: McpServer): void {
  server.registerTool(
    "boond_roles_search",
    {
      title: "Rechercher des rôles",
      description: `Recherche des rôles/profils de droits dans BoondManager.

Returns: Liste des rôles correspondants.`,
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
      const response = await apiRequest("/roles", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "rôle") }],
      };
    }
  );

  server.registerTool(
    "boond_roles_get",
    {
      title: "Détails d'un rôle",
      description: `Récupère les informations détaillées d'un rôle par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/roles/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
