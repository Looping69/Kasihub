// Author: Klaasvaakie ( |╲ )
import * as log from "encore.dev/log";

interface CacheKeyspace<T> {
  get(key: string): Promise<T | undefined>;
  set(key: string, value: T): Promise<void>;
  delete(...keys: string[]): Promise<number>;
}

export async function cacheRead<T>(keyspace: CacheKeyspace<T>, key: string): Promise<T | undefined> {
  try {
    return await keyspace.get(key);
  } catch (error) {
    log.warn(error, "cache read failed", { cacheKey: key });
    return undefined;
  }
}

export async function cacheWrite<T>(keyspace: CacheKeyspace<T>, key: string, value: T): Promise<void> {
  try {
    await keyspace.set(key, value);
  } catch (error) {
    log.warn(error, "cache write failed", { cacheKey: key });
  }
}

export async function cacheDelete<T>(keyspace: CacheKeyspace<T>, key: string): Promise<void> {
  try {
    await keyspace.delete(key);
  } catch (error) {
    log.warn(error, "cache invalidation failed", { cacheKey: key });
  }
}
