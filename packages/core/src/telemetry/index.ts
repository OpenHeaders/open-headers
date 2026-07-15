/**
 * `@openheaders/core/telemetry` — anonymous product-analytics vocabulary
 * (typed allowlist), fire-and-forget client, and the host controller
 * that gates it (`TELEMETRY_PLAN.md`). Zero platform deps; hosts inject
 * transport/session/gate seams and drive flush cadence, UI surfaces only
 * call `track()` over the bridge.
 */

export {
  mintTelemetryInstallId,
  mintTelemetrySessionId,
  PRODUCT_TELEMETRY_ENDPOINT,
  TELEMETRY_MAX_LOG,
  TELEMETRY_MAX_QUEUE,
  TelemetryClient,
  type TelemetryClientDeps,
  type TelemetryDisposition,
  type TelemetryInstallContext,
  type TelemetryLogEntry,
  type TelemetryTransport,
} from './client';
export {
  createInMemoryProductTelemetryInstallStore,
  createInMemoryProductTelemetrySessionStore,
  oncePerSessionLatchKey,
  ProductTelemetryController,
  type ProductTelemetryControllerDeps,
  type ProductTelemetryInstallStore,
  type ProductTelemetrySessionStore,
  SESSION_START_LATCH_KEY,
} from './controller';
export {
  bucketScale,
  bucketSinceInstall,
  parseTelemetryAppVersion,
  TELEMETRY_SCHEMA_VERSION,
  type TelemetryAppVersion,
  TelemetryAppVersionSchema,
  type TelemetryBrowserKind,
  TelemetryBrowserKindSchema,
  type TelemetryChannelId,
  TelemetryChannelIdSchema,
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
  TelemetryInstallIdSchema,
  type TelemetryLocale,
  TelemetryLocaleSchema,
  type TelemetryPlatform,
  TelemetryPlatformSchema,
  type TelemetryRuleTypeId,
  TelemetryRuleTypeIdSchema,
  type TelemetryScaleBucket,
  TelemetryScaleBucketSchema,
  TelemetrySessionIdSchema,
  type TelemetrySinceInstallBucket,
  TelemetrySinceInstallBucketSchema,
} from './vocabulary';
