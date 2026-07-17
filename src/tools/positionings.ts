import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PositioningSearchSchema, PositioningCreateSchema, IdSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";
import { buildJsonApiBody } from "./crud-factory.js";

// The `/positionings` search endpoint has no `opportunityId` / `candidateId` /
// … query params. Filtering by a linked entity is done through the `keywords`
// prefix syntax (per the official RAML). Map the tool's friendly ID inputs to
// the prefix the API actually understands, otherwise buildSearchQuery would
// forward them verbatim and the API would silently ignore them, returning the
// full, unfiltered result set.
const POSITIONING_ENTITY_KEYWORD_PREFIXES = {
  candidateId: "CAND",
  resourceId: "COMP",
  opportunityId: "AO",
} as const;

/**
 * Rewrites the entity-ID filters of a positionings search into the `keywords`
 * prefix syntax, returning the params to hand to buildSearchQuery. The bogus
 * ID keys are stripped so they are never forwarded to the API.
 */
function normalizePositioningSearchParams(params: Record<string, unknown>): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!(key in POSITIONING_ENTITY_KEYWORD_PREFIXES)) rest[key] = value;
  }

  const tokens: string[] = [];
  for (const [key, prefix] of Object.entries(POSITIONING_ENTITY_KEYWORD_PREFIXES)) {
    const value = params[key];
    if (typeof value === "string" && value.length > 0) tokens.push(`${prefix}${value}`);
  }

  if (tokens.length === 0) return rest;

  const existing = typeof rest.keywords === "string" ? rest.keywords.trim() : "";
  rest.keywords = [existing, ...tokens].filter((t) => t.length > 0).join(" ");
  return rest;
}

export function registerPositioningTools(server: McpServer): void {
  // Search positionings
  server.registerTool(
    "boond_positionings_search",
    {
      title: "Rechercher des positionnements",
      description: `Recherche des positionnements (placement de candidats/ressources sur des projets/opportunités) dans BoondManager.

Args:
  - keywords (string, optional): Termes de recherche
  - candidateId, resourceId, opportunityId (string, optional): Filtrer par entité liée. Traduits automatiquement en préfixes keywords (CAND/COMP/AO), car l'API /positionings ne filtre par entité liée que via keywords.
  - page, pageSize: Pagination

Returns: Liste des positionnements correspondants.`,
      inputSchema: PositioningSearchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const query = buildSearchQuery(normalizePositioningSearchParams(params));
      const response = await apiRequest("/positionings", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "positionnement") }],
      };
    }
  );

  // Get positioning details
  server.registerTool(
    "boond_positionings_get",
    {
      title: "Détails d'un positionnement",
      description: `Récupère les informations détaillées d'un positionnement par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/positionings/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );

  // Create positioning
  server.registerTool(
    "boond_positionings_create",
    {
      title: "Créer un positionnement",
      description: `Crée un nouveau positionnement pour placer un candidat ou une ressource sur un projet ou une opportunité.`,
      inputSchema: PositioningCreateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { candidateId, resourceId, projectId, opportunityId, ...attrs } = params;
      const body = buildJsonApiBody("positioning", attrs);
      const relationships: Record<string, unknown> = {};
      if (candidateId) relationships.candidate = { data: { id: candidateId, type: "candidate" } };
      if (resourceId) relationships.resource = { data: { id: resourceId, type: "resource" } };
      if (projectId) relationships.project = { data: { id: projectId, type: "project" } };
      if (opportunityId) relationships.opportunity = { data: { id: opportunityId, type: "opportunity" } };
      if (Object.keys(relationships).length > 0) {
        (body as Record<string, Record<string, unknown>>).data.relationships = relationships;
      }
      const response = await apiRequest("/positionings", "POST", body);
      const entity = Array.isArray(response.data) ? response.data[0] : response.data;
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Positionnement créé avec succès.\nID: ${entity?.id}\n\n${formatDetailResponse(response)}`,
          },
        ],
      };
    }
  );

  // Delete positioning
  server.registerTool(
    "boond_positionings_delete",
    {
      title: "Supprimer un positionnement",
      description: `Supprime un positionnement de BoondManager. ⚠️ Action irréversible.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      await apiRequest(`/positionings/${params.id}`, "DELETE");
      return {
        content: [{ type: "text" as const, text: `🗑️ Positionnement #${params.id} supprimé.` }],
      };
    }
  );
}
