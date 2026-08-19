/**
 * Presence grouping — turn a flat list of `AwarenessState` into a tree
 * keyed by the natural identity hierarchy (`userId` → `deviceId` →
 * host → instance).
 *
 * "Host" composes `appId` + (when present) `browserContext`. It
 * answers "where does this surface run?":
 *   - browser extension in Chrome     → `extension:chrome`
 *   - browser extension in Firefox    → `extension:firefox`
 *   - openheaders.com web tab in Chrome → `web:chrome`     (future)
 *   - desktop Electron app            → `app:desktop`
 * Naming this level "host" (not "browser") matters once Mode 2+ has
 * desktop and web surfaces coexisting in the same identity tree — a
 * desktop surface is not "a browser bucket."
 *
 * The same UI primitive must scale across every deployment topology
 * the system targets without per-mode forks:
 *
 *   - Mode 1 (single browser, multi-surface — today). Every peer
 *     shares the same undefined `userId` / `deviceId` and one host,
 *     so all upper levels collapse and the popover renders today's
 *     flat list of surfaces.
 *   - Mode 2 (local oracle — solo user, multiple browsers / devices /
 *     apps). Host (and possibly `deviceId`) diverges. Headers surface
 *     only at the levels that actually carry diversity.
 *   - Mode 3 (cloud — team workspace). `userId` diverges. The user
 *     level becomes the outermost grouping; per-user devices / hosts
 *     nest underneath.
 *
 * Architectural rule: every level always renders, even when it
 *   contains a single bucket. The popover is the user's window into
 *   the system's identity model; collapsing levels because they
 *   happen to be uniform today would hide the fact that user /
 *   device / host are independent axes that diverge in Mode 2/3.
 *   A single-bucket header tagged "you" / "this device" / "this
 *   browser" / "this app" reads as progressive disclosure of
 *   capability — readers learn the structure before they meet the
 *   divergence.
 *
 * Pure module, no React. Group labels are structured
 * ({@link PresenceGroupLabel}): the chrome words carry `MessageKey`s,
 * the data parts (user ids, browser brand names, profile names,
 * device-id fragments) ride raw. The renderer (`AwarenessPill`) walks
 * the tree and translates at render with the caller's `t`.
 */

import type { AppKind, AwarenessState, BrowserContext, PresenceIdentity } from '@openheaders/core/protocol';
import type { MessageArgs, MessageKey } from '@openheaders/i18n';

export type PresenceGroupLevel = 'user' | 'device' | 'host';

/** Structured group-header label. `raw` carries pure data (a user id,
 *  a browser brand name + profile composition); `key` carries chrome
 *  words, optionally with raw data riding in `args` holes. */
export type PresenceGroupLabel = { kind: 'raw'; text: string } | { kind: 'key'; key: MessageKey; args?: MessageArgs };

/** Internal grouping node. Either an inner group (`children` set) or a
 *  leaf (`state` set). Leaves are the per-instance `AwarenessState`
 *  rows the popover renders today. */
export type PresenceTreeNode =
  | {
      kind: 'group';
      level: PresenceGroupLevel;
      /** Stable key for React rendering — derived from the level's
       *  identity field (userId / deviceId / browser+profile). */
      groupKey: string;
      /** Structured display label for the group header. */
      label: PresenceGroupLabel;
      /** Whether the group's identity matches the local surface's at
       *  the same level — used to render "(this device)" / "(you)"
       *  hints without needing the renderer to recompute. */
      isLocal: boolean;
      children: PresenceTreeNode[];
    }
  | {
      kind: 'leaf';
      state: AwarenessState;
    };

const USER_BUCKET_FALLBACK = '__no-user__';
const DEVICE_BUCKET_FALLBACK = '__no-device__';
const HOST_BUCKET_FALLBACK = '__no-host__';

/**
 * Build the presence tree.
 *
 * Walks the three identity layers in order; at each layer collects
 * peers into buckets keyed by the layer's identity field. Every level
 * is always materialized — even a single-bucket level renders a
 * header so the popover communicates the full identity hierarchy.
 *
 * `localIdentity` is used only to flag groups whose identity matches
 * the local surface so the renderer can decorate them with hints
 * ("you" / "this device" / "this browser"). Not used for filtering;
 * callers exclude themselves before invoking this function.
 */
export function groupPresence(presence: AwarenessState[], localIdentity: PresenceIdentity): PresenceTreeNode[] {
  if (presence.length === 0) return [];
  return groupAtLevel(presence, 'user', localIdentity);
}

function groupAtLevel(
  states: AwarenessState[],
  level: PresenceGroupLevel,
  localIdentity: PresenceIdentity,
): PresenceTreeNode[] {
  const buckets = bucketByLevel(states, level);
  const nextLevel = nextLevelOf(level);
  const localKey = localKeyForLevel(localIdentity, level);
  return buckets.map((b) => {
    const isLocal = localKey !== null && localKey === b.key;
    const children = nextLevel ? groupAtLevel(b.states, nextLevel, localIdentity) : b.states.map(toLeaf);
    return {
      kind: 'group' as const,
      level,
      groupKey: b.key,
      label: b.label,
      isLocal,
      children,
    };
  });
}

function nextLevelOf(level: PresenceGroupLevel): PresenceGroupLevel | null {
  if (level === 'user') return 'device';
  if (level === 'device') return 'host';
  return null;
}

interface LevelBucket {
  key: string;
  label: PresenceGroupLabel;
  states: AwarenessState[];
}

function bucketByLevel(states: AwarenessState[], level: PresenceGroupLevel): LevelBucket[] {
  const map = new Map<string, LevelBucket>();
  for (const s of states) {
    const { key, label } = identifyLevel(s.identity, level);
    let bucket = map.get(key);
    if (!bucket) {
      bucket = { key, label, states: [] };
      map.set(key, bucket);
    }
    bucket.states.push(s);
  }
  // Stable order: insertion order from the input. Callers that want
  // sorted output sort the input first.
  return [...map.values()];
}

function identifyLevel(
  identity: PresenceIdentity,
  level: PresenceGroupLevel,
): { key: string; label: PresenceGroupLabel } {
  if (level === 'user') {
    const id = identity.userId ?? USER_BUCKET_FALLBACK;
    return {
      key: id,
      label: identity.userId
        ? { kind: 'raw', text: identity.userId }
        : { kind: 'key', key: 'shared.awareness.group.local' },
    };
  }
  if (level === 'device') {
    const id = identity.deviceId ?? DEVICE_BUCKET_FALLBACK;
    return {
      key: id,
      label: identity.deviceId
        ? deviceLabel(identity.deviceId)
        : { kind: 'key', key: 'shared.awareness.group.thisDevice' },
    };
  }
  return identifyHost(identity);
}

/**
 * Host-level bucketing. The host axis composes `appId` + (when
 * present) `browserContext`, so two surfaces in the same browser but
 * different apps (the extension and a future openheaders.com web tab in
 * Chrome) end up in different buckets, and a desktop surface never
 * lands in a "Chrome" bucket inherited from Electron's user-agent.
 */
function identifyHost(identity: PresenceIdentity): { key: string; label: PresenceGroupLabel } {
  const ctx = identity.browserContext;
  if (ctx) {
    if (identity.appId === 'web') {
      return {
        key: `web:${formatBrowserKey(ctx)}`,
        label: { kind: 'key', key: 'shared.awareness.group.browserWeb', args: { browser: formatBrowserLabel(ctx) } },
      };
    }
    return { key: `extension:${formatBrowserKey(ctx)}`, label: { kind: 'raw', text: formatBrowserLabel(ctx) } };
  }
  if (identity.appId === 'desktop') {
    return { key: 'app:desktop', label: { kind: 'key', key: 'shared.awareness.group.desktopApp' } };
  }
  if (identity.appId === 'web') return { key: 'app:web', label: { kind: 'key', key: 'shared.awareness.group.web' } };
  if (identity.appId === 'cli') return { key: 'app:cli', label: { kind: 'key', key: 'shared.awareness.group.cli' } };
  // Extension surface that never picked up its BrowserContext (older
  // test fixtures, or a render before observeContext resolved). The
  // legacy "This browser" label keeps existing UX intact for that
  // narrow case; the bucket key is fallback-only.
  return { key: HOST_BUCKET_FALLBACK, label: { kind: 'key', key: 'shared.awareness.group.thisBrowser' } };
}

function localKeyForLevel(local: PresenceIdentity, level: PresenceGroupLevel): string | null {
  if (level === 'user') return local.userId ?? USER_BUCKET_FALLBACK;
  if (level === 'device') return local.deviceId ?? DEVICE_BUCKET_FALLBACK;
  return identifyHost(local).key;
}

/**
 * Pick the right "this is you" decoration for a local host-level
 * bucket. Used by the popover renderer so the local host tag matches
 * the surface kind the user is actually looking at — "this browser"
 * for an extension surface, "this app" for the desktop window, "this
 * tab" for the future web bundle. Returns the `MessageKey`; the
 * renderer translates.
 */
export function localHostTag(appId: AppKind): MessageKey {
  if (appId === 'extension') return 'shared.awareness.hostTag.thisBrowser';
  if (appId === 'desktop') return 'shared.awareness.hostTag.thisApp';
  if (appId === 'web') return 'shared.awareness.hostTag.thisTab';
  return 'shared.awareness.hostTag.thisSurface';
}

function toLeaf(state: AwarenessState): PresenceTreeNode {
  return { kind: 'leaf', state };
}

function deviceLabel(deviceId: string): PresenceGroupLabel {
  // Short form for display — full deviceId is opaque (uuid-shaped).
  // Truncates to the first 6 chars; renderer can show the full id on
  // hover if needed.
  return { kind: 'key', key: 'shared.awareness.group.device', args: { id: deviceId.slice(0, 6) } };
}

function formatBrowserKey(ctx: BrowserContext): string {
  return ctx.profile ? `${ctx.browser}\x1f${ctx.profile}` : ctx.browser;
}

function formatBrowserLabel(ctx: BrowserContext): string {
  const browser = capitalize(ctx.browser);
  return ctx.profile ? `${browser} (${ctx.profile})` : browser;
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
