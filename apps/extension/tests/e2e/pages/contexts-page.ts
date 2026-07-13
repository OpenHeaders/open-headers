/**
 * Shared surface of the playground's JS contexts page
 * (`/src/contexts/index.html`) — the `window.ohContexts` API the console
 * context specs drive via `page.evaluate`. The shape mirrors
 * `playground/src/contexts/contexts.ts` (the playground stays
 * self-contained, so the type is declared on both sides).
 */

export const CONTEXTS_PAGE_URL = 'http://127.0.0.1:3000/src/contexts/index.html';

export interface ContextsStatus {
  sameFrame: boolean;
  crossFrame: boolean;
  crossOrigin: string;
  worker: boolean;
  swState: string | null;
  controlled: boolean;
  controllerScriptUrl: string | null;
}

export interface OhContextsApi {
  setup(): Promise<ContextsStatus>;
  logPage(tag: string): Promise<string>;
  logSameFrame(tag: string): Promise<string>;
  logCrossFrame(tag: string): Promise<string>;
  logWorker(tag: string): Promise<string>;
  logSw(tag: string): Promise<string>;
  logAll(tag: string): Promise<string[]>;
  status(): Promise<ContextsStatus>;
  teardown(): Promise<void>;
}

declare global {
  interface Window {
    ohContexts: OhContextsApi;
  }
}
