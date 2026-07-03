import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ActionSearchSchema, ActionCreateSchema, IdSchema } from "../schemas/index.js";
import { apiRequest, buildSearchQuery, formatListResponse, formatDetailResponse } from "../services/boond-client.js";
import { buildJsonApiBody } from "./crud-factory.js";

// The `/actions` search endpoint has no `contactId` / `resourceId` / … query
// params. Filtering by a linked entity is done through the `keywords` prefix
// syntax (per the official RAML). Map the tool's friendly ID inputs to the
// prefix the API actually understands, otherwise buildSearchQuery would
// forward them verbatim and the API would silently ignore them, returning the
// full, unfiltered result set.
const ACTION_ENTITY_KEYWORD_PREFIXES = {
  candidateId: "CAND",
  resourceId: "COMP",
  contactId: "CCON",
  companyId: "CSOC",
} as const;

/**
 * Rewrites the entity-ID filters of an actions search into the `keywords`
 * prefix syntax, returning the params to hand to buildSearchQuery. The bogus
 * ID keys are stripped so they are never forwarded to the API.
 */
function normalizeActionSearchParams(params: Record<string, unknown>): Record<string, unknown> {
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!(key in ACTION_ENTITY_KEYWORD_PREFIXES)) rest[key] = value;
  }

  const tokens: string[] = [];
  for (const [key, prefix] of Object.entries(ACTION_ENTITY_KEYWORD_PREFIXES)) {
    const value = params[key];
    if (typeof value === "string" && value.length > 0) tokens.push(`${prefix}${value}`);
  }

  if (tokens.length === 0) return rest;

  const existing = typeof rest.keywords === "string" ? rest.keywords.trim() : "";
  rest.keywords = [existing, ...tokens].filter((t) => t.length > 0).join(" ");
  return rest;
}

export function registerActionTools(server: McpServer): void {
  // Search actions
  server.registerTool(
    "boond_actions_search",
    {
      title: "Rechercher des actions",
      description: `Recherche des actions (appels, emails, RDV, notes) dans BoondManager avec filtres optionnels par candidat, ressource, contact ou société.

Args:
  - keywords (string, optional): Termes de recherche
  - candidateId, resourceId, contactId, companyId (string, optional): Filtrer par entité liée. Traduits automatiquement en préfixes keywords (CAND/COMP/CCON/CSOC), car l'API /actions ne filtre par entité liée que via keywords.
  - page, pageSize: Pagination

Returns: Liste des actions correspondantes.`,
      inputSchema: ActionSearchSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      const query = buildSearchQuery(normalizeActionSearchParams(params));
      const response = await apiRequest("/actions", "GET", undefined, query);
      return {
        content: [{ type: "text" as const, text: formatListResponse(response, "action") }],
      };
    }
  );

  // Get action details
  server.registerTool(
    "boond_actions_get",
    {
      title: "Détails d'une action",
      description: `Récupère les détails d'une action par son ID.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      const response = await apiRequest(`/actions/${params.id}`);
      return {
        content: [{ type: "text" as const, text: formatDetailResponse(response) }],
      };
    }
  );

  // Create action
  server.registerTool(
    "boond_actions_create",
    {
      title: "Créer une action",
      description: `Crée une nouvelle action (appel, email, RDV, note) dans BoondManager, optionnellement liée à un candidat, ressource, contact ou société.`,
      inputSchema: ActionCreateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      const { candidateId, resourceId, contactId, companyId, ...attrs } = params;
      const body = buildJsonApiBody("action", attrs);
      const relationships: Record<string, unknown> = {};
      if (candidateId) relationships.candidate = { data: { id: candidateId, type: "candidate" } };
      if (resourceId) relationships.resource = { data: { id: resourceId, type: "resource" } };
      if (contactId) relationships.contact = { data: { id: contactId, type: "contact" } };
      if (companyId) relationships.company = { data: { id: companyId, type: "company" } };
      if (Object.keys(relationships).length > 0) {
        (body as Record<string, Record<string, unknown>>).data.relationships = relationships;
      }
      const response = await apiRequest("/actions", "POST", body);
      const entity = Array.isArray(response.data) ? response.data[0] : response.data;
      return {
        content: [
          {
            type: "text" as const,
            text: `✅ Action créée avec succès.\nID: ${entity?.id}\n\n${formatDetailResponse(response)}`,
          },
        ],
      };
    }
  );

  // Delete action
  server.registerTool(
    "boond_actions_delete",
    {
      title: "Supprimer une action",
      description: `Supprime une action de BoondManager. ⚠️ Action irréversible.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      await apiRequest(`/actions/${params.id}`, "DELETE");
      return {
        content: [{ type: "text" as const, text: `🗑️ Action #${params.id} supprimée.` }],
      };
    }
  );
}
