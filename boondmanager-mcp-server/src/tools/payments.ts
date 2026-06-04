import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PaymentSearchSchema, IdSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";

export function registerPaymentTools(server: McpServer): void {
  // Search payments
  server.registerTool(
    "boond_payments_search",
    {
      title: "Rechercher des paiements",
      description: `Recherche des paiements / règlements dans BoondManager avec filtres par facture, société et période.

Args:
  - keywords (string, optional): Termes de recherche
  - invoiceId, companyId (string, optional): Filtrer par entité liée
  - startDate, endDate (string, optional): Période (YYYY-MM-DD)
  - page, pageSize: Pagination

Returns: Liste des paiements correspondants.`,
      inputSchema: PaymentSearchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const query = buildSearchQuery(params);
      const response = await apiRequest("/payments", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "paiement") }],
      };
    }
  );

  // Get payment details
  server.registerTool(
    "boond_payments_get",
    {
      title: "Détails d'un paiement",
      description: `Récupère les informations détaillées d'un paiement / règlement par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/payments/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );
}
