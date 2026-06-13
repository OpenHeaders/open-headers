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
 */
export function describeCdpStatus(state: CdpAttachState): CdpStatusEntry {
  const { enabled, attachedTabs, lastFault } = state;
  const attachedCount = attachedTabs.length;
  if (!enabled) {
    return { state: 'green', message: 'Off', context: { enabled: false } };
  }
  if (lastFault?.kind === 'attach-failed') {
    return {
      state: 'red',
      message: `Tab ${lastFault.tabId} attach failed`,
      context: { enabled: true, attachedCount, faultTabId: lastFault.tabId },
    };
  }
  if (lastFault?.kind === 'fell-back') {
    return {
      state: 'yellow',
      message: `Tab ${lastFault.tabId} fell back to heuristic`,
      context: { enabled: true, attachedCount, faultTabId: lastFault.tabId },
    };
  }
  if (attachedCount <= 0) {
    return { state: 'green', message: 'On · no tabs attached yet', context: { enabled: true, attachedCount: 0 } };
  }
  return {
    state: 'green',
    message: `On · ${attachedCount} ${attachedCount === 1 ? 'tab' : 'tabs'}`,
    context: { enabled: true, attachedCount },
  };
}

export interface InstallCdpStatusReporterDeps {
  /** Status-subsystem write hook for the `cdp` slot. */
  readonly report: (entry: CdpStatusEntry) => void;
  /** Snapshot the controller's effective state — drives the baseline. */
  readonly getState: () => CdpAttachState;
  /** Subscribe to effective-state changes. The callback runs after each change. */
  readonly onChange: (listener: (state: CdpAttachState) => void) => () => void;
}

export interface CdpStatusReporterHandle {
  /** Tear down the subscription. Idempotent. */
  dispose(): void;
}

/**
 * Wire the reporter. Emits the baseline synchronously (green "Off" by
 * default) so the pill is never grey once installed, then mirrors every
 * subsequent change.
 */
export function installCdpStatusReporter(deps: InstallCdpStatusReporterDeps): CdpStatusReporterHandle {
  let disposed = false;

  const emit = (state: CdpAttachState): void => {
    if (disposed) return;
    deps.report(describeCdpStatus(state));
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
