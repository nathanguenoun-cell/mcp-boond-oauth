import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema } from "../schemas/index.js";
import type { IdInput } from "../schemas/index.js";
import { getBaseUrl } from "../services/boond-client.js";

export function registerDocumentTools(server: McpServer): void {
  server.registerTool(
    "boond_documents_download",
    {
      title: "Obtenir le lien de téléchargement d'un document",
      description: `Retourne l'URL authentifiée pour télécharger le contenu d'un document BoondManager.

L'URL retournée est l'endpoint REST direct du document. Elle nécessite un header d'authentification
pour être utilisée (Authorization: Bearer <token> ou X-Jwt-Client-Boondmanager: <jwt>).

Args:
  - id (string): Identifiant unique du document

Returns: URL de téléchargement du document et instructions d'utilisation.`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (params: IdInput) => {
      const { id } = params;
      const url = `${getBaseUrl()}/documents/${id}`;

      return {
        content: [
          {
            type: "text" as const,
            text: `URL de téléchargement du document ${id} :\n${url}\n\nCette URL nécessite un header d'authentification BoondManager pour être utilisée.`,
          },
        ],
      };
    }
  );
}
