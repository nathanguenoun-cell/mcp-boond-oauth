import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { IdSchema } from "../schemas/index.js";
import type { IdInput } from "../schemas/index.js";
import { apiRequestBinary } from "../services/boond-client.js";

export function registerDocumentTools(server: McpServer): void {
  server.registerTool(
    "boond_documents_download",
    {
      title: "Télécharger le contenu d'un document",
      description: `Récupère le contenu binaire d'un document à partir de son identifiant unique.

Args:
  - id (string): Identifiant unique du document

Returns: Fichier binaire encodé en base64 (blob).`,
      inputSchema: IdSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params: IdInput) => {
      const { id } = params;
      const { buffer, mimeType } = await apiRequestBinary(`/documents/${id}`);

      return {
        content: [
          {
            type: "resource" as const,
            resource: {
              uri: `boond://documents/${id}`,
              mimeType,
              blob: buffer.toString("base64"),
            },
          },
        ],
      };
    }
  );
}
