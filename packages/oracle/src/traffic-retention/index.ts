/**
 * `@openheaders/oracle/traffic-retention` — bounded per-source retention
 * for the agent traffic epic (AGENT_TRAFFIC_PLAN.md §3, slice S1).
 *
 * Deliberately host-neutral (this package, not `oracle-host-node`): the
 * browser-extension host will eventually want the same ring for its own
 * surfaces, and the split must stay a folder move.
 *
 * The retained record type (`./record`) is NOT exported — everything
 * past this boundary is a `@openheaders/core/traffic` projection. That
 * omission is load-bearing (the projection-layer redaction law); do not
 * "complete" this surface by re-exporting it.
 */

export { projectPulledBody } from './body';
export { TrafficRetentionConsumer, type TrafficRetentionConsumerOptions } from './consumer';
export { DEFAULT_TRAFFIC_RETENTION_BOUNDS, type TrafficRetentionBounds, TrafficRetentionRing } from './store';
