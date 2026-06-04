import { createHash, randomBytes } from "node:crypto";
import { getKVStore } from "./kv-store.js";

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

const KEY = {
  client: (id: string) => `boond:client:${id}`,
  pending: (state: string) => `boond:pending:${state}`,
  code: (code: string) => `boond:code:${code}`,
  token: (token: string) => `boond:token:${token}`,
};

const TTL = {
  PENDING_AUTH: 10 * 60,      // 10 min
  AUTH_CODE: 10 * 60,         // 10 min
  ACCESS_TOKEN: 24 * 60 * 60, // 24 h
};

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

export async function registerClient(client: RegisteredClient): Promise<void> {
  const store = await getKVStore();
  await store.set(KEY.client(client.clientId), JSON.stringify(client));
}

export async function getRegisteredClient(clientId: string): Promise<RegisteredClient | undefined> {
  const store = await getKVStore();
  const raw = await store.get(KEY.client(clientId));
  return raw ? (JSON.parse(raw) as RegisteredClient) : undefined;
}

export async function storePendingAuth(ourState: string, pending: PendingAuth): Promise<void> {
  const store = await getKVStore();
  await store.set(KEY.pending(ourState), JSON.stringify(pending), TTL.PENDING_AUTH);
}

export async function getPendingAuth(ourState: string): Promise<PendingAuth | undefined> {
  const store = await getKVStore();
  const raw = await store.get(KEY.pending(ourState));
  return raw ? (JSON.parse(raw) as PendingAuth) : undefined;
}

export async function deletePendingAuth(ourState: string): Promise<void> {
  const store = await getKVStore();
  await store.del(KEY.pending(ourState));
}

export async function storeAuthCode(code: string, data: StoredAuthCode): Promise<void> {
  const store = await getKVStore();
  await store.set(KEY.code(code), JSON.stringify(data), TTL.AUTH_CODE);
}

export async function getAuthCode(code: string): Promise<StoredAuthCode | undefined> {
  const store = await getKVStore();
  const raw = await store.get(KEY.code(code));
  return raw ? (JSON.parse(raw) as StoredAuthCode) : undefined;
}

export async function deleteAuthCode(code: string): Promise<void> {
  const store = await getKVStore();
  await store.del(KEY.code(code));
}

export async function storeAccessToken(token: string, data: StoredAccessToken): Promise<void> {
  const store = await getKVStore();
  await store.set(KEY.token(token), JSON.stringify(data), TTL.ACCESS_TOKEN);
}

export async function getAccessToken(token: string): Promise<StoredAccessToken | undefined> {
  const store = await getKVStore();
  const raw = await store.get(KEY.token(token));
  return raw ? (JSON.parse(raw) as StoredAccessToken) : undefined;
}

// Pre-seed a token pair without the OAuth dance — for integration tests only.
export async function seedTokenPairForTesting(ourToken: string, boondToken: string): Promise<void> {
  await storeAccessToken(ourToken, { boondToken, clientId: "_test_", createdAt: Date.now() });
}
