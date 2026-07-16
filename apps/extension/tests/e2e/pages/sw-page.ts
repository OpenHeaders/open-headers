/**
 * Shared surface of the playground's service-worker page
 * (`/src/sw/index.html`) — the `window.ohSw` API the SW-network specs
 * drive via `page.evaluate`. The shape mirrors `playground/src/sw/sw.ts`
 * (the playground stays self-contained, so the type is declared on both
 * sides).
 */

export const SW_PAGE_URL = 'http://127.0.0.1:3000/src/sw/index.html';

export interface SwStatus {
  registered: boolean;
  scope: string | null;
  installing: string | null;
  waiting: string | null;
  active: string | null;
  scriptUrl: string | null;
  controlled: boolean;
  controllerScriptUrl: string | null;
}

export interface SyntheticResult {
  servedBy: string;
  version: string;
  path: string;
}

export interface PrecachedResult {
  body: string;
  fromPrecache: boolean;
}

export interface WorkerFetchResult {
  url: string;
  ok: boolean;
  status?: number;
  bodyLength?: number;
  error?: string;
}

export interface OhSwApi {
  register(version: number): Promise<void>;
  update(): Promise<void>;
  skipWaiting(): Promise<boolean>;
  unregister(): Promise<boolean>;
  status(): Promise<SwStatus>;
  fetchSynthetic(): Promise<SyntheticResult>;
  fetchPrecached(): Promise<PrecachedResult>;
  fetchFromWorker(url: string): Promise<WorkerFetchResult>;
  reset(): Promise<void>;
}

declare global {
  interface Window {
    ohSw: OhSwApi;
  }
}
