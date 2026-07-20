/**
 * Proxy capture plane TypeScript types — derived from
 * `schemas/proxy-capture.ts` (single source of truth).
 */

import type * as v from 'valibot';
import type { ProxyCaptureSettingsSchema } from '../schemas/proxy-capture';

export type ProxyCaptureSettings = v.InferOutput<typeof ProxyCaptureSettingsSchema>;

/**
 * Live projection of the capture proxy the `oh.daemon.proxy.status` RPC
 * answers with — re-derived per call, never a cached flag. `boundPort`
 * is the port actually listening right now (`null` while stopped);
 * `port` is the persisted preference the next start binds.
 */
export interface ProxyCaptureStatus {
  running: boolean;
  boundPort: number | null;
  port: number;
  scopePatterns: string[];
  /** Whether a decryptable CA is on record — scoped TLS termination
   *  needs it; without it every CONNECT rides an opaque blind tunnel. */
  caPresent: boolean;
  /** Last start/runtime failure, cleared on a successful start. */
  lastError: string | null;
}
