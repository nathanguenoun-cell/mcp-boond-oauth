import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DocumentDownloadSchema } from "../schemas/index.js";
import type { DocumentDownloadInput } from "../schemas/index.js";
import { apiRequestBinary } from "../services/boond-client.js";

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "text/plain": ".txt",
};

export function registerDocumentTools(server: McpServer): void {
  server.registerTool(
    "boond_documents_download",
    {
      title: "Télécharger un document dans la conversation Dust",
      description: `Télécharge un document BoondManager et l'attache directement à la conversation Dust via l'API Dust.

Le fichier devient disponible comme pièce jointe dans la conversation, accessible aux agents pour lecture et traitement.

Prérequis : variables d'environnement DUST_API_KEY et DUST_WORKSPACE_ID configurées sur le serveur MCP.

Args:
  - id (string): Identifiant unique du document BoondManager
  - conversationId (string): Identifiant de la conversation Dust (dernier segment de l'URL)

Returns: Confirmation d'upload avec l'identifiant du fichier Dust (sId).`,
      inputSchema: DocumentDownloadSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params: DocumentDownloadInput) => {
      const { id, conversationId } = params;

      const dustApiKey = process.env["DUST_API_KEY"];
      const dustWorkspaceId = process.env["DUST_WORKSPACE_ID"];
      if (!dustApiKey || !dustWorkspaceId) {
        throw new Error(
          "Variables d'environnement manquantes : DUST_API_KEY et DUST_WORKSPACE_ID sont requis pour l'upload Dust."
        );
      }

      // Step 1: fetch binary from BoondManager
      const { buffer, mimeType, filename } = await apiRequestBinary(`/documents/${id}`);
      const ext = MIME_TO_EXT[mimeType.split(";")[0].trim()] ?? ".bin";
      const fileName = filename ?? `document-${id}${ext}`;

      // Step 2: request an upload URL from Dust
      const initRes = await fetch(`https://dust.tt/api/v1/w/${dustWorkspaceId}/files`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${dustApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType: mimeType,
          fileName,
          fileSize: buffer.byteLength,
          useCase: "conversation",
          useCaseMetadata: { conversationId },
        }),
      });

      if (!initRes.ok) {
        const body = await initRes.text().catch(() => "");
        throw new Error(
          `Dust file init échoué (${initRes.status}) — workspace: ${dustWorkspaceId}, clé: ${dustApiKey.slice(0, 8)}…\n${body}`
        );
      }

      const { file } = (await initRes.json()) as { file: { sId: string; uploadUrl: string } };

      // Step 3: upload the binary to the signed URL (multipart/form-data, no auth header)
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
      const uploadRes = await fetch(file.uploadUrl, {
        method: "POST",
        body: form,
      });

      if (!uploadRes.ok) {
        const uploadBody = await uploadRes.text().catch(() => "");
        throw new Error(`Upload du fichier échoué (${uploadRes.status}): ${uploadBody}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Document "${fileName}" uploadé avec succès dans la conversation Dust.\nIdentifiant fichier Dust : ${file.sId}\nLe fichier est maintenant disponible comme pièce jointe dans cette conversation.`,
          },
        ],
      };
    }
  );
}
