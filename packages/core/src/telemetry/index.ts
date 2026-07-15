/**
 * `@openheaders/core/telemetry` — anonymous product-analytics vocabulary
 * (typed allowlist), fire-and-forget client, and the host controller
 * that gates it (`TELEMETRY_PLAN.md`). Zero platform deps; hosts inject
 * transport/session/gate seams and drive flush cadence, UI surfaces only
 * call `track()` over the bridge.
 */

export {
  mintTelemetrySessionId,
  PRODUCT_TELEMETRY_ENDPOINT,
  TELEMETRY_MAX_LOG,
  TELEMETRY_MAX_QUEUE,
  TelemetryClient,
  type TelemetryClientDeps,
  type TelemetryDisposition,
  type TelemetryLogEntry,
  type TelemetryTransport,
} from './client';
export {
  createInMemoryProductTelemetrySessionStore,
  oncePerSessionLatchKey,
  ProductTelemetryController,
  type ProductTelemetryControllerDeps,
  type ProductTelemetrySessionStore,
  SESSION_START_LATCH_KEY,
} from './controller';
export {
  parseTelemetryAppVersion,
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
