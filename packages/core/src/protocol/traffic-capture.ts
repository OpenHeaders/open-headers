/**
 * Agent-traffic capture-feedback wire types — the host↔extension frames
 * behind the in-browser capture badge (the agent-traffic plan §4).
 *
 * The host owns the capture truth (the tap's armed-source registry);
 * the extension only RENDERS it — the tab-group reactor badges exactly
 * the tabs whose traffic connected AI agents can currently read. A
 * workbench live view never rides this plane: watching is not capture,
 * and the extension cannot (and must not) infer the difference from
 * stream sessions — the mirror collapses every desktop reader into one
 * wire session per partition.
 *
 * Direction and gating:
 *
 *   - extension → host: {@link TrafficCaptureHelloMessage} announces the
 *     feedback host is up and pulls the current set. Pull-on-boot closes
 *     the cold-service-worker boot race (a revived SW HELLOs before its
 *     frame handlers register) without depending on connect-time push
 *     ordering — the proxy-routing plane's exact posture.
 *   - host → extension: {@link TrafficCaptureStateMessage} carries the
 *     COMPLETE set of this peer's capture-armed tabIds. Full-set pushes
 *     are idempotent and self-healing: the extension replaces, never
 *     folds deltas, so a missed frame can never strand a badge. An empty
 *     set is a real message — it clears the last badge.
 *
 * Capture frames are honored from SAME-DEVICE (loopback) wires only —
 * agents read the LOCAL tap; a remote daemon's word about this
 * browser's tabs can never be right. Claimed and dropped otherwise, the
 * telemetry plane's exact posture.
 */

export const TRAFFIC_CAPTURE_HELLO_TYPE = 'oh.traffic.capture.hello' as const;
export const TRAFFIC_CAPTURE_STATE_TYPE = 'oh.traffic.capture.state' as const;

/** Extension → host: feedback host up on this wire — send the current set. */
export interface TrafficCaptureHelloMessage {
  type: typeof TRAFFIC_CAPTURE_HELLO_TYPE;
}

/**
 * Host → extension: the complete set of this peer's tabs whose traffic
 * is capture-armed (agent-readable) right now. Streaming arms only — a
 * consent-refused watch feeds agents nothing and never badges.
 */
export interface TrafficCaptureStateMessage {
  type: typeof TRAFFIC_CAPTURE_STATE_TYPE;
  tabIds: number[];
}

export type TrafficCaptureWireMessage = TrafficCaptureHelloMessage | TrafficCaptureStateMessage;
