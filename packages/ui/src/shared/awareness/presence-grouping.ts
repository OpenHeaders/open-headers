/**
 * Presence grouping — turn a flat list of `AwarenessState` into a tree
 * keyed by the natural identity hierarchy (`userId` → `deviceId` →
 * `browserContext` → instance).
 *
 * The same UI primitive must scale across every deployment topology
 * the system targets without per-mode forks:
 *
 *   - Mode 1 (single browser, multi-surface — today). Every peer
 *     shares the same undefined `userId` / `deviceId` / `browserContext`,
 *     so all upper levels collapse and the popover renders today's
 *     flat list of surfaces.
 *   - Mode 2 (local oracle — solo user, multiple browsers / devices).
 *     `browserContext` (and possibly `deviceId`) diverges. Headers
 *     surface only at the levels that actually carry diversity.
 *   - Mode 3 (cloud — team workspace). `userId` diverges. The user
 *     level becomes the outermost grouping; per-user devices /
 *     browsers nest underneath.
 *
 * Architectural rule: every level always renders, even when it
 *   contains a single bucket. The popover is the user's window into
 *   the system's identity model; collapsing levels because they
 *   happen to be uniform today would hide the fact that user /
 *   device / browser are independent axes that diverge in Mode 2/3.
 *   A single-bucket header tagged "you" / "this device" / "this
 *   browser" reads as progressive disclosure of capability — readers
 *   learn the structure before they meet the divergence.
 *
 * Pure module, no React. The renderer (`AwarenessPill`) walks the
 * tree and decides indentation / labels.
 */

import type { AwarenessState, BrowserContext, PresenceIdentity } from '@openheaders/core/protocol';

export type PresenceGroupLevel = 'user' | 'device' | 'browser';

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
      /** Display label for the group header. */
      label: string;
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
const BROWSER_BUCKET_FALLBACK = '__no-browser__';

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
export function groupPresence(
  presence: AwarenessState[],
  localIdentity: PresenceIdentity,
): PresenceTreeNode[] {
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
    const children = nextLevel
      ? groupAtLevel(b.states, nextLevel, localIdentity)
      : b.states.map(toLeaf);
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
  if (level === 'device') return 'browser';
  return null;
}

interface LevelBucket {
  key: string;
  label: string;
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
): { key: string; label: string } {
  if (level === 'user') {
    const id = identity.userId ?? USER_BUCKET_FALLBACK;
    return { key: id, label: identity.userId ?? 'Local' };
  }
  if (level === 'device') {
    const id = identity.deviceId ?? DEVICE_BUCKET_FALLBACK;
    return { key: id, label: identity.deviceId ? formatDeviceLabel(identity.deviceId) : 'This device' };
  }
  // browser
  const ctx = identity.browserContext;
  if (!ctx) return { key: BROWSER_BUCKET_FALLBACK, label: 'This browser' };
  return { key: formatBrowserKey(ctx), label: formatBrowserLabel(ctx) };
}

function localKeyForLevel(local: PresenceIdentity, level: PresenceGroupLevel): string | null {
  if (level === 'user') return local.userId ?? USER_BUCKET_FALLBACK;
  if (level === 'device') return local.deviceId ?? DEVICE_BUCKET_FALLBACK;
  if (!local.browserContext) return BROWSER_BUCKET_FALLBACK;
  return formatBrowserKey(local.browserContext);
}

function toLeaf(state: AwarenessState): PresenceTreeNode {
  return { kind: 'leaf', state };
}

function formatDeviceLabel(deviceId: string): string {
  // Short form for display — full deviceId is opaque (uuid-shaped).
  // Truncates to the first 6 chars; renderer can show the full id on
  // hover if needed.
  return `Device ${deviceId.slice(0, 6)}`;
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
