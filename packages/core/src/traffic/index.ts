/**
 * `@openheaders/core/traffic` — public traffic vocabulary for the agent
 * traffic epic (AGENT_TRAFFIC_PLAN.md §2): redacted projection types and
 * the normalized resource-type table. The retained record type is NOT
 * here — it lives inside `@openheaders/oracle/traffic-retention` and
 * never crosses the store boundary.
 */

export {
  DEFAULT_TRAFFIC_CAPTURE_BOUNDS,
  DEFAULT_TRAFFIC_SESSION_RETENTION,
  type TrafficCaptureBounds,
  type TrafficCaptureEndReason,
  type TrafficCaptureSessionProjection,
  type TrafficSessionPlane,
  type TrafficSessionRetention,
} from './capture';
export {
  TRAFFIC_BODY_CAP_CHARS,
  type TrafficBodyProjection,
  type TrafficHeaderProjection,
  type TrafficRecordProjection,
  type TrafficRedirectHopProjection,
  type TrafficRetentionStats,
  type TrafficSourceKind,
  type TrafficSourceProjection,
} from './projection';
export {
  isSensitiveHeaderName,
  isTokenShapedValue,
  redactBodyText,
  redactHeaders,
  redactHeaderValue,
  redactionMarker,
  redactUrl,
} from './redaction';
export { normalizeTrafficResourceType, type TrafficResourceType } from './resource-type';
