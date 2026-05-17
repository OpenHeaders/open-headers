/**
 * Boot-time wiring: route the DevTools panel's source-map cache through
 * the SW-side fetcher.
 *
 * The panel page can't fetch cross-origin directly (default-src 'self'
 * CSP). The cache exposes `setSourceMapFetcher` so hosts can install
 * their own fetch path — here, an RPC to the SW which carries the
 * extension's host_permissions and is unaffected by panel CSP.
 *
 * Imported once from `apps/extension/src/panel/index.tsx` at panel boot.
 */

import { setSourceMapFetcher } from '@openheaders/ui/panel/host-source-map-fetcher';
import { call } from '@utils/bridge';
import { logger } from '@utils/logger';

logger.info('SourceMapHost', 'installed');

setSourceMapFetcher(async (jsUrl: string): Promise<string | null> => {
  logger.info('SourceMapHost', `RPC → SW for ${jsUrl}`);
  try {
    const res = await call('fetchSourceMapText', { jsUrl });
    logger.info('SourceMapHost', `RPC ← SW for ${jsUrl}: mapText=${res?.mapText ? `${res.mapText.length} bytes` : 'null'}`);
    return res?.mapText ?? null;
  } catch (err) {
    logger.info('SourceMapHost', `RPC ✗ ${jsUrl}: ${(err as Error).message}`);
    return null;
  }
});
