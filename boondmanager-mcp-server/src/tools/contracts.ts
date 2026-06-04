import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema } from "../schemas/index.js";
import { apiRequest, formatDetailResponse } from "../services/boond-client.js";
import { buildJsonApiBody } from "./crud-factory.js";
import { z } from "zod";

const ContractCreateSchema = z.object({
  resourceId: z.string().optional().describe("ID de la ressource associée"),
  typeOf: z.string().optional().describe("Type de contrat (CDI, CDD, freelance...)"),
  startDate: z.string().optional().describe("Date de début (YYYY-MM-DD)"),
  endDate: z.string().optional().describe("Date de fin (YYYY-MM-DD)"),
  note: z.string().optional().describe("Notes / commentaires"),
}).strict();

export function registerContractTools(server: McpServer): void {
  server.registerTool(
    "boond_contracts_get",
    {
      title: "Détails d'un contrat",
      description: `Récupère les informations détaillées d'un contrat par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/contracts/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );

  server.registerTool(
    "boond_contracts_create",
    {
      title: "Créer un contrat",
      description: `Crée un nouveau contrat de travail dans BoondManager.`,
      inputSchema: ContractCreateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { resourceId, ...attrs } = params;
      const body = buildJsonApiBody("contract", attrs);
      if (resourceId) {
        (body as Record<string, Record<string, unknown>>).data.relationships = {
          resource: { data: { id: resourceId, type: "resource" } },
        };
      }
      const response = await apiRequest("/contracts", "POST", body);
      const entity = Array.isArray(response.data) ? response.data[0] : response.data;
      return {
        content: [{
          type: "text" as const,
          text: `✅ Contrat créé avec succès.\nID: ${entity?.id}\n\n${formatDetailResponse(response)}`,
        }],
      };
    }
  );
}
