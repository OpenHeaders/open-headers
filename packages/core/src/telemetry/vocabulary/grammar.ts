/**
 * The shared grammar of the telemetry vocabulary (the telemetry plan §3;
 * the v2 plan §2) — every closed list and coarse bucket that traits,
 * state and events spell their values in. Nothing here is an event;
 * `traits.ts`, `state.ts` and `events.ts` compose these into the
 * envelope. The `string` type never appears as a payload leaf: a value
 * is a picklist member, a boolean or a number, and the guard test walks
 * the whole envelope to keep it so.
 *
 * Growing a list is a deliberate, compile-checked disclosure addition;
 * shrinking one is a disclosure question. The worker validates inbound
 * envelopes against the same schemas, so anything outside them is
 * dropped whole.
 */

import * as v from 'valibot';

/** Schema 3 (the v2 plan §3): the state block rides every envelope. Schema 2 stays accepted from the long-tail fleet. */
export const TELEMETRY_SCHEMA_VERSION = 3 as const;

/** The schema the pre-state fleet still sends; validated and archived like any other, never emitted by a current client. */
export const TELEMETRY_LEGACY_SCHEMA_VERSION = 2 as const;

/**
 * Surfaces where telemetry can ever be on. Daemon, served-web, and MCP are
 * hard-off by law (plan §2) and therefore have no member here.
 */
export const TelemetryHostKindSchema = v.picklist(['desktop', 'extension', 'cli']);

export const TelemetryPlatformSchema = v.picklist(['mac', 'win', 'linux']);

/**
 * The CPU architecture a process runs as — the platform fact's other
 * half (S34, 2026-10-19). `x64-on-arm64` is an x64 build running
 * translated on an arm64 machine (Rosetta, Windows on Arm): the one
 * reading that says whether a native arm64 build is worth shipping and
 * whether people picked the wrong download. Anything outside the two
 * shipped architectures stays unstamped.
 */
export const TelemetryArchSchema = v.picklist(['x64', 'arm64', 'x64-on-arm64']);

export const TelemetryBrowserKindSchema = v.picklist(['chrome', 'firefox', 'edge', 'safari', 'other']);

/**
 * Shipped interface languages — the `@openheaders/i18n` locale registry
 * minus its synthetic pseudo locale, plus `other` for any resolved code
 * outside this list (a catalog that grows before this vocabulary does
 * reports `other`, never a wrong member). Core stays i18n-free, so the
 * list is pinned here and a vocabulary test keeps the two registries in
 * sync — growing it is a deliberate disclosure addition.
 */
export const TelemetryLocaleSchema = v.picklist(['en', 'fr', 'es', 'de', 'zh-CN', 'ja', 'ko', 'ru', 'ro', 'other']);

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
  // S31 popup engagement (2026-09-05): the toolbar surface itself
  // (popup or side panel mounted) and a rule switched from it — the
  // two gestures most store installs make and no other id covered.
  'popup',
  'rule-toggle',
  // S35 (user-signed 2026-10-19): the desktop host counts a browser
  // extension completing the sync handshake against its local server
  // — "is this desktop paired with the extension" — once per session
  // per UTC day through the ordinary feature latch; no new column.
  'extension-paired',
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
  'graphql-schema',
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

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Bucket an install age; a clock that ran backwards reads as day 0, never a failure. */
export function bucketSinceInstall(installedAt: number, now: number): TelemetrySinceInstallBucket {
  const days = Math.floor((now - installedAt) / DAY_MS);
  if (days <= 0) return '0';
  if (days === 1) return '1';
  if (days <= 7) return '2-7';
  if (days <= 30) return '8-30';
  return '31+';
}

/** Bucket an entity count (rules, requests, workspaces) for the state block. */
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
 * How an install keeps its workspaces (S35, user-signed 2026-10-19) —
 * the install-wide MAXIMUM, not a per-workspace fact: `server` when at
 * least one server connection is configured (a daemon or team server
 * — the desktop app's own loopback wire is pairing, never a server),
 * else `git` when at least one workspace is bound to a working tree,
 * else `local`. The demand signal behind it is "does this install use
 * a server at all", so one server anywhere wins. Read at flush time
 * with the rest of the state block; the CLI carries none.
 */
export const TelemetrySyncKindSchema = v.picklist(['local', 'server', 'git']);

/**
 * The UI surfaces whose size `viewport_seen` reports (S35) — the
 * shared UI's own surface vocabulary (`SurfaceMode`) plus the
 * workbench window. The popup is a fixed 800×600 by design; the side
 * panel, the devtools panel and the workbench window are the variable
 * ones.
 */
export const TelemetryViewportSurfaceSchema = v.picklist(['popup', 'sidepanel', 'devpanel', 'workbench']);

/**
 * Coarse viewport floors (S35): a size reports as the largest floor at
 * or below it, so `1280` means "at least 1280 and under 1600" and `0`
 * means "under the first floor". Closed number picklists on the wire
 * — an exact pixel size is inexpressible (a precise viewport is a
 * fingerprinting vector; plan §3).
 */
export const TELEMETRY_VIEWPORT_WIDTH_FLOORS = [0, 360, 480, 640, 800, 1024, 1280, 1600, 1920] as const;
export const TELEMETRY_VIEWPORT_HEIGHT_FLOORS = [0, 400, 600, 800, 1000, 1200] as const;
export const TelemetryViewportWidthSchema = v.picklist([...TELEMETRY_VIEWPORT_WIDTH_FLOORS]);
export const TelemetryViewportHeightSchema = v.picklist([...TELEMETRY_VIEWPORT_HEIGHT_FLOORS]);

/** Floor a CSS-pixel viewport width onto the coarse grammar; anything below the first floor (or not a number) reads 0. */
export function bucketViewportWidth(px: number): TelemetryViewportWidth {
  let bucket: TelemetryViewportWidth = 0;
  for (const floor of TELEMETRY_VIEWPORT_WIDTH_FLOORS) if (px >= floor) bucket = floor;
  return bucket;
}

/** Floor a CSS-pixel viewport height onto the coarse grammar; anything below the first floor (or not a number) reads 0. */
export function bucketViewportHeight(px: number): TelemetryViewportHeight {
  let bucket: TelemetryViewportHeight = 0;
  for (const floor of TELEMETRY_VIEWPORT_HEIGHT_FLOORS) if (px >= floor) bucket = floor;
  return bucket;
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
 * Where a monetization moment happened (S20) — one unified list across
 * `paywall_hit` and the upgrade-CTA pair so the stored column keeps a
 * single meaning: `seat-gate` is the seat-limit refusal, `license-pane`
 * is Settings → License, `grace-banner` is the grace/expired alerts,
 * `service-gate` is the service-account cap refusal (the
 * access-foundation plan decision e).
 */
export const TelemetryMonetizationSurfaceSchema = v.picklist([
  'seat-gate',
  'license-pane',
  'grace-banner',
  'service-gate',
]);

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
  // S17 coverage growth (user-signed 2026-08-13). `dnr-rule-limit`
  // stays accepted from schema-2 clients; a current client reports the
  // cap as `limit_hit { dnr-rules }` (the v2 plan §4).
  'dnr-rule-limit',
  'proxy-start-failed',
  'ca-trust-failed',
  'storage-quota',
  'cdp-attach-failed',
]);

/**
 * The milestones (the v2 plan §4): once per install per kind, each a
 * persisted sent-bit in the install-state tracker. The envelope's
 * `sinceInstall` on the row IS the time-to-milestone distribution.
 */
export const TelemetryMilestoneKindSchema = v.picklist([
  'first_rule_created',
  'first_rule_matched',
  'first_request_sent',
  'first_import',
  'first_workflow_run',
  'first_share_sent',
  'first_share_accepted',
  'first_server_connected',
  'first_mcp_client',
  'first_license',
]);

/** The wire protocol a sent request spoke — the API-client activation signal (the v2 plan §4). */
export const TelemetryRequestProtocolSchema = v.picklist(['http', 'graphql', 'grpc', 'ws', 'sse', 'mqtt']);

/**
 * How a share left this install (the v2 plan §4, fork 4): a server
 * admin's admission with a grant, a workspace owner's own grant, a git
 * working tree, or a workspace export file.
 */
export const TelemetryShareSentRouteSchema = v.picklist(['server-admin', 'server-owner', 'git', 'export']);

/** How a share reached this install: a server's workspace synced down, an IdP-minted grant, a git checkout. */
export const TelemetryShareAcceptedRouteSchema = v.picklist(['server', 'idp', 'git']);

/** The workspace role a share grants — the directory's own three-tier vocabulary, pinned here for the wire. */
export const TelemetryShareRoleSchema = v.picklist(['owner', 'editor', 'viewer']);

/**
 * Which ceiling an install ran into (the v2 plan §4): the free seat
 * cap, the free service-account cap, or the browser's dynamic rule cap.
 */
export const TelemetryLimitKindSchema = v.picklist(['seats', 'service-accounts', 'dnr-rules']);

export const wholeNumber = () => v.pipe(v.number(), v.integer());

/** A coarse MAJOR version on the envelope (S35): a small positive integer, never a build or a dotted string. */
export const majorVersion = () => v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(9999));

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

/**
 * The two non-payload strings on the wire share one pinned alphabet — 32
 * lowercase hex chars — so neither can smuggle text. The session id is
 * minted per process launch, held in memory only, never persisted. The
 * install id is minted at first run, persisted by the host, and deleted
 * whenever the toggle goes off (plan §4, amended 2026-07-16): random,
 * never derived from hardware or identity.
 */
export const TelemetrySessionIdSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/));
export const TelemetryInstallIdSchema = v.pipe(v.string(), v.regex(/^[0-9a-f]{32}$/));

export type TelemetryHostKind = v.InferOutput<typeof TelemetryHostKindSchema>;
export type TelemetryChannelId = v.InferOutput<typeof TelemetryChannelIdSchema>;
export type TelemetrySinceInstallBucket = v.InferOutput<typeof TelemetrySinceInstallBucketSchema>;
export type TelemetryScaleBucket = v.InferOutput<typeof TelemetryScaleBucketSchema>;
export type TelemetrySessionAgeBucket = v.InferOutput<typeof TelemetrySessionAgeBucketSchema>;
export type TelemetryPlatform = v.InferOutput<typeof TelemetryPlatformSchema>;
export type TelemetryArch = v.InferOutput<typeof TelemetryArchSchema>;
export type TelemetryBrowserKind = v.InferOutput<typeof TelemetryBrowserKindSchema>;
export type TelemetryLocale = v.InferOutput<typeof TelemetryLocaleSchema>;
export type TelemetryFeatureId = v.InferOutput<typeof TelemetryFeatureIdSchema>;
export type TelemetryRuleTypeId = v.InferOutput<typeof TelemetryRuleTypeIdSchema>;
export type TelemetryRuleCreatedOrigin = v.InferOutput<typeof TelemetryRuleCreatedOriginSchema>;
export type TelemetryImportSourceId = v.InferOutput<typeof TelemetryImportSourceIdSchema>;
export type TelemetryPlanBucket = v.InferOutput<typeof TelemetryPlanBucketSchema>;
export type TelemetryMonetizationSurface = v.InferOutput<typeof TelemetryMonetizationSurfaceSchema>;
export type TelemetryMcpClient = v.InferOutput<typeof TelemetryMcpClientSchema>;
export type TelemetrySyncKind = v.InferOutput<typeof TelemetrySyncKindSchema>;
export type TelemetryViewportSurface = v.InferOutput<typeof TelemetryViewportSurfaceSchema>;
export type TelemetryViewportWidth = v.InferOutput<typeof TelemetryViewportWidthSchema>;
export type TelemetryViewportHeight = v.InferOutput<typeof TelemetryViewportHeightSchema>;
export type TelemetryUninstallReason = v.InferOutput<typeof TelemetryUninstallReasonSchema>;
export type TelemetryErrorCode = v.InferOutput<typeof TelemetryErrorCodeSchema>;
export type TelemetryAppVersion = v.InferOutput<typeof TelemetryAppVersionSchema>;
export type TelemetryMilestoneKind = v.InferOutput<typeof TelemetryMilestoneKindSchema>;
export type TelemetryRequestProtocol = v.InferOutput<typeof TelemetryRequestProtocolSchema>;
export type TelemetryShareSentRoute = v.InferOutput<typeof TelemetryShareSentRouteSchema>;
export type TelemetryShareAcceptedRoute = v.InferOutput<typeof TelemetryShareAcceptedRouteSchema>;
export type TelemetryShareRole = v.InferOutput<typeof TelemetryShareRoleSchema>;
export type TelemetryLimitKind = v.InferOutput<typeof TelemetryLimitKindSchema>;
