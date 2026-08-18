/**
 * Captured-tab ledger — the tab-group reactor's data source.
 *
 * Holds the host-pushed truth about which tabs are CAPTURE-ARMED: their
 * traffic sits in the desktop tap's retention ring where connected AI
 * agents can read it (the agent-traffic plan §4). The capture-feedback
 * host replaces one backend's complete set per state frame; per-tab
 * union across backends turns into captured/released TRANSITIONS for
 * subscribers. A workbench live watch never lands here — the host
 * pushes capture arms only, so "captured" means exactly "AI agents can
 * read this tab's traffic". Purely additive bookkeeping: no host
 * behavior rides on this ledger.
 */

export interface CapturedTabTransition {
  readonly kind: 'captured' | 'released';
  readonly tabId: number;
}

export type CapturedTabListener = (event: CapturedTabTransition) => void;

const tabsByBackend = new Map<string, Set<number>>();
const listeners = new Set<CapturedTabListener>();

function emit(kind: CapturedTabTransition['kind'], tabId: number): void {
  for (const listener of [...listeners]) {
    try {
      listener({ kind, tabId });
    } catch {
      // A throwing subscriber never breaks the feedback host.
    }
  }
}

function heldByOtherBackend(tabId: number, backendId: string): boolean {
  for (const [id, tabs] of tabsByBackend) {
    if (id !== backendId && tabs.has(tabId)) return true;
  }
  return false;
}

/** Replace one backend's complete captured set (full-set push law).
 *  Transitions fire on UNION edges only — a tab two backends capture
 *  releases when the last one lets go, never in between. */
export function capturedTabsReplace(backendId: string, tabIds: readonly number[]): void {
  const next = new Set(tabIds);
  const prior = tabsByBackend.get(backendId) ?? new Set<number>();
  if (next.size === 0) tabsByBackend.delete(backendId);
  else tabsByBackend.set(backendId, next);
  for (const tabId of next) {
    if (!prior.has(tabId) && !heldByOtherBackend(tabId, backendId)) emit('captured', tabId);
  }
  for (const tabId of prior) {
    if (!next.has(tabId) && !heldByOtherBackend(tabId, backendId)) emit('released', tabId);
  }
}

/** Drop one backend's whole set (its wire closed). */
export function capturedTabsDropBackend(backendId: string): void {
  capturedTabsReplace(backendId, []);
}

/** Whether any backend currently holds the tab capture-armed. */
export function isTabCaptured(tabId: number): boolean {
  for (const tabs of tabsByBackend.values()) {
    if (tabs.has(tabId)) return true;
  }
  return false;
}

/** Run `listener` on every captured/released transition. Returns the
 *  unsubscribe. Transitions are edge events — a late subscriber reads
 *  the current state through {@link isTabCaptured}. */
export function subscribeCapturedTabs(listener: CapturedTabListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function __resetCapturedTabsForTests(): void {
  tabsByBackend.clear();
  listeners.clear();
}
