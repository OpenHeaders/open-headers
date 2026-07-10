/**
 * Service-worker registration — installs the offline shell so the tab
 * (or an installed PWA window) opens against its local IDB oracle when
 * the daemon is unreachable. Fire-and-forget: registration never gates
 * the boot, and a failure only costs offline capability.
 */

import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'ServiceWorker';

export function registerServiceWorker(): void {
  // Dev serves source modules, not a built bundle — there is nothing
  // coherent to precache (and a stale worker would shadow the dev
  // server). Insecure contexts can't register workers at all.
  if (!import.meta.env.PROD) return;
  if (!window.isSecureContext) return;
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
    logger.warn(SCOPE, 'registration failed', err);
  });
}
