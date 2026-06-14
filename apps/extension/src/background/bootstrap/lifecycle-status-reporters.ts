/**
 * Status reporters whose source is the lifecycle pipeline.
 *
 * The eval-time cohort (sync / activity) installs in
 * {@link status-reporters} because its sources are module singletons
 * available at module-eval. This cohort's sources are init-time objects
 * born inside `startLifecyclePipeline()`, so they install here — called
 * from `background.ts` once the pipeline handles exist. Same job as
 * `status-reporters`, different phase; future lifecycle-sourced pills
 * slot in alongside the `cdp` one.
 *
 * Host gate (the composition root's call): the `cdp` reporter installs
 * only where `chrome.debugger` exists. On Firefox / Safari it is never
 * registered, so the pill stays grey (the Status store has no
 * per-subsystem clear; a never-reported subsystem is the only true-grey
 * path) and the heuristic path is untouched. This mirrors
 * `ChromeDebuggerEventSource`'s own self-inert capability check.
 */

import { report as reportStatus } from '@openheaders/ui/shared/status';
import { getBrowserAPI } from '@/types/browser';
import { installCdpStatusReporter } from '../cdp-status-reporter';
import type { CdpAttachObservable } from '../correlator-host';

interface InstallLifecycleStatusReportersOpts {
  cdpAttach: CdpAttachObservable;
}

export function installLifecycleStatusReporters({ cdpAttach }: InstallLifecycleStatusReportersOpts): void {
  const browser = getBrowserAPI();
  // Hosts without CDP never get the reporter → the `cdp` pill stays grey.
  if (browser.debugger === undefined) return;

  installCdpStatusReporter({
    report: (entry) =>
      reportStatus({
        subsystem: 'cdp',
        state: entry.state,
        message: entry.message,
        context: entry.context,
      }),
    getState: () => cdpAttach.getState(),
    onChange: (listener) => cdpAttach.onChange(listener),
    // Roster metadata is resolved SW-side (the UI is chrome-free) and shipped
    // in the status context. A tab closed mid-flight rejects → dropped.
    resolveTab: async (tabId) => {
      try {
        const tab = await browser.tabs.get(tabId);
        return { windowId: tab.windowId, index: tab.index, title: tab.title ?? '', url: tab.url ?? '' };
      } catch {
        return null;
      }
    },
    isPinned: (tabId) => cdpAttach.isPinned(tabId),
  });
}
