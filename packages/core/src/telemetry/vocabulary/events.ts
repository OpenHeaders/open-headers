/**
 * The events (the telemetry plan §3; the v2 plan §4) and the envelope
 * that batches them. Objects are strict: an event carrying any property
 * outside the allowlist fails validation and is dropped whole.
 *
 * Two generations of client speak here. Schema 3 (current) stamps the
 * state block on the envelope and emits the slice-one shapes —
 * `milestone`, `request_sent`, `share_sent`, `share_accepted`,
 * `limit_hit` — beside the shapes it kept. Schema 2 (the long-tail
 * fleet) keeps validating with no state block and its own measured
 * buckets on `session_start`; the warehouse maps its old shapes onto
 * the new rows. Nothing is dual-emitted. The renames (`feature_used` →
 * `tool_used` / `surface_opened` / `cta` / `peer_connected`) are the
 * next slice and keep their shapes here until then.
 */

import * as v from 'valibot';
import {
  TELEMETRY_LEGACY_SCHEMA_VERSION,
  TELEMETRY_SCHEMA_VERSION,
  TelemetryAppVersionSchema,
  TelemetryBrowserKindSchema,
  TelemetryChannelIdSchema,
  TelemetryErrorCodeSchema,
  TelemetryFeatureIdSchema,
  TelemetryHostKindSchema,
  TelemetryImportSourceIdSchema,
  TelemetryLimitKindSchema,
  TelemetryLocaleSchema,
  TelemetryMcpClientSchema,
  TelemetryMilestoneKindSchema,
  TelemetryMonetizationSurfaceSchema,
  TelemetryPlanBucketSchema,
  TelemetryPlatformSchema,
  TelemetryRequestProtocolSchema,
  TelemetryRuleCreatedOriginSchema,
  TelemetryRuleTypeIdSchema,
  TelemetryScaleBucketSchema,
  TelemetryShareAcceptedRouteSchema,
  TelemetryShareRoleSchema,
  TelemetryShareSentRouteSchema,
  TelemetrySyncKindSchema,
  TelemetryViewportHeightSchema,
  TelemetryViewportSurfaceSchema,
  TelemetryViewportWidthSchema,
} from './grammar';
import { TelemetryStateSchema } from './state';
import { TELEMETRY_IDENTITY_ENTRIES, TELEMETRY_TRAIT_ENTRIES } from './traits';

/** The closed event union — every shape both schema generations may carry. */
export const TelemetryEventSchema = v.variant('name', [
  // `channel` lives on the envelope since 2026-08 (S15) — a static
  // install fact stamped on every stored row; it stays accepted here
  // only for clients built when it was event-level.
  v.strictObject({
    name: v.literal('first_run'),
    channel: v.optional(TelemetryChannelIdSchema),
  }),
  // `host` (2026-08-12) and `appVersion`/`platform`/`browser`/`locale`
  // (S15) live on the envelope — per-process facts stamped on every
  // stored row; they stay accepted here only because earlier schema-v2
  // clients carried them event-level. `rules`/`workspaces`/`sync` were
  // the schema-2 measurements taken at session start; schema 3 reads
  // them into the envelope's state block and sends the event bare.
  v.strictObject({
    name: v.literal('session_start'),
    host: v.optional(TelemetryHostKindSchema),
    appVersion: v.optional(TelemetryAppVersionSchema),
    platform: v.optional(TelemetryPlatformSchema),
    browser: v.optional(TelemetryBrowserKindSchema),
    locale: v.optional(TelemetryLocaleSchema),
    rules: v.optional(TelemetryScaleBucketSchema),
    workspaces: v.optional(TelemetryScaleBucketSchema),
    sync: v.optional(TelemetrySyncKindSchema),
  }),
  // Once per install per kind (the v2 plan §4); the tracker's sent-bit
  // is the latch, and the envelope's `sinceInstall` on the row is the
  // time-to-milestone distribution.
  v.strictObject({
    name: v.literal('milestone'),
    kind: TelemetryMilestoneKindSchema,
  }),
  v.strictObject({
    name: v.literal('feature_used'),
    feature: TelemetryFeatureIdSchema,
  }),
  // `origin` is optional on the wire only for pre-S16 clients; current
  // clients always stamp it.
  v.strictObject({
    name: v.literal('rule_created'),
    ruleType: TelemetryRuleTypeIdSchema,
    origin: v.optional(TelemetryRuleCreatedOriginSchema),
  }),
  // A rule of this type demonstrably acted on a request this session —
  // once per session per type (daily re-arm, plan §3). Created ≠ fired:
  // this is the activation funnel's fired side.
  v.strictObject({
    name: v.literal('rule_matched'),
    ruleType: TelemetryRuleTypeIdSchema,
  }),
  // A request left the API client — the activation signal the
  // interceptor's `rule_matched` is for the other half of the product
  // (the v2 plan §4); daily per protocol.
  v.strictObject({
    name: v.literal('request_sent'),
    protocol: TelemetryRequestProtocolSchema,
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
  // A share left this install (the v2 plan §4, fork 4): the route it
  // took, the role it granted, the size of the workspace it opened.
  v.strictObject({
    name: v.literal('share_sent'),
    route: TelemetryShareSentRouteSchema,
    role: TelemetryShareRoleSchema,
    members: TelemetryScaleBucketSchema,
  }),
  // A share reached this install — once per workspace per install,
  // latched locally. The role is optional: a client learns a server's
  // Org at the handshake and its own grant only later, so the row
  // carries the route alone until the WELCOME says more.
  v.strictObject({
    name: v.literal('share_accepted'),
    route: TelemetryShareAcceptedRouteSchema,
    role: v.optional(TelemetryShareRoleSchema),
  }),
  v.strictObject({
    name: v.literal('error_beacon'),
    code: TelemetryErrorCodeSchema,
  }),
  // Monetization funnel (S20, user-signed 2026-08-13; emitters land
  // S22). Desktop and CLI only by construction — daemon/served-web are
  // hard-off and the extension carries no license plumbing. Fired on
  // user-initiated license installs only: the refresh agent's silent
  // periodic file swaps never emit.
  v.strictObject({
    name: v.literal('license_activated'),
    plan: TelemetryPlanBucketSchema,
  }),
  // A ceiling reached (the v2 plan §4): replaces `paywall_hit` and the
  // `dnr-rule-limit` error beacon on current clients; both stay
  // accepted from the schema-2 fleet below.
  v.strictObject({
    name: v.literal('limit_hit'),
    limit: TelemetryLimitKindSchema,
  }),
  v.strictObject({
    name: v.literal('paywall_hit'),
    surface: TelemetryMonetizationSurfaceSchema,
  }),
  v.strictObject({
    name: v.literal('upgrade_cta_shown'),
    surface: TelemetryMonetizationSurfaceSchema,
  }),
  v.strictObject({
    name: v.literal('upgrade_cta_clicked'),
    surface: TelemetryMonetizationSurfaceSchema,
  }),
  // MCP visibility (user-signed 2026-08-13): which AI client completed
  // the MCP `initialize` handshake, once per client per session per UTC
  // day. Desktop-embedded host only by construction — the MCP surface
  // itself stays hard-off (plan §2) and standalone daemons carry no
  // channel; the free-form client name maps through the picklist before
  // it ever becomes an event.
  v.strictObject({
    name: v.literal('mcp_client_connected'),
    client: TelemetryMcpClientSchema,
  }),
  // Viewport size class (S35, user-signed 2026-10-19): which UI
  // surface opened and how big it was, as coarse floors — once per
  // surface per session per UTC day. Width and height are closed
  // number picklists, so an exact size is inexpressible.
  v.strictObject({
    name: v.literal('viewport_seen'),
    surface: TelemetryViewportSurfaceSchema,
    width: TelemetryViewportWidthSchema,
    height: TelemetryViewportHeightSchema,
  }),
]);

/**
 * The batch envelope (plan §3; the v2 plan §3). Per-process facts live
 * on the envelope, not on events, so every event carries the surface,
 * channel, version, platform, browser, locale and day-bucket without
 * any payload shape widening. Schema 3 adds the state block, one
 * snapshot per batch; schema 2 is the same envelope without it.
 */
export const TelemetryLegacyEnvelopeSchema = v.strictObject({
  schemaVersion: v.literal(TELEMETRY_LEGACY_SCHEMA_VERSION),
  ...TELEMETRY_TRAIT_ENTRIES,
  ...TELEMETRY_IDENTITY_ENTRIES,
  events: v.array(TelemetryEventSchema),
});

export const TelemetryCurrentEnvelopeSchema = v.strictObject({
  schemaVersion: v.literal(TELEMETRY_SCHEMA_VERSION),
  ...TELEMETRY_TRAIT_ENTRIES,
  ...TELEMETRY_IDENTITY_ENTRIES,
  state: TelemetryStateSchema,
  events: v.array(TelemetryEventSchema),
});

/** What the worker validates: either generation, by its `schemaVersion`. */
export const TelemetryEnvelopeSchema = v.variant('schemaVersion', [
  TelemetryLegacyEnvelopeSchema,
  TelemetryCurrentEnvelopeSchema,
]);

export type TelemetryEvent = v.InferOutput<typeof TelemetryEventSchema>;
export type TelemetryEventName = TelemetryEvent['name'];
export type TelemetryLegacyEnvelope = v.InferOutput<typeof TelemetryLegacyEnvelopeSchema>;
export type TelemetryCurrentEnvelope = v.InferOutput<typeof TelemetryCurrentEnvelopeSchema>;
export type TelemetryEnvelope = v.InferOutput<typeof TelemetryEnvelopeSchema>;
