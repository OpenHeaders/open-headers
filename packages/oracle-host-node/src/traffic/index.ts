/**
 * `oracle-host-node/traffic` — the broker tap for the agent traffic
 * epic (AGENT_TRAFFIC_PLAN.md §2): loopback lifeline dialing, the two
 * source connectors, and the armed-source registry. Host-side by
 * design; the retention machinery itself lives host-neutral in
 * `@openheaders/oracle/traffic-retention`.
 */

export {
  installLoopbackLifelineDialer,
  type LoopbackLifelineDialer,
  type LoopbackLifelinePort,
} from './loopback-lifeline';
export {
  connectBrowserTabSource,
  connectProxySource,
  type TrafficBodyAttachedHandler,
  type TrafficSourceConnection,
} from './sources';
export {
  createTrafficTap,
  DEFAULT_TRAFFIC_ARM_TTL_MS,
  MAX_TRAFFIC_REVEAL_TTL_MS,
  TRAFFIC_BODY_PULL_TIMEOUT_MS,
  type TrafficArmOptions,
  type TrafficBodyPullResult,
  type TrafficBodyUnavailableReason,
  type TrafficRecordsOptions,
  type TrafficSourceStatus,
  type TrafficTap,
  type TrafficTapDeps,
} from './tap';
