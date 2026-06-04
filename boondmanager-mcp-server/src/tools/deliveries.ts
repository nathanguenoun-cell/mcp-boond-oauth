import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DeliverySearchSchema, IdSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerDeliveryTools(server: McpServer): void {
  // Search deliveries
  server.registerTool(
    "boond_deliveries_search",
    {
      title: "Rechercher des livraisons / CRA",
      description: `Recherche des livraisons (comptes rendus d'activité) dans BoondManager avec filtres par projet, société et période.

Args:
  - keywords (string, optional): Termes de recherche
  - projectId, companyId (string, optional): Filtrer par entité liée
  - startDate, endDate (string, optional): Période (YYYY-MM-DD)
  - page, pageSize: Pagination

Returns: Liste des livraisons correspondantes.`,
      inputSchema: DeliverySearchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const query = buildSearchQuery(params);
      const response = await apiRequest("/deliveries-groupments", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "livraison") }],
      };
    }
  );

  // Get delivery details
  server.registerTool(
    "boond_deliveries_get",
    {
      title: "Détails d'une livraison / CRA",
      description: `Récupère les informations détaillées d'une livraison (CRA) par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/deliveries/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
