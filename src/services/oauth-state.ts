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
  /** BoondManager refresh token captured at the callback ("" when Boond issues none). */
  boondRefreshToken: string;
  /** Epoch ms when the BoondManager access token expires (0 = unknown). */
  boondExpiresAt: number;
  createdAt: number;
}

/**
 * BoondManager credential set. A single set is shared (by reference, via
 * `credId`) between the Dust access token and the Dust refresh token that were
 * minted together, so a transparent token refresh updates one place and both
 * handles see the fresh token — no drift.
 *
 * Everything here is in-memory only (same footprint as before — nothing is
 * persisted to disk). A process restart clears it and clients re-authenticate,
 * exactly as today; the win is that an *established* session no longer dies
 * silently when the BoondManager token expires.
 */
export interface BoondCredentials {
  credId: string;
  boondToken: string;
  boondRefreshToken: string;
  boondExpiresAt: number;
  clientId: string;
  createdAt: number;
}

/** Shape returned by `getAccessToken` — joins the token handle with its credentials. */
export interface ResolvedAccessToken {
  credId: string;
  boondToken: string;
  boondRefreshToken: string;
  boondExpiresAt: number;
  clientId: string;
  createdAt: number;
}

interface TokenRef {
  credId: string;
  createdAt: number;
}

const registeredClients = new Map<string, RegisteredClient>();
const pendingAuthRequests = new Map<string, PendingAuth>();
const authCodes = new Map<string, StoredAuthCode>();
const boondCreds = new Map<string, BoondCredentials>();
const accessTokens = new Map<string, TokenRef>();
const refreshTokens = new Map<string, TokenRef>();

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

/** Create a shared BoondManager credential set and return its id. */
export function createCredentials(data: Omit<BoondCredentials, "credId" | "createdAt">): string {
  const credId = generateToken();
  boondCreds.set(credId, { credId, createdAt: Date.now(), ...data });
  return credId;
}

export function getCredentials(credId: string): BoondCredentials | undefined {
  return boondCreds.get(credId);
}

/** Update a credential set in place after a BoondManager token refresh. */
export function updateCredentials(
  credId: string,
  patch: Pick<BoondCredentials, "boondToken" | "boondRefreshToken" | "boondExpiresAt">
): void {
  const existing = boondCreds.get(credId);
  if (!existing) return;
  existing.boondToken = patch.boondToken;
  existing.boondRefreshToken = patch.boondRefreshToken;
  existing.boondExpiresAt = patch.boondExpiresAt;
}

export function storeAccessToken(token: string, credId: string): void {
  accessTokens.set(token, { credId, createdAt: Date.now() });
}

export function getAccessToken(token: string): ResolvedAccessToken | undefined {
  const ref = accessTokens.get(token);
  if (!ref) return undefined;
  const creds = boondCreds.get(ref.credId);
  if (!creds) return undefined;
  return {
    credId: creds.credId,
    boondToken: creds.boondToken,
    boondRefreshToken: creds.boondRefreshToken,
    boondExpiresAt: creds.boondExpiresAt,
    clientId: creds.clientId,
    createdAt: ref.createdAt,
  };
}

export function storeRefreshToken(token: string, credId: string): void {
  refreshTokens.set(token, { credId, createdAt: Date.now() });
}

export function getRefreshToken(token: string): ResolvedAccessToken | undefined {
  const ref = refreshTokens.get(token);
  if (!ref) return undefined;
  const creds = boondCreds.get(ref.credId);
  if (!creds) return undefined;
  return {
    credId: creds.credId,
    boondToken: creds.boondToken,
    boondRefreshToken: creds.boondRefreshToken,
    boondExpiresAt: creds.boondExpiresAt,
    clientId: creds.clientId,
    createdAt: ref.createdAt,
  };
}

export function deleteRefreshToken(token: string): void {
  refreshTokens.delete(token);
}

/** Drop a credential set and every access/refresh handle pointing at it. */
export function revokeCredentials(credId: string): void {
  boondCreds.delete(credId);
  for (const [token, ref] of accessTokens) {
    if (ref.credId === credId) accessTokens.delete(token);
  }
  for (const [token, ref] of refreshTokens) {
    if (ref.credId === credId) refreshTokens.delete(token);
  }
}

// Pre-seed a token pair without the OAuth dance — for integration tests only.
export function seedTokenPairForTesting(ourToken: string, boondToken: string): void {
  const credId = createCredentials({
    boondToken,
    boondRefreshToken: "",
    boondExpiresAt: 0,
    clientId: "_test_",
  });
  accessTokens.set(ourToken, { credId, createdAt: Date.now() });
}

const AUTH_CODE_TTL_MS = 10 * 60_000;
const ACCESS_TOKEN_TTL_MS = 24 * 60 * 60_000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;

/** Remove expired auth codes / tokens and orphaned credential sets. Exported for tests. */
export function sweepExpired(now = Date.now()): void {
  for (const [code, data] of authCodes) {
    if (now - data.createdAt > AUTH_CODE_TTL_MS) authCodes.delete(code);
  }
  for (const [token, ref] of accessTokens) {
    if (now - ref.createdAt > ACCESS_TOKEN_TTL_MS) accessTokens.delete(token);
  }
  for (const [token, ref] of refreshTokens) {
    if (now - ref.createdAt > REFRESH_TOKEN_TTL_MS) refreshTokens.delete(token);
  }
  // Drop credential sets no longer referenced by any live token.
  const referenced = new Set<string>();
  for (const ref of accessTokens.values()) referenced.add(ref.credId);
  for (const ref of refreshTokens.values()) referenced.add(ref.credId);
  for (const credId of boondCreds.keys()) {
    if (!referenced.has(credId)) boondCreds.delete(credId);
  }
}

const cleanupTimer = setInterval(() => sweepExpired(), 5 * 60_000);
cleanupTimer.unref?.();
