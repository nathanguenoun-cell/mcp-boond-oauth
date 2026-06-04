import { Redis } from "ioredis";
import { logger } from "./logger.js";

export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
}

class MemoryKVStore implements KVStore {
  private readonly data = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && Date.now() > entry.expiresAt) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.data.set(key, {
      value,
      expiresAt: ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    this.data.delete(key);
  }
}

async function initStore(): Promise<KVStore> {
  const url = process.env["REDIS_URL"];
  if (!url || url.startsWith("${")) {
    logger.debug("No REDIS_URL — using in-memory OAuth state store");
    return new MemoryKVStore();
  }

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      lazyConnect: false,
    });
    await client.ping();
    logger.info("OAuth state persistence: Redis");

    return {
      get: (key) => client.get(key),
      set: async (key, value, ttlSeconds?) => {
        if (ttlSeconds !== undefined) {
          await client.setex(key, ttlSeconds, value);
        } else {
          await client.set(key, value);
        }
      },
      del: async (key) => {
        await client.del(key);
      },
    };
  } catch (err) {
    logger.warn({ err }, "Redis unavailable — falling back to in-memory OAuth state store");
    return new MemoryKVStore();
  }
}

let _storePromise: Promise<KVStore> | null = null;

export function getKVStore(): Promise<KVStore> {
  if (!_storePromise) {
    _storePromise = initStore();
  }
  return _storePromise;
}

/** Reset the store singleton — for tests only. */
export function resetKVStoreForTests(): void {
  _storePromise = null;
}
