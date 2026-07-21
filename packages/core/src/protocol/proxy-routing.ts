/**
 * Proxy scoped-routing wire types — the extension↔daemon control frames
 * that flip browser proxy routing for the capture proxy
 * (OBSERVABILITY_PLAN.md §5.1).
 *
 * The extension never carries traffic: it sets browser proxy CONFIG so
 * the browser's own stack CONNECTs to the local capture port for scoped
 * hosts only — Firefox per-request via `proxy.onRequest`, Chromium via a
 * generated PAC — and everything un-scoped stays DIRECT (keeps h3).
 *
 * Direction and gating:
 *
 *   - extension → host: {@link ProxyRoutingHelloMessage} announces the
 *     routing module is up and pulls the current state. Pull-on-boot
 *     closes the cold-service-worker boot race (a revived SW HELLOs
 *     before its frame handlers register) without depending on
 *     connect-time push ordering.
 *   - host → extension: {@link ProxyRoutingStateMessage} carries the
 *     routing decision, already folded with the proxy's run state —
 *     `enabled` means "route now"; the desktop never pushes an enabled
 *     state without a bound port.
 *   - extension → host: {@link ProxyRoutingAckMessage} reports what
 *     actually applied in this browser, so the desktop surface can show
 *     per-browser routing status (including a proxy-settings conflict
 *     with another extension).
 *
 * Routing frames are honored from SAME-DEVICE (loopback) wires only —
 * the capture port is loopback-bound, so routing a browser at a remote
 * daemon's word can never be right. Frames from off-device wires are
 * claimed and dropped, the telemetry plane's exact posture.
 */

import type { ProxyRoutingMode } from '../types/proxy-capture';

export const PROXY_ROUTING_HELLO_TYPE = 'oh.proxy.routing.hello' as const;
export const PROXY_ROUTING_STATE_TYPE = 'oh.proxy.routing.state' as const;
export const PROXY_ROUTING_ACK_TYPE = 'oh.proxy.routing.ack' as const;

/** Extension → host: routing module up on this wire — send current state. */
export interface ProxyRoutingHelloMessage {
  type: typeof PROXY_ROUTING_HELLO_TYPE;
}

/**
 * Host → extension: the routing decision for this machine's capture
 * proxy. `enabled` is the folded verdict (user toggle AND proxy bound);
 * a disabled push clears any installed browser proxy config. Scope
 * patterns ride along so the browser routes exactly the decrypt scope —
 * one source of truth, pushed on every change.
 */
export interface ProxyRoutingStateMessage {
  type: typeof PROXY_ROUTING_STATE_TYPE;
  enabled: boolean;
  /** The bound capture port; null exactly when `enabled` is false. */
  port: number | null;
  scopePatterns: string[];
}

/** Extension → host: what this browser actually did with the state push. */
export interface ProxyRoutingAckMessage {
  type: typeof PROXY_ROUTING_ACK_TYPE;
  applied: boolean;
  mode: ProxyRoutingMode;
  error?: string;
}

export type ProxyRoutingWireMessage = ProxyRoutingHelloMessage | ProxyRoutingStateMessage | ProxyRoutingAckMessage;
