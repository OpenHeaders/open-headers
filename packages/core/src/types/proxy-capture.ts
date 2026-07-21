/**
 * Proxy capture plane TypeScript types — derived from
 * `schemas/proxy-capture.ts` (single source of truth).
 */

import type * as v from 'valibot';
import type { ProxyCaptureSettingsSchema } from '../schemas/proxy-capture';

export type ProxyCaptureSettings = v.InferOutput<typeof ProxyCaptureSettingsSchema>;

/** How a browser applies scoped routing — Chromium generated PAC,
 *  Firefox per-request `proxy.onRequest`, or not at all (Safari). */
export type ProxyRoutingMode = 'pac' | 'onRequest' | 'unsupported';

/** One connected browser peer's routing verdict, from its last ack. */
export interface ProxyRoutingPeerState {
  /** The peer's stable qualifier (HELLO `installId`, else `nodeId`). */
  nodeId: string;
  agent: string;
  applied: boolean;
  mode: ProxyRoutingMode;
  error?: string;
}

/**
 * Live projection of scoped browser routing the
 * `oh.daemon.proxy.routing.status` RPC answers with. `enabled` is the
 * persisted user desire; `active` is the folded verdict actually pushed
 * (enabled AND proxy bound); `peers` reflects each connected browser's
 * last ack — absent peers simply haven't answered a push yet.
 */
export interface ProxyRoutingStatus {
  enabled: boolean;
  active: boolean;
  peers: ProxyRoutingPeerState[];
}

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
