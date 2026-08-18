/// <reference lib="webworker" />
/**
 * The web app's service worker — the offline shell (Phase 6,
 * the daemon plan §8). Built by the vite plugin in `vite.sw-plugin.ts`,
 * which bundles this entry standalone (classic script, not a module —
 * module service workers are still not universal) and injects the two
 * build-time constants:
 *
 *   - `__OH_SW_CACHE_KEY__` — cache name keyed by the build stamp
 *     (`oh-web-<version>-<commit>`). A redeploy changes the worker's
 *     bytes (the precache list embeds new hashes), the browser installs
 *     the new worker, and `activate` purges every older `oh-web-*`
 *     cache — cache-busting IS the build stamp.
 *   - `__OH_SW_PRECACHE__` — every URL of the built bundle (`/`, hashed
 *     assets, public files). The whole app is precached at install:
 *     assets are content-hashed and served by the local daemon, so
 *     completeness costs one LAN round per file once per build and buys
 *     lazy chunks (Monaco) working offline.
 *
 * Routing policy lives in `fetch-strategy.ts`; see there for why
 * daemon-owned routes are never intercepted.
 */

import { classifyFetch, isDaemonUnreachableStatus } from './fetch-strategy';

declare const self: ServiceWorkerGlobalScope;
declare const __OH_SW_CACHE_KEY__: string;
declare const __OH_SW_PRECACHE__: readonly string[];

const CACHE_PREFIX = 'oh-web-';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(__OH_SW_CACHE_KEY__)
      .then((cache) => cache.addAll([...__OH_SW_PRECACHE__]))
      // A fresh build takes over immediately — pages hold their already
      // -loaded modules; the tiny window where an old page lazy-loads a
      // purged chunk resolves with one reload.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== __OH_SW_CACHE_KEY__)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Network-first entry document: online picks up a redeploy, offline
 * serves the precached shell. "Offline" is a thrown fetch on a direct
 * connection, or a gateway status from a reverse proxy whose daemon
 * upstream is gone — either way the cached shell answers, and with
 * nothing cached yet the network's own outcome stands.
 */
async function serveShell(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (!isDaemonUnreachableStatus(response.status)) return response;
    return (await caches.match('/')) ?? response;
  } catch {
    const cached = await caches.match('/');
    if (cached) return cached;
    return Response.error();
  }
}

/** Cache-first asset: the full bundle is precached; a miss (stale hash mid-redeploy) goes to network. */
async function serveAsset(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;
  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  const decision = classifyFetch(
    { method: event.request.method, url: event.request.url, mode: event.request.mode },
    self.location.origin,
  );
  if (decision === 'bypass') return;
  event.respondWith(decision === 'shell' ? serveShell(event.request) : serveAsset(event.request));
});
