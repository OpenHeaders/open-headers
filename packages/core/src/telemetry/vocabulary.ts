/**
 * Telemetry event vocabulary — the typed allowlist of `TELEMETRY_PLAN.md` §3.
 *
 * Every event name and every payload property is a closed union, boolean,
 * or number: the `string` type is structurally banned from event payloads,
 * so the channel is incapable of carrying URLs, hostnames, header names or
 * values, rule contents, file paths, or anything else the product sees.
 * The guard test (`tests/telemetry/no-string-fields.test.ts`) walks these
 * schemas and fails if a `string`-typed payload property ever appears.
 *
 * Growing a union is a deliberate, compile-checked addition; shrinking one
 * is a disclosure question. The telemetry worker reuses these schemas to
 * validate inbound envelopes and drop anything outside the allowlist.
 */

import * as v from 'valibot';

export const TELEMETRY_SCHEMA_VERSION = 1 as const;

/**
 * Surfaces where telemetry can ever be on. Daemon, served-web, and MCP are
 * hard-off by law (plan §2) and therefore have no member here.
 */
export const TelemetryHostKindSchema = v.picklist(['desktop', 'extension', 'cli']);

export const TelemetryPlatformSchema = v.picklist(['mac', 'win', 'linux']);

export const TelemetryBrowserKindSchema = v.picklist(['chrome', 'firefox', 'edge', 'safari', 'other']);

/** Shipped UI locales; grows with the i18n catalog (core stays i18n-free, so the list is pinned here). */
export const TelemetryLocaleSchema = v.picklist(['en']);

/** Fired on the first meaningful use of a surface per session. */
export const TelemetryFeatureIdSchema = v.picklist([
  'traffic-panel',
  'response-panel',
  'console-panel',
  'storage-panel',
  'workflow-editor',
  'request-editor',
  'template-editor',
  'quick-editor',
  'variables',
  'vault',
  'import-hub',
  'workspace-sync',
  'live-sources',
  'devtools-scripts',
]);

/**
 * Mirrors `RuleTypeSchema` (`schemas/rule.ts`) as its own list so a new
 * rule type is also a deliberate disclosure addition here; a vocabulary
 * test pins the two in sync.
 */
export const TelemetryRuleTypeIdSchema = v.picklist([
  'header',
  'redirect',
  'request-body',
  'inject',
  'block',
  'delay',
  'response',
  'query-param',
  'ws',
  'sse',
  'auth',
]);

/** Mirrors `DetectedImportSource['kind']` (`import/detect.ts`); pinned by a type-level check in the tests. */
export const TelemetryImportSourceIdSchema = v.picklist([
  'curl',
  'url',
  'har',
  'postman',
  'postman-backup',
  'insomnia',
  'bruno',
  'workspace',
  'unknown',
]);

/** Typed failure codes only — never messages, never stacks (stacks can embed URLs; plan §3). */
export const TelemetryErrorCodeSchema = v.picklist([
  'ws-connect-failed',
  'sync-push-failed',
  'sync-pull-failed',
  'source-refresh-failed',
  'import-parse-failed',
  'workflow-step-failed',
  'update-check-failed',
]);

const wholeNumber = () => v.pipe(v.number(), v.integer());

/**
 * CalVer (`YYYY.M.PATCH`) decomposed into integers — the version is the one
 * "string-shaped" fact we ship, so it travels as numbers to keep payloads
 * string-free.
 */
export const TelemetryAppVersionSchema = v.strictObject({
  year: wholeNumber(),
  month: wholeNumber(),
  patch: wholeNumber(),
});

/**
 * The closed event union. Objects are strict: an event carrying any
 * property outside the allowlist fails validation and is dropped.
 */
export const TelemetryEventSchema = v.variant('name', [
  v.strictObject({
    name: v.literal('session_start'),
    host: TelemetryHostKindSchema,
    appVersion: TelemetryAppVersionSchema,
    platform: TelemetryPlatformSchema,
    browser: v.optional(TelemetryBrowserKindSchema),
    locale: TelemetryLocaleSchema,
  }),
  v.strictObject({
    name: v.literal('feature_used'),
    feature: TelemetryFeatureIdSchema,
  }),
  v.strictObject({
    name: v.literal('rule_created'),
    ruleType: TelemetryRuleTypeIdSchema,
  }),
  v.strictObject({
    name: v.literal('import_run'),
    source: TelemetryImportSourceIdSchema,
    ok: v.boolean(),
  }),
  v.strictObject({
    name: v.literal('workflow_run'),
    ok: v.boolean(),
  }),
  v.strictObject({
    name: v.literal('error_beacon'),
    code: TelemetryErrorCodeSchema,
  }),
]);

/**
 * The session id is the single non-payload string on the wire; its alphabet
 * is pinned to 32 lowercase hex chars so it cannot smuggle text. Minted per
 * process launch, held in memory only, never persisted (plan §4).
 */
export const TelemetrySessionIdSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/));

/** The batch envelope: exactly `schemaVersion` + `sessionId` + `sentAt` + events, nothing else (plan §3). */
export const TelemetryEnvelopeSchema = v.strictObject({
  schemaVersion: v.literal(TELEMETRY_SCHEMA_VERSION),
  sessionId: TelemetrySessionIdSchema,
  sentAt: wholeNumber(),
  events: v.array(TelemetryEventSchema),
});

export type TelemetryHostKind = v.InferOutput<typeof TelemetryHostKindSchema>;
export type TelemetryPlatform = v.InferOutput<typeof TelemetryPlatformSchema>;
export type TelemetryBrowserKind = v.InferOutput<typeof TelemetryBrowserKindSchema>;
export type TelemetryLocale = v.InferOutput<typeof TelemetryLocaleSchema>;
export type TelemetryFeatureId = v.InferOutput<typeof TelemetryFeatureIdSchema>;
export type TelemetryRuleTypeId = v.InferOutput<typeof TelemetryRuleTypeIdSchema>;
export type TelemetryImportSourceId = v.InferOutput<typeof TelemetryImportSourceIdSchema>;
export type TelemetryErrorCode = v.InferOutput<typeof TelemetryErrorCodeSchema>;
export type TelemetryAppVersion = v.InferOutput<typeof TelemetryAppVersionSchema>;
export type TelemetryEvent = v.InferOutput<typeof TelemetryEventSchema>;
export type TelemetryEnvelope = v.InferOutput<typeof TelemetryEnvelopeSchema>;
