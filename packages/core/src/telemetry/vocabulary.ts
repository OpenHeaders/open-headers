/**
 * Telemetry event vocabulary — the typed allowlist of the telemetry plan §3.
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
import type { LicenseSnapshot } from '../licensing/types';

export const TELEMETRY_SCHEMA_VERSION = 2 as const;

/**
 * Surfaces where telemetry can ever be on. Daemon, served-web, and MCP are
 * hard-off by law (plan §2) and therefore have no member here.
 */
export const TelemetryHostKindSchema = v.picklist(['desktop', 'extension', 'cli']);

export const TelemetryPlatformSchema = v.picklist(['mac', 'win', 'linux']);

export const TelemetryBrowserKindSchema = v.picklist(['chrome', 'firefox', 'edge', 'safari', 'other']);

/**
 * Shipped interface languages — the `@openheaders/i18n` locale registry
 * minus its synthetic pseudo locale, plus `other` for any resolved code
 * outside this list (a catalog that grows before this vocabulary does
 * reports `other`, never a wrong member). Core stays i18n-free, so the
 * list is pinned here and a vocabulary test keeps the two registries in
 * sync — growing it is a deliberate disclosure addition.
 */
export const TelemetryLocaleSchema = v.picklist(['en', 'fr', 'es', 'de', 'zh-CN', 'other']);

/** Map a resolved app locale onto the vocabulary; unlisted codes (pseudo, future waves) read as `other`. */
export function toTelemetryLocale(code: string): TelemetryLocale {
  const options: readonly string[] = TelemetryLocaleSchema.options;
  return options.includes(code) ? (code as TelemetryLocale) : 'other';
}

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
  'desktop-download',
  // S17 coverage growth (user-signed 2026-08-13): surfaces shipped
  // since the vocabulary was first cut.
  'git-commit',
  'git-log',
  'terminal',
  'traffic-monitor',
  'activity-feed',
  'keymap',
  'api-specs',
  'response-examples',
  'grpc-client',
  'ws-client',
  'workflow-scripts',
  'whats-new',
  // MCP visibility slice (user-signed 2026-08-13): S17 skipped-on-demand
  // ids whose demand arrived — the embedded MCP surface serving a
  // session (desktop-side observer; the MCP surface itself stays
  // hard-off) and the server admin console tab.
  'mcp-server',
  'server-admin',
]);

/**
 * Which affordance a rule creation originated from — the activation
 * funnel's creation-side split (plan §3, S16). `editor` is every full
 * editor flow (workbench, popup, panel editor tab); `quick-editor` is
 * the in-context quick-create popovers; `empty-state-nudge` is a create
 * initiated from an empty-state affordance. Import-attributed creates
 * stay excluded from `rule_created` entirely.
 */
export const TelemetryRuleCreatedOriginSchema = v.picklist(['editor', 'quick-editor', 'empty-state-nudge']);

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
  'openapi',
  'workspace',
  'unknown',
]);

/**
 * Distribution channels a first run can be attributed to — a static fact
 * of the build/store flavor, never derived from referrers or requests.
 * `dev` is an explicitly-development build (unpackaged desktop, unpacked
 * extension); `unknown` means the fact genuinely could not be read.
 */
export const TelemetryChannelIdSchema = v.picklist([
  'chrome-store',
  'firefox-amo',
  'edge-store',
  'safari-store',
  'github-release',
  'website-download',
  'npm',
  'brew',
  'winget',
  'docker',
  'dev',
  'unknown',
]);

/**
 * Coarse days-since-install, stamped on the envelope at flush time.
 * Buckets, never day counts: precise ages could fingerprint (plan §3).
 */
export const TelemetrySinceInstallBucketSchema = v.picklist(['0', '1', '2-7', '8-30', '31+']);

/**
 * Coarse scale-of-use buckets — exact counts could fingerprint (plan §3).
 * S17 split the top end (`21-100`/`100+`) to separate heavy adopters
 * from the merely-established; S20 split the bottom (`1`/`2-5`) so the
 * single-default-workspace majority separates from real multi-workspace
 * use — the Team-tier demand signal. `1-5` and `21+` stay wire-accepted
 * only for earlier clients and are never emitted by current ones.
 */
export const TelemetryScaleBucketSchema = v.picklist(['0', '1', '2-5', '6-20', '21-100', '100+', '1-5', '21+']);

/**
 * Coarse session-age buckets, stamped on the envelope at flush time
 * (plan §3, S17). `MAX` per session id is the session-duration
 * distribution — no on-quit event needed. Buckets, never minutes:
 * precise ages could fingerprint.
 */
export const TelemetrySessionAgeBucketSchema = v.picklist(['0-9m', '10-59m', '1-8h', '8-24h', '24h+']);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bucket an install age; a clock that ran backwards reads as day 0, never a failure. */
export function bucketSinceInstall(installedAt: number, now: number): TelemetrySinceInstallBucket {
  const days = Math.floor((now - installedAt) / DAY_MS);
  if (days <= 0) return '0';
  if (days === 1) return '1';
  if (days <= 7) return '2-7';
  if (days <= 30) return '8-30';
  return '31+';
}

/** Bucket an entity count (rules, workspaces) for `session_start`. */
export function bucketScale(count: number): TelemetryScaleBucket {
  if (count <= 0) return '0';
  if (count === 1) return '1';
  if (count <= 5) return '2-5';
  if (count <= 20) return '6-20';
  if (count <= 100) return '21-100';
  return '100+';
}

const HOUR_MS = 60 * 60 * 1000;

/** Bucket a session's age at flush time; a clock that ran backwards reads as the youngest bucket, never a failure. */
export function bucketSessionAge(startedAt: number, now: number): TelemetrySessionAgeBucket {
  const elapsed = now - startedAt;
  if (elapsed < 10 * 60 * 1000) return '0-9m';
  if (elapsed < HOUR_MS) return '10-59m';
  if (elapsed < 8 * HOUR_MS) return '1-8h';
  if (elapsed < 24 * HOUR_MS) return '8-24h';
  return '24h+';
}

/**
 * Coarse plan bucket for the monetization funnel (S20, user-signed
 * 2026-08-13) — derivable from the license artifact alone: no license,
 * a `personal-seat` license, or an org license. Enterprise is a
 * purchasing tier, not a software tier, and is deliberately not
 * distinguishable here. Channel separation (plan §1) is absolute:
 * never a license id, key, licensee, or seat count.
 */
export const TelemetryPlanBucketSchema = v.picklist(['free', 'individual', 'team']);

/**
 * The plan a user-initiated license install activated, from the
 * entitlement snapshot the install returned — the ONLY seam
 * `license_activated` may derive from (S20 law: never the license file,
 * never id/key/licensee/seats). Null means nothing activated
 * (`unlicensed`/`invalid`) and no event fires; `free` is never an
 * activation. A `personal-seat` artifact is the Individual plan, any
 * other verified license is an org license (Team; Enterprise is
 * deliberately indistinguishable).
 */
export function activatedPlanFromLicenseSnapshot(snapshot: LicenseSnapshot): TelemetryPlanBucket | null {
  if (snapshot.status === 'unlicensed' || snapshot.status === 'invalid') return null;
  return snapshot.kind === 'personal-seat' ? 'individual' : 'team';
}

/**
 * Where a monetization moment happened (S20) — one unified list across
 * `paywall_hit` and the upgrade-CTA pair so the stored column keeps a
 * single meaning: `seat-gate` is the seat-limit refusal, `license-pane`
 * is Settings → License, `grace-banner` is the grace/expired alerts.
 */
export const TelemetryMonetizationSurfaceSchema = v.picklist(['seat-gate', 'license-pane', 'grace-banner']);

/**
 * AI clients observed on the MCP `initialize` handshake (plan §3, MCP
 * visibility slice, user-signed 2026-08-13) — "which agents do people
 * use". The handshake's `clientInfo.name` is free-form, so it maps
 * through this picklist locale-style: anything unlisted reports
 * `other`, never a raw string.
 */
export const TelemetryMcpClientSchema = v.picklist([
  'claude-code',
  'claude-desktop',
  'cursor',
  'windsurf',
  'vscode',
  'other',
]);

/**
 * Map a free-form MCP `clientInfo.name` onto the vocabulary — keyword
 * containment over the lowercased name, most specific first: VS Code
 * forks announce themselves with `vscode` in the name, so the fork
 * checks run before the `vscode` member catches the rest, and Claude
 * Desktop announces without a `code` token (`claude-ai`).
 */
export function toTelemetryMcpClient(clientName: string): TelemetryMcpClient {
  const name = clientName.toLowerCase();
  if (name.includes('claude')) return name.includes('code') ? 'claude-code' : 'claude-desktop';
  if (name.includes('cursor')) return 'cursor';
  if (name.includes('windsurf')) return 'windsurf';
  if (name.includes('vscode') || name.includes('visual studio code')) return 'vscode';
  return 'other';
}

/**
 * Uninstall micro-survey picklist (S20) — the one optional "why?"
 * answer a departing person can tap on the openheaders.com landing
 * page. No client ever emits it: the value is chosen by the person on
 * the website and accepted only through the worker's picklist gate,
 * with no install id attached.
 */
export const TelemetryUninstallReasonSchema = v.picklist([
  'not-needed',
  'not-working',
  'missing-feature',
  'too-complex',
  'privacy',
  'switching',
  'other',
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
  // S17 coverage growth (user-signed 2026-08-13).
  'dnr-rule-limit',
  'proxy-start-failed',
  'ca-trust-failed',
  'storage-quota',
  'cdp-attach-failed',
]);

const wholeNumber = () => v.pipe(v.number(), v.integer());

/**
 * CalVer (`YYYY.M.PATCH[-beta.N]`) decomposed into integers — the version
 * is the one "string-shaped" fact we ship, so it travels as numbers to
 * keep payloads string-free. `beta` is the pre-release iteration and is
 * absent on stable builds, so the release train (stable vs beta) is
 * readable without a train field of its own.
 */
export const TelemetryAppVersionSchema = v.strictObject({
  year: wholeNumber(),
  month: wholeNumber(),
  patch: wholeNumber(),
  beta: v.optional(wholeNumber()),
});

const PRERELEASE_BETA = /^beta(?:\.(\d+))?$/;

/**
 * Decompose a CalVer version string into the numbers the wire carries.
 * Malformed segments become 0 rather than failing — the version is
 * context, never worth blocking an event over. Only the `-beta.N` tag
 * of the release grammar maps to `beta` (a bare `-beta` reads as
 * iteration 1); any other suffix is ignored.
 */
export function parseTelemetryAppVersion(version: string): TelemetryAppVersion {
  const hyphen = version.indexOf('-');
  const release = hyphen === -1 ? version : version.slice(0, hyphen);
  const prerelease = hyphen === -1 ? '' : version.slice(hyphen + 1);
  const [year = 0, month = 0, patch = 0] = release.split('.').map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isInteger(n) ? n : 0;
  });
  const betaTag = PRERELEASE_BETA.exec(prerelease);
  if (!betaTag) return { year, month, patch };
  return { year, month, patch, beta: betaTag[1] === undefined ? 1 : Number.parseInt(betaTag[1], 10) };
}

/**
 * The closed event union. Objects are strict: an event carrying any
 * property outside the allowlist fails validation and is dropped.
 */
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
  // clients carried them event-level — current clients no longer send
  // them. `rules`/`workspaces` remain event-level: they are measurements
  // taken at session start, not process constants.
  v.strictObject({
    name: v.literal('session_start'),
    host: v.optional(TelemetryHostKindSchema),
    appVersion: v.optional(TelemetryAppVersionSchema),
    platform: v.optional(TelemetryPlatformSchema),
    browser: v.optional(TelemetryBrowserKindSchema),
    locale: v.optional(TelemetryLocaleSchema),
    rules: v.optional(TelemetryScaleBucketSchema),
    workspaces: v.optional(TelemetryScaleBucketSchema),
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
  // Monetization funnel (S20, user-signed 2026-08-13; emitters land
  // S22). Desktop and CLI only by construction — daemon/served-web are
  // hard-off and the extension carries no license plumbing. Fired on
  // user-initiated license installs only: the refresh agent's silent
  // periodic file swaps never emit.
  v.strictObject({
    name: v.literal('license_activated'),
    plan: TelemetryPlanBucketSchema,
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
]);

/**
 * The two non-payload strings on the wire share one pinned alphabet — 32
 * lowercase hex chars — so neither can smuggle text. The session id is
 * minted per process launch, held in memory only, never persisted. The
 * install id is minted at first run, persisted by the host, resettable
 * from settings, and deleted whenever the toggle goes off (plan §4,
 * amended 2026-07-16): random, never derived from hardware or identity.
 */
export const TelemetrySessionIdSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/));
export const TelemetryInstallIdSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/));

/**
 * The batch envelope (plan §3). Per-process facts live on the envelope,
 * not on events, so every event carries the surface, channel, version,
 * platform, browser, locale, and day-bucket without any payload shape
 * widening — Analytics Engine SQL has no joins, so a fact that should
 * segment every stored row must ride the row itself. The fact fields
 * are optional on the wire only for schema-v2 clients built before
 * them (`host` predates the S15 set); every current client stamps all
 * it can — `platform` is omitted where the running platform has no
 * vocabulary member and `browser` exists only on browser-hosted
 * surfaces.
 */
export const TelemetryEnvelopeSchema = v.strictObject({
  schemaVersion: v.literal(TELEMETRY_SCHEMA_VERSION),
  host: v.optional(TelemetryHostKindSchema),
  channel: v.optional(TelemetryChannelIdSchema),
  appVersion: v.optional(TelemetryAppVersionSchema),
  platform: v.optional(TelemetryPlatformSchema),
  browser: v.optional(TelemetryBrowserKindSchema),
  locale: v.optional(TelemetryLocaleSchema),
  sessionId: TelemetrySessionIdSchema,
  installId: TelemetryInstallIdSchema,
  sinceInstall: TelemetrySinceInstallBucketSchema,
  // Coarse age of this session at flush time (S17); optional on the
  // wire only for pre-S17 clients — current clients always stamp it.
  sessionAge: v.optional(TelemetrySessionAgeBucketSchema),
  sentAt: wholeNumber(),
  events: v.array(TelemetryEventSchema),
});

export type TelemetryHostKind = v.InferOutput<typeof TelemetryHostKindSchema>;
export type TelemetryChannelId = v.InferOutput<typeof TelemetryChannelIdSchema>;
export type TelemetrySinceInstallBucket = v.InferOutput<typeof TelemetrySinceInstallBucketSchema>;
export type TelemetryScaleBucket = v.InferOutput<typeof TelemetryScaleBucketSchema>;
export type TelemetrySessionAgeBucket = v.InferOutput<typeof TelemetrySessionAgeBucketSchema>;
export type TelemetryPlatform = v.InferOutput<typeof TelemetryPlatformSchema>;
export type TelemetryBrowserKind = v.InferOutput<typeof TelemetryBrowserKindSchema>;
export type TelemetryLocale = v.InferOutput<typeof TelemetryLocaleSchema>;
export type TelemetryFeatureId = v.InferOutput<typeof TelemetryFeatureIdSchema>;
export type TelemetryRuleTypeId = v.InferOutput<typeof TelemetryRuleTypeIdSchema>;
export type TelemetryRuleCreatedOrigin = v.InferOutput<typeof TelemetryRuleCreatedOriginSchema>;
export type TelemetryImportSourceId = v.InferOutput<typeof TelemetryImportSourceIdSchema>;
export type TelemetryPlanBucket = v.InferOutput<typeof TelemetryPlanBucketSchema>;
export type TelemetryMonetizationSurface = v.InferOutput<typeof TelemetryMonetizationSurfaceSchema>;
export type TelemetryMcpClient = v.InferOutput<typeof TelemetryMcpClientSchema>;
export type TelemetryUninstallReason = v.InferOutput<typeof TelemetryUninstallReasonSchema>;
export type TelemetryErrorCode = v.InferOutput<typeof TelemetryErrorCodeSchema>;
export type TelemetryAppVersion = v.InferOutput<typeof TelemetryAppVersionSchema>;
export type TelemetryEvent = v.InferOutput<typeof TelemetryEventSchema>;
export type TelemetryEnvelope = v.InferOutput<typeof TelemetryEnvelopeSchema>;
