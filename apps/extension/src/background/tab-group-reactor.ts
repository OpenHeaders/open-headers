/**
 * Tab-group reactor — in-browser feedback for AI capture
 * (the agent-traffic plan §4). While a tab is capture-armed (connected
 * AI agents can read its traffic — the captured-tab ledger's
 * transitions, fed by the desktop's pushed capture state), the tab
 * rides in a blue tab group titled "OpenHeaders AI"; when the capture
 * ends, the tab's prior grouping is restored. A workbench live view
 * never badges — watching is not capture. The reactor REACTS to
 * capture state only — it never alters it.
 *
 * Laws:
 *
 *   - **Capability-gated, never UA-sniffed.** The tab-group port
 *     feature-detects `chrome.tabs.group` + `chrome.tabGroups`; a
 *     browser without them gets a silent no-op reactor.
 *   - **Never fight the user.** A tab is grouped once, at its captured
 *     transition. A tab the user pulls out of the group stays out; on
 *     release only a tab still sitting in the reactor's group is
 *     restored — to its prior group when it had one, else ungrouped.
 *     Pre-existing user groups are never retitled or recolored.
 *   - **One group per window.** Concurrently captured tabs in a window
 *     share one reactor-created group; the browser dissolves it when
 *     its last tab leaves, so the last release dissolves exactly the
 *     group the reactor made.
 *   - **Bookkeeping survives SW restarts** (chrome.storage is the
 *     authoritative tier): a release landing after a restart still
 *     restores the prior grouping, and entries whose capture never
 *     re-announces are swept after a grace window so a group cannot
 *     outlive its capture.
 */

import { getHostStorage, OH, type TabGroupFeedbackEntry } from '@openheaders/core/storage';
import { logger } from '@utils/logger';
import { type CapturedTabTransition, isTabCaptured, subscribeCapturedTabs } from './captured-tabs';

const SCOPE = 'TabGroupReactor';

/** The group chip's label — a product name, deliberately unlocalized.
 *  "AI" is load-bearing: the group marks tabs whose traffic connected
 *  AI agents can read, not mere desktop presence. */
export const OBSERVED_GROUP_TITLE = 'OpenHeaders AI';

/** `chrome.tabGroups.TAB_GROUP_ID_NONE` — the ungrouped sentinel. */
const NO_GROUP = -1;

/** Grace window after a cold start before entries whose capture never
 *  re-announced are swept: the daemon re-pushes the captured set at
 *  reconnect, and the feedback host's hello pulls it at SW boot —
 *  both comfortably inside this. */
export const RECONCILE_DELAY_MS = 30_000;

/**
 * The browser-facing seam, feature-detected once at start. Every method
 * answers absence/failure with `null`/no-op instead of throwing — a tab
 * or group that vanished mid-flight is an ordinary outcome here.
 */
export interface TabGroupPort {
  /** Whether this browser has the tab-group APIs at all. */
  available(): boolean;
  tab(tabId: number): Promise<{ windowId: number; groupId: number } | null>;
  /** Add the tab to `groupId` (or a fresh group when omitted); resolves
   *  the group id, or `null` when the move failed. */
  group(tabId: number, groupId?: number): Promise<number | null>;
  ungroup(tabId: number): Promise<void>;
  /** Stamp the title + blue color on a freshly created group. */
  decorate(groupId: number): Promise<void>;
  /** The window a group lives in, or `null` for a dissolved group. */
  windowOf(groupId: number): Promise<number | null>;
  onTabRemoved(listener: (tabId: number) => void): () => void;
}

function chromeTabGroupPort(): TabGroupPort {
  return {
    available() {
      try {
        return typeof chrome.tabGroups !== 'undefined' && typeof chrome.tabs.group === 'function';
      } catch {
        return false;
      }
    },
    async tab(tabId) {
      try {
        const tab = await chrome.tabs.get(tabId);
        return { windowId: tab.windowId ?? NO_GROUP, groupId: tab.groupId ?? NO_GROUP };
      } catch {
        return null;
      }
    },
    async group(tabId, groupId) {
      try {
        return await chrome.tabs.group({ tabIds: [tabId], ...(groupId !== undefined ? { groupId } : {}) });
      } catch {
        return null;
      }
    },
    async ungroup(tabId) {
      try {
        await chrome.tabs.ungroup(tabId);
      } catch {
        // Already ungrouped or gone — the outcome is the one wanted.
      }
    },
    async decorate(groupId) {
      try {
        await chrome.tabGroups.update(groupId, { title: OBSERVED_GROUP_TITLE, color: 'blue' });
      } catch {
        // A group dissolved before decoration carries no feedback debt.
      }
    },
    async windowOf(groupId) {
      try {
        return (await chrome.tabGroups.get(groupId)).windowId;
      } catch {
        return null;
      }
    },
    onTabRemoved(listener) {
      const handler = (tabId: number): void => listener(tabId);
      chrome.tabs.onRemoved.addListener(handler);
      return () => chrome.tabs.onRemoved.removeListener(handler);
    },
  };
}

export interface TabGroupReactorOptions {
  /** Test seams — default to the real chrome APIs + ledger. */
  readonly port?: TabGroupPort;
  readonly subscribe?: typeof subscribeCapturedTabs;
  readonly isCaptured?: typeof isTabCaptured;
  readonly reconcileDelayMs?: number;
}

export interface TabGroupReactor {
  dispose(): void;
  /** Resolves when every queued transition has been applied (tests). */
  settled(): Promise<void>;
}

const NOOP_REACTOR: TabGroupReactor = { dispose: () => undefined, settled: () => Promise.resolve() };

export function startTabGroupReactor(options?: TabGroupReactorOptions): TabGroupReactor {
  const port = options?.port ?? chromeTabGroupPort();
  if (!port.available()) return NOOP_REACTOR;
  const subscribe = options?.subscribe ?? subscribeCapturedTabs;
  const captured = options?.isCaptured ?? isTabCaptured;

  const entries = new Map<number, TabGroupFeedbackEntry>();

  async function persist(): Promise<void> {
    const storage = getHostStorage();
    if (!storage) return;
    const record: Record<string, TabGroupFeedbackEntry> = {};
    for (const [tabId, entry] of entries) record[String(tabId)] = entry;
    await storage.set(OH.tabGroupFeedback, record).catch(() => {
      // A failed write self-heals on the next transition's persist.
    });
  }

  async function hydrate(): Promise<void> {
    const storage = getHostStorage();
    if (!storage) return;
    const stored = await storage.get(OH.tabGroupFeedback).catch(() => undefined);
    if (!stored) return;
    for (const [key, entry] of Object.entries(stored)) {
      const tabId = Number.parseInt(key, 10);
      if (Number.isFinite(tabId)) entries.set(tabId, entry);
    }
  }

  /** The group ids this reactor created, per the live bookkeeping. */
  function ownedGroups(): Set<number> {
    return new Set([...entries.values()].map((entry) => entry.groupId));
  }

  async function onCaptured(tabId: number): Promise<void> {
    // An entry already present is a re-announce after an SW restart
    // (or a second backend joining): grouping happened at the first
    // captured transition, and manual moves since are respected.
    if (entries.has(tabId)) return;
    const tab = await port.tab(tabId);
    if (tab === null) return;
    const owned = ownedGroups();
    // One group per window: reuse the reactor's live group there.
    let target: number | null = null;
    for (const groupId of owned) {
      if ((await port.windowOf(groupId)) === tab.windowId) {
        target = groupId;
        break;
      }
    }
    if (target !== null && tab.groupId === target) {
      // Already sitting in the reactor's group (user dragged it in).
      entries.set(tabId, { priorGroupId: NO_GROUP, groupId: target });
      await persist();
      return;
    }
    // A prior group that is itself reactor-made is never a restore
    // target — record "none" so release ungroups instead of re-pinning.
    const priorGroupId = owned.has(tab.groupId) ? NO_GROUP : tab.groupId;
    const groupId = await port.group(tabId, target ?? undefined);
    if (groupId === null) return;
    if (target === null) await port.decorate(groupId);
    entries.set(tabId, { priorGroupId, groupId });
    await persist();
  }

  async function onReleased(tabId: number): Promise<void> {
    const entry = entries.get(tabId);
    if (entry === undefined) return;
    entries.delete(tabId);
    const tab = await port.tab(tabId);
    // Only a tab still sitting in the reactor's group is touched — a
    // closed tab or one the user moved keeps its state, and only the
    // bookkeeping drops.
    if (tab !== null && tab.groupId === entry.groupId) {
      let restored = false;
      if (entry.priorGroupId !== NO_GROUP && (await port.windowOf(entry.priorGroupId)) === tab.windowId) {
        restored = (await port.group(tabId, entry.priorGroupId)) !== null;
      }
      if (!restored) await port.ungroup(tabId);
    }
    await persist();
  }

  async function forget(tabId: number): Promise<void> {
    if (!entries.delete(tabId)) return;
    await persist();
  }

  /** Post-restart sweep: an entry whose capture never re-announced
   *  inside the grace window is a group outliving its capture — end it
   *  honestly. */
  async function reconcile(): Promise<void> {
    for (const tabId of [...entries.keys()]) {
      if (!captured(tabId)) await onReleased(tabId);
    }
  }

  // Transitions serialize through one promise chain: group/ungroup are
  // multi-step async against live browser state, and interleaving two
  // captures in one window would mint two groups where the law wants
  // one.
  let chain: Promise<void> = hydrate().catch((err) => {
    logger.warn(SCOPE, 'bookkeeping hydrate failed', err);
  });
  const run = (task: () => Promise<void>): void => {
    chain = chain.then(task).catch((err) => {
      logger.warn(SCOPE, 'transition failed', err);
    });
  };

  const unsubscribe = subscribe((event: CapturedTabTransition) => {
    run(() => (event.kind === 'captured' ? onCaptured(event.tabId) : onReleased(event.tabId)));
  });
  const offTabRemoved = port.onTabRemoved((tabId) => {
    run(() => forget(tabId));
  });
  const reconcileTimer = setTimeout(() => {
    run(reconcile);
  }, options?.reconcileDelayMs ?? RECONCILE_DELAY_MS);

  return {
    dispose(): void {
      unsubscribe();
      offTabRemoved();
      clearTimeout(reconcileTimer);
    },
    settled(): Promise<void> {
      return chain;
    },
  };
}
