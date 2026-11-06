import { AsyncLocalStorage } from 'node:async_hooks';
import { getConnection } from './store';

/** A user's own Apollo / Snov.io keys, made visible to apollo.ts and snov.ts for the rest of the current request. */
export interface UserKeys { apollo?: string; snov?: { id: string; secret: string } }
export const keyStore = new AsyncLocalStorage<UserKeys>();

/** Call once at the top of a route (or job) that does lookups for this user. Falls back to the platform keys when they have none. */
export async function useUserKeys(userId: string): Promise<void> {
  try {
    const [a, s] = await Promise.all([getConnection(userId, 'apollo'), getConnection(userId, 'snov')]);
    const keys: UserKeys = {};
    if (a?.status === 'connected' && a.secrets.apiKey) keys.apollo = a.secrets.apiKey;
    if (s?.status === 'connected' && s.secrets.clientId && s.secrets.clientSecret) keys.snov = { id: s.secrets.clientId, secret: s.secrets.clientSecret };
    keyStore.enterWith(keys);
  } catch { /* table not migrated yet or no secret: platform keys apply */ }
}
