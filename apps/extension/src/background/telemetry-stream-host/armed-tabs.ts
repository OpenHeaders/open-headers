/**
 * Armed-tab ledger — the tab-group reactor's data source.
 *
 * The lifecycle stream host raises a key here when a desktop watch
 * session opens on a tab and drops it on teardown; per-tab distinct-key
 * refcounts turn into armed/disarmed TRANSITIONS for subscribers
 * (0 → 1 sessions = armed, 1 → 0 = disarmed). From this side of the
 * wire an AI-agent arm and a workbench live watch are the same thing —
 * a desktop lifecycle subscription under a relay-minted opaque consumer
 * id — so "armed" here means exactly "some desktop consumer is
 * observing this tab". Purely additive bookkeeping: no host behavior
 * rides on this ledger.
 */

export interface ArmedTabTransition {
  readonly kind: 'armed' | 'disarmed';
  readonly tabId: number;
}

export type ArmedTabListener = (event: ArmedTabTransition) => void;

const sessionsByTab = new Map<number, Set<string>>();
const listeners = new Set<ArmedTabListener>();

function emit(kind: ArmedTabTransition['kind'], tabId: number): void {
  for (const listener of [...listeners]) {
    try {
      listener({ kind, tabId });
    } catch {
      // A throwing subscriber never breaks the stream host's teardown.
    }
  }
}

/** Record one open watch session on a tab under a session-unique key. */
export function armedTabRaise(tabId: number, key: string): void {
  let keys = sessionsByTab.get(tabId);
  if (!keys) {
    keys = new Set();
    sessionsByTab.set(tabId, keys);
  }
  const first = keys.size === 0;
  keys.add(key);
  if (first && keys.size === 1) emit('armed', tabId);
}

/** Drop a session recorded by {@link armedTabRaise}. Idempotent. */
export function armedTabDrop(tabId: number, key: string): void {
  const keys = sessionsByTab.get(tabId);
  if (!keys?.delete(key)) return;
  if (keys.size === 0) {
    sessionsByTab.delete(tabId);
    emit('disarmed', tabId);
  }
}

/** Whether any desktop consumer currently watches the tab. */
export function isTabArmed(tabId: number): boolean {
  return sessionsByTab.has(tabId);
}

/** Run `listener` on every armed/disarmed transition. Returns the
 *  unsubscribe. Transitions are edge events — a late subscriber reads
 *  the current state through {@link isTabArmed}. */
export function subscribeArmedTabs(listener: ArmedTabListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function __resetArmedTabsForTests(): void {
  sessionsByTab.clear();
  listeners.clear();
}
