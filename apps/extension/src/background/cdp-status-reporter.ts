/**
 * CDP attach state → Status subsystem bridge.
 *
 * Mirrors the effective state of the {@link CdpAttachController} onto the
 * `cdp` Status pill. Same shape as {@link activity-status-reporter}: a
 * pure mapper plus a thin install-wiring function.
 *
 *   - {@link describeCdpStatus} — pure mapping; one {@link CdpAttachState}
 *     in, one StatusEntry-shaped row out. Always non-null: OFF reports an
 *     explicit green "Off" (the Status store has no per-subsystem clear,
 *     so an absent entry renders grey — reserved for "reporter never
 *     installed" on hosts without CDP).
 *   - {@link installCdpStatusReporter} — subscribes the controller and
 *     emits the baseline immediately so the pill starts green, not grey.
 *
 * Host-agnostic: it reads the controller's effective state, never
 * `chrome.*` or the `inspection.cdpEnabled` setting directly. The host
 * capability gate (install only where `chrome.debugger` exists) lives in
 * the bootstrap composition that wires this — see
 * `bootstrap/lifecycle-status-reporters`.
 */

import type { CdpRosterTab } from '@openheaders/core/types';
import type { CdpAttachState } from './correlator-host/cdp-attach-controller';

export interface CdpStatusEntry {
  readonly state: 'green' | 'yellow' | 'red';
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

/**
 * Pure mapping: the controller's effective state → the Status row the
 * pill renders. Precedence: OFF (faults are moot when off) → attach
 * failure (red) → user fall-back (yellow) → idle/attached counts (green).
 *
 * `roster` is the host-resolved per-tab detail (title / URL / window /
 * pinned) for {@link CdpAttachState.attachedTabs}; it rides in `context.tabs`
 * so the chrome-free footer can render the roster + jump-to-tab. Empty when
 * off or nothing is attached.
 */
export function describeCdpStatus(state: CdpAttachState, roster: readonly CdpRosterTab[] = []): CdpStatusEntry {
  const { enabled, attachedTabs, pinnedTabs, lastFault } = state;
  const attachedCount = attachedTabs.length;
  // `pinnedTabs` rides in every context (independent of the master switch) so
  // the control surface can reflect the per-tab pin before inspection is on.
  if (!enabled) {
    return { state: 'green', message: 'Off', context: { enabled: false, tabs: [], pinnedTabs } };
  }
  if (lastFault?.kind === 'attach-failed') {
    return {
      state: 'red',
      message: `Tab ${lastFault.tabId} attach failed`,
      context: { enabled: true, attachedCount, faultTabId: lastFault.tabId, tabs: roster, pinnedTabs },
    };
  }
  if (lastFault?.kind === 'fell-back') {
    return {
      state: 'yellow',
      message: `Tab ${lastFault.tabId} fell back to heuristic`,
      context: { enabled: true, attachedCount, faultTabId: lastFault.tabId, tabs: roster, pinnedTabs },
    };
  }
  if (attachedCount <= 0) {
    return {
      state: 'green',
      message: 'On · no tabs attached yet',
      context: { enabled: true, attachedCount: 0, tabs: [], pinnedTabs },
    };
  }
  return {
    state: 'green',
    message: `On · ${attachedCount} ${attachedCount === 1 ? 'tab' : 'tabs'}`,
    context: { enabled: true, attachedCount, tabs: roster, pinnedTabs },
  };
}

/** Host-resolved tab metadata for a single roster entry, or `null` when the
 *  tab can't be resolved (closed mid-flight, internal page). */
export interface CdpTabInfo {
  readonly windowId: number;
  /** Zero-based position of the tab within its window. */
  readonly index: number;
  readonly title: string;
  readonly url: string;
}

export interface InstallCdpStatusReporterDeps {
  /** Status-subsystem write hook for the `cdp` slot. */
  readonly report: (entry: CdpStatusEntry) => void;
  /** Snapshot the controller's effective state — drives the baseline. */
  readonly getState: () => CdpAttachState;
  /** Subscribe to effective-state changes. The callback runs after each change. */
  readonly onChange: (listener: (state: CdpAttachState) => void) => () => void;
  /**
   * Resolve a tab id to its display metadata (host-side `chrome.tabs.get`).
   * Resolves `null` for a tab that vanished or can't be read; the reporter
   * then drops it from the roster.
   */
  readonly resolveTab: (tabId: number) => Promise<CdpTabInfo | null>;
  /** Whether a tab is explicitly pinned — the roster's per-tab pin flag. */
  readonly isPinned: (tabId: number) => boolean;
}

export interface CdpStatusReporterHandle {
  /** Tear down the subscription. Idempotent. */
  dispose(): void;
}

/**
 * Wire the reporter. The empty-roster cases (off / no tabs attached) report
 * synchronously so the pill is never grey once installed; the populated cases
 * resolve each tab's metadata first (one `chrome.tabs.get` per attached tab),
 * then report. A monotonic generation guard drops a stale resolution so a
 * burst of rapid changes can't let an older roster overwrite a newer one.
 */
export function installCdpStatusReporter(deps: InstallCdpStatusReporterDeps): CdpStatusReporterHandle {
  let disposed = false;
  let generation = 0;

  const buildRoster = async (state: CdpAttachState): Promise<CdpRosterTab[]> => {
    const resolved = await Promise.all(
      state.attachedTabs.map(async (tabId) => {
        const info = await deps.resolveTab(tabId);
        if (!info) return null;
        return {
          tabId,
          windowId: info.windowId,
          index: info.index,
          title: info.title,
          url: info.url,
          pinned: deps.isPinned(tabId),
        };
      }),
    );
    return resolved.filter((tab): tab is CdpRosterTab => tab !== null);
  };

  const emit = (state: CdpAttachState): void => {
    if (disposed) return;
    // Bump the generation on every emit — both branches — so an async roster
    // resolution still in flight is invalidated by a newer (sync or async)
    // state change.
    const gen = ++generation;
    if (state.attachedTabs.length === 0) {
      deps.report(describeCdpStatus(state, []));
      return;
    }
    void buildRoster(state).then((roster) => {
      if (disposed || gen !== generation) return;
      deps.report(describeCdpStatus(state, roster));
    });
  };

  emit(deps.getState());
  const unsubscribe = deps.onChange((state) => emit(state));

  return {
    dispose(): void {
      if (disposed) return;
      disposed = true;
      unsubscribe();
    },
  };
}
