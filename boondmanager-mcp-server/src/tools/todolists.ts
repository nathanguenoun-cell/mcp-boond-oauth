import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema, SearchSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerTodolistTools(server: McpServer): void {
  server.registerTool(
    "boond_todolists_search",
    {
      title: "Rechercher des listes de tâches",
      description: `Recherche des listes de tâches (todolists) dans BoondManager.

Returns: Liste des todolists correspondantes.`,
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
      const response = await apiRequest("/todolists", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "todolist") }],
      };
    }
  );

  server.registerTool(
    "boond_todolists_get",
    {
      title: "Détails d'une liste de tâches",
      description: `Récupère les informations détaillées d'une todolist par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/todolists/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
