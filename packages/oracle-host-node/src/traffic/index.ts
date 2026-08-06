/**
 * `oracle-host-node/traffic` — the broker tap for the agent traffic
 * epic (AGENT_TRAFFIC_PLAN.md §2): loopback lifeline dialing, the
 * partition mirror (§11.2 — the one authoritative store per watched
 * partition), the sessions archive (§11.4 — event-log recorder, CAS
 * blob store, reachability GC), the two source connectors, and the
 * armed-source registry. Host-side by design; the retention machinery
 * itself lives host-neutral in `@openheaders/oracle/traffic-retention`.
 *
 * §11.5 boundary note: the archive's RAW vocabulary (event lines,
 * meta rows, blob refs) stays inside this package — only the factory,
 * the key helpers and the wire-facing projections leave it.
 */

export {
  installLoopbackLifelineDialer,
  type LoopbackLifelineDialer,
  type LoopbackLifelinePort,
} from './loopback-lifeline';
export {
  createTrafficPartitionMirror,
  type TrafficMirrorTapSeat,
  type TrafficPartitionMirror,
  type TrafficPartitionMirrorDeps,
} from './partition-mirror';
export {
  acceptTrafficReplayLifeline,
  installTrafficReplayLifeline,
  type TrafficReplayArchive,
} from './replay-lifeline';
export {
  loadOrCreateSealKeyFile,
  loadOrCreateWrappedSealKey,
  TRAFFIC_SEAL_KEY_FILE_DAEMON,
  TRAFFIC_SEAL_KEY_FILE_DESKTOP,
  TRAFFIC_SEAL_WRAPPED_KEY_FILE,
  TRAFFIC_SESSIONS_DIR_NAME,
  trafficSealKeyConfigSegments,
} from './seal';
export {
  createTrafficSessionArchive,
  projectArchivedSession,
  type TrafficArchivedSessionRow,
  type TrafficArchiveVerbResult,
  type TrafficSessionArchive,
  type TrafficSessionArchiveOptions,
  trafficSessionRetentionFromSettings,
} from './session-archive';
export {
  createTrafficSessionQuery,
  type TrafficSessionBodyGap,
  type TrafficSessionQuery,
  type TrafficSessionQueryDeps,
  type TrafficSessionRecordRead,
  type TrafficSessionRowsRead,
  trafficSessionRawReadsFromSettings,
} from './session-query';
export type { TrafficSessionReplay } from './session-reader';
export {
  connectBrowserTabSource,
  connectProxySource,
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
  type TrafficCaptureStartOptions,
  type TrafficCaptureStartRefusal,
  type TrafficCaptureStartResult,
  type TrafficRecordsOptions,
  type TrafficSourceStatus,
  type TrafficTap,
  type TrafficTapDeps,
  type TrafficWaitMissReason,
  type TrafficWaitOptions,
  type TrafficWaitResult,
} from './tap';
