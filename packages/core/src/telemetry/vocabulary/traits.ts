/**
 * The envelope's per-process facts and identity (the telemetry plan §3,
 * the S15–S35 set unchanged in the v2 plan §3): the surface, the
 * distribution channel, the version, the platform and architecture,
 * the browser, the interface language, the two coarse OS/browser
 * majors, the random ids and the two coarse age buckets. Per-process
 * facts ride the envelope, not the events, so every stored row
 * segments by them without a join.
 *
 * The fact fields are optional on the wire only for clients built
 * before them (`host` predates the S15 set, `arch` the S34 one, the two
 * majors the S35 one); every current client stamps all it can —
 * `platform` and `arch` are omitted where the running platform or
 * architecture has no vocabulary member, `osVersion` where the major
 * cannot be read reliably, and `browser`/`browserVersion` exist only on
 * browser-hosted surfaces.
 */

import * as v from 'valibot';
import {
  majorVersion,
  TelemetryAppVersionSchema,
  TelemetryArchSchema,
  TelemetryBrowserKindSchema,
  TelemetryChannelIdSchema,
  TelemetryHostKindSchema,
  TelemetryInstallIdSchema,
  TelemetryLocaleSchema,
  TelemetryPlatformSchema,
  TelemetrySessionAgeBucketSchema,
  TelemetrySessionIdSchema,
  TelemetrySinceInstallBucketSchema,
  wholeNumber,
} from './grammar';

/** The per-process facts, as the entries of the envelope object. */
export const TELEMETRY_TRAIT_ENTRIES = {
  host: v.optional(TelemetryHostKindSchema),
  channel: v.optional(TelemetryChannelIdSchema),
  appVersion: v.optional(TelemetryAppVersionSchema),
  platform: v.optional(TelemetryPlatformSchema),
  arch: v.optional(TelemetryArchSchema),
  browser: v.optional(TelemetryBrowserKindSchema),
  locale: v.optional(TelemetryLocaleSchema),
  // S35: the OS and browser MAJOR versions as people know them (macOS
  // 15, Windows 11, Chrome 130) — never a build, never a dotted
  // string. Omitted where a host cannot read the major reliably (Linux
  // everywhere; the OS on Firefox and Safari, whose UA strings freeze
  // it); `browserVersion` exists only on browser-hosted surfaces.
  osVersion: v.optional(majorVersion()),
  browserVersion: v.optional(majorVersion()),
} as const;

/** The identity and the two coarse age buckets, as the entries of the envelope object. */
export const TELEMETRY_IDENTITY_ENTRIES = {
  sessionId: TelemetrySessionIdSchema,
  installId: TelemetryInstallIdSchema,
  sinceInstall: TelemetrySinceInstallBucketSchema,
  // Coarse age of this session at flush time (S17); optional on the
  // wire only for pre-S17 clients — current clients always stamp it.
  sessionAge: v.optional(TelemetrySessionAgeBucketSchema),
  sentAt: wholeNumber(),
} as const;

const TelemetryTraitsSchema = v.strictObject(TELEMETRY_TRAIT_ENTRIES);

export type TelemetryTraits = v.InferOutput<typeof TelemetryTraitsSchema>;
