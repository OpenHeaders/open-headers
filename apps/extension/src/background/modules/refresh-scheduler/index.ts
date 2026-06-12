/**
 * Refresh-scheduler surface for the extension host. The scheduler core
 * (generic class + provider port + key codec) is host-neutral and lives
 * in `@openheaders/oracle/scheduling`; this module re-exports it so the
 * refresh subsystems keep one import path, and contributes the only
 * host-specific piece — the `chrome.alarms` timer adapter
 * (`./alarms-timer`).
 */
export {
  base64UrlDecode,
  base64UrlEncode,
  createKeyCodec,
  DEPENDENCY_JITTER_MS,
  type RefreshJob,
  type RefreshProvider,
  RefreshScheduler,
  type RefreshTimer,
  type WriteTarget,
} from '@openheaders/oracle/scheduling';
export { createAlarmsRefreshTimer } from './alarms-timer';
export {
  __configureRateLimiterForTests,
  __resetRateLimiterForTests,
  inspectRateLimiter,
  type RateLimiterConfig,
  withRefreshRateLimit,
} from './rate-limiter';
