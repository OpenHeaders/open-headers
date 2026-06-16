/**
 * CDP attach-scope vocabulary — which tabs the debugging-protocol control
 * plane pulls into its attached set when the master switch is on.
 *
 * A user preference, shared by the `inspection.cdpScope` setting and the
 * service-worker attach reconciler. The master switch (`inspection.cdpEnabled`)
 * is the orthogonal on/off axis; this only chooses the breadth once on.
 *
 *   - `devtools` — tabs with their DevTools open (default; the original
 *     behaviour). Detaches when DevTools closes.
 *   - `active`   — the current attachable tab, follows focus, no DevTools
 *     needed. Switching to a non-attachable page (new-tab / `chrome://`)
 *     leaves the prior attachment in place rather than thrashing it.
 *   - `both`     — the union of the two.
 *
 * Explicit per-tab pins are an additive overlay on top of whichever mode is
 * selected, not a mode of their own.
 */

import * as v from 'valibot';

export const cdpScopeModeSchema = v.picklist(['devtools', 'active', 'both']);

export type CdpScopeMode = v.InferOutput<typeof cdpScopeModeSchema>;

/**
 * One attached tab in the live CDP roster, carried in the `cdp` Status
 * entry's `context.tabs`. The service worker resolves each attached tab id
 * to its title / URL / window and whether it is explicitly pinned, then
 * ships the list over the existing Status bridge — so the chrome-free
 * footer renders the roster + jump-to-tab without reaching for `chrome.*`.
 */
export const cdpRosterTabSchema = v.object({
  tabId: v.number(),
  windowId: v.number(),
  /** Zero-based position of the tab within its window — rendered 1-based as "Tab #N". */
  index: v.number(),
  title: v.string(),
  url: v.string(),
  pinned: v.boolean(),
});

export type CdpRosterTab = v.InferOutput<typeof cdpRosterTabSchema>;

const cdpRosterSchema = v.array(cdpRosterTabSchema);

/**
 * Read the roster out of a `cdp` Status entry's `context`. Returns `[]` for
 * an absent or malformed list, so a UI surface can render the roster
 * straight from `snapshot.cdp?.context` with no casts and no crash on a
 * stale / partial payload.
 */
export function readCdpRoster(context: Record<string, unknown> | undefined): readonly CdpRosterTab[] {
  if (!context) return [];
  const result = v.safeParse(cdpRosterSchema, context.tabs);
  return result.success ? result.output : [];
}

/**
 * A network-throttle profile carried over the bridge to the service worker's
 * per-tab throttle store (`setNetworkConditions` RPC). Structurally the wire
 * twin of the engine's `CdpNetworkConditions` — kept in core so the chrome-free
 * panel can name the shape without reaching into `@openheaders/oracle`.
 * Throughputs are bytes/second; `-1` disables a cap. `null` over the wire means
 * "no throttle" (lift any active emulation).
 */
export const networkThrottleConditionsSchema = v.object({
  offline: v.boolean(),
  latencyMs: v.number(),
  downloadThroughputBps: v.number(),
  uploadThroughputBps: v.number(),
});

export type NetworkThrottleConditions = v.InferOutput<typeof networkThrottleConditionsSchema>;

/**
 * Validate an untrusted bridge payload into a {@link NetworkThrottleConditions},
 * or `null` for the "no throttle" / unparseable case. The SW handler runs this
 * before storing so a malformed profile can never reach the throttle plane.
 */
export function readNetworkThrottleConditions(raw: unknown): NetworkThrottleConditions | null {
  if (raw == null) return null;
  const result = v.safeParse(networkThrottleConditionsSchema, raw);
  return result.success ? result.output : null;
}

/**
 * Emulated CSS media state — the wire twin of the engine's `CdpEmulatedMedia`.
 * `colorScheme` / `reducedMotion` map to the matching CSS media features;
 * `print` flips the emulated media type. Every facet optional; an absent facet
 * (or `print: false`) leaves that media dimension at its real value.
 */
export const tabEmulatedMediaSchema = v.object({
  colorScheme: v.optional(v.picklist(['light', 'dark'])),
  reducedMotion: v.optional(v.picklist(['reduce', 'no-preference'])),
  print: v.optional(v.boolean()),
});

export type TabEmulatedMedia = v.InferOutput<typeof tabEmulatedMediaSchema>;

/**
 * Tab environment overrides carried over the bridge to the service worker's
 * per-tab overrides store (`setTabOverrides` RPC). Structurally the wire twin of
 * the engine's `CdpEnvironmentOverrides` — kept in core so the chrome-free panel
 * can name the shape without reaching into `@openheaders/oracle`. Every facet is
 * optional; an absent facet leaves the browser default. The UA triple
 * (`userAgent`/`acceptLanguage`/`platform`) is the on-the-wire cluster (F3a); the
 * `Emulation.*` facets (`locale`/`timezoneId`/`emulatedMedia`) are page-only
 * (F3b). `null` over the wire means "no overrides".
 */
export const tabEnvironmentOverridesSchema = v.object({
  userAgent: v.optional(v.string()),
  acceptLanguage: v.optional(v.string()),
  platform: v.optional(v.string()),
  locale: v.optional(v.string()),
  timezoneId: v.optional(v.string()),
  emulatedMedia: v.optional(tabEmulatedMediaSchema),
});

export type TabEnvironmentOverrides = v.InferOutput<typeof tabEnvironmentOverridesSchema>;

/** An emulated-media struct with no pinned facet (or only `print: false`). */
function isEmptyEmulatedMedia(media: TabEmulatedMedia): boolean {
  return media.colorScheme === undefined && media.reducedMotion === undefined && media.print !== true;
}

/**
 * Validate an untrusted bridge payload into a {@link TabEnvironmentOverrides}, or
 * `null` for the "no overrides" / unparseable case, AND for an all-empty bag so a
 * cleared-to-empty payload collapses to `null` rather than pinning an empty
 * override. An `emulatedMedia` struct that holds no pinned facet is dropped
 * first (so a media-only-then-cleared bag also collapses). The SW handler runs
 * this before storing so a malformed bag can never reach the override plane.
 */
export function readTabEnvironmentOverrides(raw: unknown): TabEnvironmentOverrides | null {
  if (raw == null) return null;
  const result = v.safeParse(tabEnvironmentOverridesSchema, raw);
  if (!result.success) return null;
  const { emulatedMedia, ...rest } = result.output;
  const media = emulatedMedia !== undefined && !isEmptyEmulatedMedia(emulatedMedia) ? emulatedMedia : undefined;
  const normalized: TabEnvironmentOverrides = media !== undefined ? { ...rest, emulatedMedia: media } : rest;
  return Object.values(normalized).some((value) => value !== undefined) ? normalized : null;
}

const cdpPinnedTabsSchema = v.array(v.number());

/**
 * Read the explicitly-pinned tab ids out of a `cdp` Status entry's `context`.
 * Carried independently of the attached roster so the "include this tab"
 * control reflects a pin even while inspection is off. Returns `[]` for an
 * absent or malformed payload.
 */
export function readCdpPinnedTabs(context: Record<string, unknown> | undefined): readonly number[] {
  if (!context) return [];
  const result = v.safeParse(cdpPinnedTabsSchema, context.pinnedTabs);
  return result.success ? result.output : [];
}
