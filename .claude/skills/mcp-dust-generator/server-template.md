# MCP OAuth Server — Complete Template

This is a fully annotated, production-ready template. Replace all `TARGET_API` references with your actual API.

```typescript
#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import { randomUUID, createHash } from 'crypto';

// =============================================================================
// Configuration — adapt these to your target API
// =============================================================================

const TARGET_API_BASE = 'https://api.example.com/v1';           // Base URL of the API you're wrapping
const TARGET_OAUTH_AUTHORIZE = 'https://example.com/oauth/authorize';  // Where users authorize
const TARGET_OAUTH_TOKEN = 'https://example.com/oauth/token';         // Where you exchange codes

const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const OAUTH_CLIENT_ID = process.env.API_CLIENT_ID || '';
const OAUTH_CLIENT_SECRET = process.env.API_CLIENT_SECRET || '';
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || `${BASE_URL}/auth/callback`;

// =============================================================================
// OAuth Storage (in-memory Maps)
//
// These store the mappings between YOUR tokens and the TARGET API's tokens.
// In-memory is acceptable because:
// - Dust re-authenticates automatically on server restart
// - Each user session lives for the duration of the server process
// - For high-availability, replace with Redis or PostgreSQL
// =============================================================================

/** Registered OAuth clients (from Dynamic Client Registration) */
const registeredClients = new Map<string, {
  clientSecret: string;
  redirectUris: string[];
  clientName?: string;
}>();

/** Pending authorization requests (authId → details) */
const pendingAuth = new Map<string, {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}>();

/** Authorization codes → target API tokens (short-lived, one-time use) */
const authCodes = new Map<string, {
  targetAccessToken: string;
  organizationId?: string;
  userId?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  clientId: string;
  expiresAt: number;
}>();

/** Active access tokens → target API tokens (long-lived) */
const accessTokens = new Map<string, {
  targetAccessToken: string;
  organizationId?: string;
  userId?: string;
}>();

/** MCP session transports */
const transports = new Map<string, StreamableHTTPServerTransport>();

// =============================================================================
// Context passed to all tool handlers
// =============================================================================

interface ToolContext {
  apiToken: string;      // The target API's access token for this user
  orgId?: string;        // Organization ID (if the API uses org-scoping)
  userId?: string;       // User ID on the target API
}

// =============================================================================
// Target API Helper
// =============================================================================

async function makeAPIRequest(
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
) {
  const config: any = {
    method,
    url: `${TARGET_API_BASE}${endpoint}`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };

  if (method === 'GET' && data) {
    config.params = data;
  } else if (data) {
    config.data = data;
  }

  const response = await axios(config);
  return response.data;
}

// =============================================================================
// PKCE Verification
// =============================================================================

function verifyPKCE(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method === 'S256') {
    const hash = createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  }
  return codeVerifier === codeChallenge;
}

// =============================================================================
// Tool Definitions — replace with your API's operations
// =============================================================================

const TOOLS = [
  {
    name: 'list_resources',
    description: 'List resources from the API',
    inputSchema: {
      type: 'object' as const,
      properties: {
        page: { type: 'number' as const, description: 'Page number', default: 1 },
      },
    },
  },
  // Add more tools here...
];

// =============================================================================
// Tool Handlers — implement your API logic here
// =============================================================================

async function handleListResources(ctx: ToolContext, args: any) {
  // Use org-scoped endpoint if available, fallback to legacy
  const endpoint = ctx.orgId
    ? `/organizations/${ctx.orgId}/resources/`
    : '/resources/';

  const response = await makeAPIRequest(ctx.apiToken, 'GET', endpoint, {
    page: args.page || 1,
  });

  return {
    content: [{
      type: 'text' as const,
      text: JSON.stringify(response, null, 2),
    }],
  };
}

// =============================================================================
// MCP Server Factory
//
// Creates a fresh MCP server instance for each session.
// The tool handler extracts the Bearer token from authInfo,
// looks up the corresponding target API token, and passes it
// to the tool handler as ToolContext.
// =============================================================================

function createMCPServer(): Server {
  const server = new Server(
    { name: 'my-mcp-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;

    // Extract Bearer token from MCP auth
    const authInfo = (extra as any)?.authInfo;
    const ourToken = authInfo?.token;

    if (!ourToken) {
      throw new McpError(ErrorCode.InvalidRequest, 'Not authenticated. Please connect your account.');
    }

    const tokenData = accessTokens.get(ourToken);
    if (!tokenData) {
      throw new McpError(ErrorCode.InvalidRequest, 'Invalid or expired token. Please re-authenticate.');
    }

    const ctx: ToolContext = {
      apiToken: tokenData.targetAccessToken,
      orgId: tokenData.organizationId,
      userId: tokenData.userId,
    };
    const safeArgs = args || {};

    try {
      switch (name) {
        case 'list_resources': return await handleListResources(ctx, safeArgs);
        // Add more cases here...
        default: throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) throw error;
      const errMsg = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error executing ${name}: ${errMsg}`);
    }
  });

  return server;
}

// =============================================================================
// Express Server
// =============================================================================

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', activeSessions: transports.size, activeTokens: accessTokens.size });
});

// ---------------------------------------------------------------------------
// OAuth Protected Resource Metadata (RFC 9728)
// Tells the MCP client WHERE to find the authorization server
// ---------------------------------------------------------------------------
app.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: BASE_URL,
    authorization_servers: [BASE_URL],
    bearer_methods_supported: ['header'],
  });
});

// ---------------------------------------------------------------------------
// OAuth Authorization Server Metadata (RFC 8414)
// Tells the MCP client HOW to authenticate
// ---------------------------------------------------------------------------
app.get('/.well-known/oauth-authorization-server', (_req, res) => {
  res.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/authorize`,
    token_endpoint: `${BASE_URL}/token`,
    registration_endpoint: `${BASE_URL}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256', 'plain'],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    scopes_supported: ['default'],
  });
});

// ---------------------------------------------------------------------------
// Dynamic Client Registration (RFC 7591)
// The MCP client (e.g., Dust) registers itself to get a client_id/secret
// ---------------------------------------------------------------------------
app.post('/register', (req, res) => {
  const { redirect_uris, client_name, ...rest } = req.body;

  const clientId = randomUUID();
  const clientSecret = randomUUID();

  registeredClients.set(clientId, {
    clientSecret,
    redirectUris: redirect_uris || [],
    clientName: client_name,
  });

  res.status(201).json({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: redirect_uris || [],
    client_name,
    ...rest,
  });
});

// ---------------------------------------------------------------------------
// Authorization Endpoint
// MCP client redirects user here → we redirect to target API OAuth
// ---------------------------------------------------------------------------
app.get('/authorize', (req, res) => {
  const {
    client_id,
    redirect_uri,
    state,
    code_challenge,
    code_challenge_method = 'S256',
    response_type,
  } = req.query as Record<string, string>;

  if (response_type !== 'code') {
    res.status(400).json({ error: 'unsupported_response_type' });
    return;
  }

  if (!registeredClients.has(client_id)) {
    res.status(400).json({ error: 'invalid_client' });
    return;
  }

  // Store pending auth so we can correlate when the callback comes
  const authId = randomUUID();
  pendingAuth.set(authId, {
    clientId: client_id,
    redirectUri: redirect_uri,
    state,
    codeChallenge: code_challenge || '',
    codeChallengeMethod: code_challenge_method,
  });

  // Redirect to target API OAuth
  // ADAPT THIS: each API has different query params for OAuth
  const targetAuthUrl = `${TARGET_OAUTH_AUTHORIZE}?response_type=code&client_id=${encodeURIComponent(OAUTH_CLIENT_ID)}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&state=${authId}`;

  res.redirect(targetAuthUrl);
});

// ---------------------------------------------------------------------------
// OAuth Callback
// Target API redirects here after user authorizes
// We exchange the code, then redirect back to Dust
// ---------------------------------------------------------------------------
app.get('/auth/callback', async (req, res) => {
  const { code, state: authId, error: oauthError } = req.query;

  if (oauthError) {
    res.status(400).send(`Authorization denied: ${oauthError}`);
    return;
  }

  if (!code || !authId) {
    res.status(400).send('Missing code or state');
    return;
  }

  const pending = pendingAuth.get(authId as string);
  if (!pending) {
    res.status(400).send('Invalid or expired authorization request.');
    return;
  }
  pendingAuth.delete(authId as string);

  try {
    // Exchange target API authorization code for access token
    // ADAPT THIS: some APIs use JSON body, Basic auth, etc.
    const tokenResponse = await axios.post(
      TARGET_OAUTH_TOKEN,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET,
        code: code as string,
        redirect_uri: OAUTH_REDIRECT_URI,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const targetAccessToken = tokenResponse.data.access_token;

    // ADAPT THIS: fetch user info and org ID from the target API
    let userId: string | undefined;
    let organizationId: string | undefined;

    try {
      const meResp = await makeAPIRequest(targetAccessToken, 'GET', '/users/me/');
      userId = meResp.id;
    } catch { /* non-fatal */ }

    try {
      const orgResp = await makeAPIRequest(targetAccessToken, 'GET', '/users/me/organizations/');
      organizationId = orgResp.organizations?.[0]?.id;
    } catch { /* non-fatal */ }

    // Generate our own auth code to send back to the MCP client
    const ourCode = randomUUID();
    authCodes.set(ourCode, {
      targetAccessToken,
      organizationId,
      userId,
      codeChallenge: pending.codeChallenge,
      codeChallengeMethod: pending.codeChallengeMethod,
      clientId: pending.clientId,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // ALWAYS redirect back — never show error/debug pages
    const redirectUrl = new URL(pending.redirectUri);
    redirectUrl.searchParams.set('code', ourCode);
    redirectUrl.searchParams.set('state', pending.state);
    res.redirect(redirectUrl.toString());

  } catch (error: any) {
    console.error('Token exchange failed:', error.response?.data || error.message);
    res.status(500).send('Failed to exchange authorization code.');
  }
});

// ---------------------------------------------------------------------------
// Token Endpoint
// MCP client exchanges our auth code for an access token
// ---------------------------------------------------------------------------
app.post('/token', (req, res) => {
  const { grant_type, code, code_verifier, client_id, client_secret } = req.body;

  if (grant_type !== 'authorization_code') {
    res.status(400).json({ error: 'unsupported_grant_type' });
    return;
  }

  const client = registeredClients.get(client_id);
  if (!client || client.clientSecret !== client_secret) {
    res.status(401).json({ error: 'invalid_client' });
    return;
  }

  const codeData = authCodes.get(code);
  if (!codeData) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Unknown or expired code' });
    return;
  }

  if (codeData.expiresAt < Date.now()) {
    authCodes.delete(code);
    res.status(400).json({ error: 'invalid_grant', error_description: 'Code expired' });
    return;
  }

  if (codeData.clientId !== client_id) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Client mismatch' });
    return;
  }

  // Verify PKCE
  if (codeData.codeChallenge && code_verifier) {
    if (!verifyPKCE(code_verifier, codeData.codeChallenge, codeData.codeChallengeMethod)) {
      res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
      return;
    }
  }

  authCodes.delete(code);

  // Generate our access token mapped to the target API token
  const ourAccessToken = randomUUID();
  accessTokens.set(ourAccessToken, {
    targetAccessToken: codeData.targetAccessToken,
    organizationId: codeData.organizationId,
    userId: codeData.userId,
  });

  res.json({
    access_token: ourAccessToken,
    token_type: 'bearer',
    scope: 'default',
  });
});

// ---------------------------------------------------------------------------
// MCP Streamable HTTP Endpoint
// Served at BOTH / and /mcp — Dust connects to /
// ---------------------------------------------------------------------------
app.all('/mcp', mcpHandler);
app.all('/', mcpHandler);

async function mcpHandler(req: express.Request, res: express.Response) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401)
      .set('WWW-Authenticate', `Bearer resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`)
      .json({ error: 'unauthorized' });
    return;
  }

  const bearerToken = authHeader.substring(7);
  const tokenData = accessTokens.get(bearerToken);

  if (!tokenData) {
    res.status(401)
      .set('WWW-Authenticate', `Bearer error="invalid_token", resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`)
      .json({ error: 'invalid_token' });
    return;
  }

  // Pass auth info to MCP transport so tools can access it
  (req as any).auth = {
    token: bearerToken,
    clientId: '',
    scopes: ['default'],
  };

  const existingSessionId = req.headers['mcp-session-id'] as string | undefined;

  if (req.method === 'POST' && !existingSessionId) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports.set(sessionId, transport);
      },
    });

    const server = createMCPServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  if (existingSessionId) {
    const transport = transports.get(existingSessionId);
    if (transport) {
      await transport.handleRequest(req, res, req.body);
      return;
    }
  }

  res.status(400).json({ error: 'Invalid or missing session.' });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.error(`MCP server running on ${BASE_URL}`);
});
```

## Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## .gitignore

```
node_modules/
dist/
.env
.env.*
!.env.example
```
