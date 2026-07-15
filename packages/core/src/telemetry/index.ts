/**
 * `@openheaders/core/telemetry` — anonymous product-analytics vocabulary
 * (typed allowlist) + fire-and-forget client (`TELEMETRY_PLAN.md`). Zero
 * platform deps; hosts inject the transport and drive flush cadence, UI
 * surfaces only call `track()`.
 */

export {
  mintTelemetrySessionId,
  TELEMETRY_MAX_LOG,
  TELEMETRY_MAX_QUEUE,
  TelemetryClient,
  type TelemetryClientDeps,
  type TelemetryDisposition,
  type TelemetryLogEntry,
  type TelemetryTransport,
} from './client';
export {
  TELEMETRY_SCHEMA_VERSION,
  type TelemetryAppVersion,
  TelemetryAppVersionSchema,
  type TelemetryBrowserKind,
  TelemetryBrowserKindSchema,
  type TelemetryEnvelope,
  TelemetryEnvelopeSchema,
  type TelemetryErrorCode,
  TelemetryErrorCodeSchema,
  type TelemetryEvent,
  TelemetryEventSchema,
  type TelemetryFeatureId,
  TelemetryFeatureIdSchema,
  type TelemetryHostKind,
  TelemetryHostKindSchema,
  type TelemetryImportSourceId,
  TelemetryImportSourceIdSchema,
  type TelemetryLocale,
  TelemetryLocaleSchema,
  type TelemetryPlatform,
  TelemetryPlatformSchema,
  type TelemetryRuleTypeId,
  TelemetryRuleTypeIdSchema,
  TelemetrySessionIdSchema,
} from './vocabulary';
