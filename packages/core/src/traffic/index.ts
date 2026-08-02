/**
 * `@openheaders/core/traffic` — public traffic vocabulary for the agent
 * traffic epic (AGENT_TRAFFIC_PLAN.md §2): redacted projection types and
 * the normalized resource-type table. The retained record type is NOT
 * here — it lives inside `@openheaders/oracle/traffic-retention` and
 * never crosses the store boundary.
 */

export type {
  TrafficHeaderProjection,
  TrafficRecordProjection,
  TrafficRetentionStats,
  TrafficSourceKind,
  TrafficSourceProjection,
} from './projection';
export { normalizeTrafficResourceType, type TrafficResourceType } from './resource-type';
