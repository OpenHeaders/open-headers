/**
 * Shared surface of the playground's storage matrix page
 * (`/src/storage/index.html`) — the `window.ohStorage` seeding/mutation
 * API the storage-plane specs drive via `page.evaluate`. The shape
 * mirrors `playground/src/storage/storage.ts` (the playground stays
 * self-contained, so the type is declared on both sides).
 */

export const STORAGE_PAGE_URL = 'http://127.0.0.1:3000/src/storage/index.html';

export interface OhStorageApi {
  reset(): Promise<void>;
  seedAll(): Promise<void>;
  seedDom(): Promise<void>;
  seedCookies(): Promise<void>;
  seedIdb(): Promise<void>;
  seedCaches(): Promise<void>;
  mutateDom(key: string, value: string): Promise<void>;
  writeIdb(key: string, value: string): Promise<void>;
  putCache(cache: string, url: string): Promise<void>;
  holdIdbOpen(database: string): Promise<boolean>;
  releaseIdbHold(): Promise<void>;
}

declare global {
  interface Window {
    ohStorage: OhStorageApi;
  }
}
