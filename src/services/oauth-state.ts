import { createHash, randomBytes } from "node:crypto";

export interface RegisteredClient {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  clientName: string;
}

export interface PendingAuth {
  clientId: string;
  redirectUri: string;
  clientState: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

export interface StoredAuthCode {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  boondToken: string;
  createdAt: number;
}

export interface StoredAccessToken {
  boondToken: string;
  clientId: string;
  createdAt: number;
}

const registeredClients = new Map<string, RegisteredClient>();
const pendingAuthRequests = new Map<string, PendingAuth>();
const authCodes = new Map<string, StoredAuthCode>();
const accessTokens = new Map<string, StoredAccessToken>();

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function verifyPKCE(verifier: string, challenge: string, method: string): boolean {
  if (method === "S256") {
    const hash = createHash("sha256").update(verifier).digest("base64url");
    return hash === challenge;
  }
  return verifier === challenge;
}

export function registerClient(client: RegisteredClient): void {
  registeredClients.set(client.clientId, client);
}

export function getRegisteredClient(clientId: string): RegisteredClient | undefined {
  return registeredClients.get(clientId);
}

export function storePendingAuth(ourState: string, pending: PendingAuth): void {
  pendingAuthRequests.set(ourState, pending);
}

export function getPendingAuth(ourState: string): PendingAuth | undefined {
  return pendingAuthRequests.get(ourState);
}

export function deletePendingAuth(ourState: string): void {
  pendingAuthRequests.delete(ourState);
}

export function storeAuthCode(code: string, data: StoredAuthCode): void {
  authCodes.set(code, data);
}

export function getAuthCode(code: string): StoredAuthCode | undefined {
  return authCodes.get(code);
}

export function deleteAuthCode(code: string): void {
  authCodes.delete(code);
}

export function storeAccessToken(token: string, data: StoredAccessToken): void {
  accessTokens.set(token, data);
}

export function getAccessToken(token: string): StoredAccessToken | undefined {
  return accessTokens.get(token);
}

// Pre-seed a token pair without the OAuth dance — for integration tests only.
export function seedTokenPairForTesting(ourToken: string, boondToken: string): void {
  accessTokens.set(ourToken, { boondToken, clientId: "_test_", createdAt: Date.now() });
}

const AUTH_CODE_TTL_MS = 10 * 60_000;
const ACCESS_TOKEN_TTL_MS = 24 * 60 * 60_000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [code, data] of authCodes) {
    if (now - data.createdAt > AUTH_CODE_TTL_MS) authCodes.delete(code);
  }
  for (const [token, data] of accessTokens) {
    if (now - data.createdAt > ACCESS_TOKEN_TTL_MS) accessTokens.delete(token);
  }
}, 5 * 60_000);
cleanupTimer.unref?.();
