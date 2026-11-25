/**
 * Watched browsers' tab favicons, held in the window by key.
 *
 * A browser's tab inventory names each tab's icon by a key and sends it
 * again in every snapshot; the icon's bytes cross once, when this store
 * asks for a key it does not hold ({@link syncPeerFavicons}). A tab row
 * then reads its icon from here ({@link withPeerFavicons}).
 *
 * The store follows the inventory: an icon no listed tab names any more
 * is dropped, so it holds as many icons as there are distinct ones on
 * screen. A browser that sends its icons inline (one that predates the
 * keys) needs nothing from here — its rows pass through as they are.
 *
 * Module scope like the Traffic tool's own cross-mount state: plain
 * values, no lifeline of its own.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { TELEMETRY_FAVICONS_PER_PULL } from '@openheaders/core/protocol';

/** What a tab row says of its icon: the bytes inline, or the key that names them. */
export interface TabFaviconRef {
  favIconUrl?: string;
  favIconKey?: string;
}

/** Browser (`nodeId`) → key → `data:` URI. Replaced, never mutated, on a change. */
export type PeerFavicons = ReadonlyMap<string, ReadonlyMap<string, string>>;

let held: PeerFavicons = new Map();
/** Keys asked for and not answered yet, per browser — never asked twice at once. */
const asked = new Map<string, Set<string>>();
const listeners = new Set<() => void>();

function publish(next: PeerFavicons): void {
  held = next;
  for (const listener of listeners) listener();
}

export function subscribePeerFavicons(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readPeerFavicons(): PeerFavicons {
  return held;
}

async function pull(nodeId: string, keys: readonly string[]): Promise<void> {
  let inFlight = asked.get(nodeId);
  if (inFlight === undefined) {
    inFlight = new Set();
    asked.set(nodeId, inFlight);
  }
  for (const key of keys) inFlight.add(key);
  try {
    const { icons } = await hostBridge.call('oh.daemon.telemetry.tabs.favicons', { nodeId, keys });
    const arrived = Object.entries(icons);
    if (arrived.length > 0) {
      const next = new Map(held);
      next.set(nodeId, new Map([...(held.get(nodeId) ?? []), ...arrived]));
      publish(next);
    }
  } catch {
    // The host could not ask — the next snapshot names the keys again.
  } finally {
    for (const key of keys) inFlight.delete(key);
    if (inFlight.size === 0 && asked.get(nodeId) === inFlight) asked.delete(nodeId);
  }
}

/**
 * The inventory as it stands: each listed browser and the favicon keys
 * its tabs name. Icons nothing names any more are dropped; keys not held
 * are asked for, at most `TELEMETRY_FAVICONS_PER_PULL` a call. A key the
 * browser could not answer is asked again with the next snapshot.
 */
export function syncPeerFavicons(named: ReadonlyMap<string, ReadonlySet<string>>): void {
  let next: Map<string, ReadonlyMap<string, string>> | null = null;
  for (const [nodeId, icons] of held) {
    const keys = named.get(nodeId);
    const kept = keys === undefined ? [] : [...icons].filter(([key]) => keys.has(key));
    if (kept.length === icons.size) continue;
    next ??= new Map(held);
    if (kept.length === 0) next.delete(nodeId);
    else next.set(nodeId, new Map(kept));
  }
  if (next !== null) publish(next);

  for (const [nodeId, keys] of named) {
    const icons = held.get(nodeId);
    const inFlight = asked.get(nodeId);
    const missing = [...keys].filter((key) => icons?.has(key) !== true && inFlight?.has(key) !== true);
    for (let from = 0; from < missing.length; from += TELEMETRY_FAVICONS_PER_PULL) {
      void pull(nodeId, missing.slice(from, from + TELEMETRY_FAVICONS_PER_PULL));
    }
  }
}

/** The favicon keys a browser's tabs name. */
export function namedFaviconKeys(tabs: readonly TabFaviconRef[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const tab of tabs) {
    if (tab.favIconKey !== undefined) keys.add(tab.favIconKey);
  }
  return keys;
}

/**
 * One browser's tabs as a row shows them: a tab that names its icon by
 * key reads the bytes from `icons`. The same array comes back when no
 * tab gains an icon, so a browser that sends none by key costs nothing.
 */
export function withPeerFavicons<T extends TabFaviconRef>(
  tabs: readonly T[],
  icons: ReadonlyMap<string, string> | undefined,
): readonly T[] {
  if (icons === undefined) return tabs;
  let shown: T[] | null = null;
  tabs.forEach((tab, index) => {
    if (tab.favIconUrl !== undefined || tab.favIconKey === undefined) return;
    const favIconUrl = icons.get(tab.favIconKey);
    if (favIconUrl === undefined) return;
    shown ??= [...tabs];
    shown[index] = { ...tab, favIconUrl };
  });
  return shown ?? tabs;
}
