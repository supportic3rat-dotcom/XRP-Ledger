import * as Crypto from 'expo-crypto';

/** One key per user intent (e.g. per review screen), reused on retries so the backend never double-posts. */
export const newIdempotencyKey = (): string => Crypto.randomUUID();
