---
name: mcp-oauth-dust
description: >
  Build a multi-user OAuth MCP server deployable on Dust (or any agentic AI platform that supports MCP protocol-level OAuth).
  Use this skill whenever the user wants to: create an MCP server that wraps an external API with OAuth,
  build a multi-tenant MCP for Dust or similar platforms, add OAuth authentication to an MCP server,
  deploy an MCP server on Railway/Render/Fly with Docker, or convert a single-user MCP to multi-user.
  Also trigger when the user mentions "MCP OAuth", "MCP for Dust", "multi-user MCP", "Connect button MCP",
  or wants to wrap any third-party API (Eventbrite, Stripe, HubSpot, Notion, etc.) as an MCP server.
---

# Multi-OAuth MCP Server for Dust

This skill guides you through building a production-ready MCP server that:
- Wraps any third-party API behind OAuth
- Supports multiple users (each authenticates independently)
- Shows a native "Connect" button on Dust (not a URL in chat)
- Deploys on Railway (or similar) with Docker

## Architecture Overview

The server acts as an **OAuth Authorization Server proxy**. It sits between Dust and the target API:

```
Dust ←→ [Your MCP Server (OAuth proxy)] ←→ Target API (e.g., Eventbrite)
```

The flow:
1. Dust connects to your MCP endpoint → gets 401 with `WWW-Authenticate` header
2. Dust reads `/.well-known/oauth-protected-resource` → finds your auth server
3. Dust reads `/.well-known/oauth-authorization-server` → discovers endpoints
4. Dust calls `/register` (Dynamic Client Registration) → gets client_id/secret
5. User clicks "Connect" → Dust redirects to `/authorize` → you redirect to target API OAuth
6. User authorizes → target API redirects to `/auth/callback` → you exchange code for token → redirect back to Dust
7. Dust calls `/token` → exchanges your auth code for your access token
8. All subsequent MCP requests include Bearer token → you map it to the target API token

This is what makes the native "Connect" button work — Dust needs the full MCP protocol-level OAuth, not a custom tool that returns a URL.

## Step-by-Step Implementation

### Step 1: Project Setup

```bash
mkdir my-mcp-server && cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/sdk express cors axios dotenv
npm install -D typescript @types/node @types/express @types/cors
```

`tsconfig.json` — the `module` and `moduleResolution` must be `Node16` for the MCP SDK:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`package.json` must have `"type": "module"` and:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### Step 2: Environment Variables

Create `.env.example`:
```
# Target API OAuth credentials (create an app on the target API's developer portal)
API_CLIENT_ID=your_client_id
API_CLIENT_SECRET=your_client_secret

# Server config
PORT=3000
BASE_URL=http://localhost:3000

# OAuth redirect (must match what you set in the target API's app settings)
OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
```

The user needs to create an OAuth app on the target API's developer portal and get a client_id and client_secret. The redirect URI must be set to `https://<deployed-url>/auth/callback` in the portal.

### Step 3: Core Server Structure

Read `references/server-template.md` for the complete annotated template. The key components are:

1. **OAuth storage (in-memory Maps)** — stores registered clients, pending auth requests, auth codes, and access tokens. Each map links your internal tokens to the target API's tokens. In-memory is fine for most use cases since Dust re-authenticates on server restart.

2. **MCP protocol-level OAuth endpoints** (these give you the native Connect button):
   - `GET /.well-known/oauth-protected-resource` — RFC 9728
   - `GET /.well-known/oauth-authorization-server` — RFC 8414
   - `POST /register` — RFC 7591 Dynamic Client Registration
   - `GET /authorize` — redirects to target API's OAuth
   - `GET /auth/callback` — receives target API's callback, redirects to Dust
   - `POST /token` — exchanges your auth code for your access token

3. **MCP endpoint** — served at both `/` and `/mcp` (Dust connects to base URL `/`)

4. **Tool handlers** — each tool receives a `ToolContext` with the user's target API token

### Step 4: Critical Implementation Details

These are the lessons learned from real deployment — getting these wrong causes hard-to-debug failures.

#### Token Exchange Must Use Form-Encoded Body
Most OAuth APIs expect `application/x-www-form-urlencoded`, NOT JSON. This is a common mistake:

```typescript
// WRONG — sends as query params or JSON
await axios.post(TOKEN_URL, { grant_type: '...', code: '...' });

// CORRECT — form-encoded body
await axios.post(TOKEN_URL, new URLSearchParams({
  grant_type: 'authorization_code',
  client_id: API_CLIENT_ID,
  client_secret: API_CLIENT_SECRET,
  code: code as string,
  redirect_uri: OAUTH_REDIRECT_URI,
}).toString(), {
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
});
```

#### Use Organization-Scoped Endpoints
Many modern APIs (Eventbrite, HubSpot, etc.) have deprecated "legacy" user-scoped endpoints in favor of organization-scoped ones. Newer accounts get 403 on legacy endpoints. Always prefer `/organizations/{orgId}/...` when available:

```typescript
// Pattern: resolve orgId, then use org-scoped endpoints
const endpoint = ctx.orgId
  ? `/organizations/${ctx.orgId}/resources/`
  : '/resources/';  // fallback for legacy accounts
```

Add late-resolution of the orgId — it might not be available at auth time but can be fetched before the first tool call.

#### MCP Endpoint Must Return 401 with WWW-Authenticate
This is what triggers Dust's native Connect button:

```typescript
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  res.status(401)
    .set('WWW-Authenticate',
      `Bearer resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`)
    .json({ error: 'unauthorized' });
  return;
}
```

#### Serve MCP at Both `/` and `/mcp`
Dust connects to the base URL. Some MCP clients use `/mcp`. Serve both:

```typescript
app.all('/mcp', mcpHandler);
app.all('/', mcpHandler);
```

#### Always Redirect Back to Dust After OAuth
Never show debug/error pages in the callback. Always redirect back to Dust, even if user info resolution partially fails. Let the tools handle errors gracefully instead:

```typescript
// In /auth/callback — ALWAYS redirect
const redirectUrl = new URL(pending.redirectUri);
redirectUrl.searchParams.set('code', ourCode);
redirectUrl.searchParams.set('state', pending.state);
res.redirect(redirectUrl.toString());
```

#### PKCE Verification
Dust sends PKCE challenges. Your server must verify them:

```typescript
function verifyPKCE(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method === 'S256') {
    const hash = createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  }
  return codeVerifier === codeChallenge; // 'plain' method
}
```

### Step 5: Dockerfile (Multi-Stage Build)

TypeScript needs to compile during build, but `typescript` is a devDependency. Use a multi-stage Docker build:

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

### Step 6: Deploy on Railway

1. Push to GitHub
2. Create new project on Railway → "Deploy from GitHub repo"
3. Add environment variables:
   - `API_CLIENT_ID` and `API_CLIENT_SECRET` from the target API
   - `BASE_URL` = `https://your-app.up.railway.app`
   - `OAUTH_REDIRECT_URI` = `https://your-app.up.railway.app/auth/callback`
   - `PORT` = `3000`
4. Railway auto-detects the Dockerfile and builds

### Step 7: Configure on Dust

1. Go to Dust → Assistants → MCP Servers → Add custom
2. Enter your Railway URL: `https://your-app.up.railway.app`
3. Dust will discover the OAuth metadata automatically
4. Users see a "Connect" button → click → authenticate with target API → done

### Step 8: Configure on the Target API Portal

Set the redirect URI to `https://your-app.up.railway.app/auth/callback` in the target API's developer portal / app settings.
If the portal asks for an "Application URL", use `https://your-app.up.railway.app`.

## Common Pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| No Connect button on Dust | Missing `.well-known` endpoints or MCP not at `/` | Implement all RFC endpoints, serve MCP at `/` |
| "client_secret required" on token exchange | Params sent as JSON instead of form-encoded | Use `URLSearchParams().toString()` as body |
| 403 on API calls for some users | Using legacy endpoints instead of org-scoped | Use `/organizations/{orgId}/...` endpoints |
| "Error fetching remote server metadata" | MCP endpoint only at `/mcp`, not `/` | Add `app.all('/', mcpHandler)` |
| Token works for creator but not others | Debug page blocking redirect in callback | Always redirect, never show error pages |
| Tools fail after server restart | In-memory tokens lost | Expected — Dust re-authenticates automatically |
| 404 on user-scoped endpoints | User has no organization yet | Add fallback endpoints, suggest creating a resource on the target platform |

## Adapting to Different APIs

When wrapping a new API, the main things that change are:

1. **OAuth URLs** — authorization endpoint, token endpoint (check the API's docs)
2. **Token exchange format** — some APIs use form-encoded, some use JSON, some use Basic auth
3. **User/org resolution** — how to get the user's ID and organization after OAuth
4. **Tool definitions** — the actual CRUD operations the MCP exposes
5. **Endpoint patterns** — org-scoped vs user-scoped vs global

Everything else (the MCP protocol-level OAuth proxy, PKCE, Dynamic Client Registration, transport handling) stays exactly the same.
