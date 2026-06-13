import { EMPTY_TAB_CONTROL_STATE } from '@openheaders/oracle/correlator-cdp';
import { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RuleFireHub } from '@openheaders/oracle/rule-fire-hub';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import type { CdpAttachObservable } from '../correlator-host';
import {
  CdpAttachController,
  ChromeCdpTabControlPort,
  createCdpControlReplay,
  startDevtoolsPortPresence,
  startLifecycleHost,
} from '../correlator-host';
import { startDevtoolsSessionCoordinator } from '../devtools-session-coordinator';
import { createPersistentWatchSessionFloors, startLifecyclePortHost } from '../lifecycle-port-host';
import { setupOnRuleMatchedDebugBridge } from '../modules/on-rule-matched-debug';
import { startTabTelemetryFiresBridge } from '../modules/tab-telemetry-fires-bridge';
import { startCdpPageBridge, startDevtoolsPageNavBridge, startPagePortHost } from '../page-port-host';
import { startResourceTimingRelay } from '../resource-timing-relay';
import { startRuleEngineDriver } from '../rule-engine-driver';
import { startRuleFirePortHost } from '../rule-fire-port-host';
import { startTabTelemetrySource } from '../tab-telemetry-source';
import { debouncedUpdateBadge } from './badge-update';

interface LifecyclePipelineHandles {
  lifecycleStore: ReturnType<typeof startLifecycleHost>['store'];
  /**
   * Drive the opt-in CDP master switch. `background.ts` seeds this with
   * `getSetting('inspection.cdpEnabled')` once settings are ready, then
   * feeds every `subscribeKey('inspection.cdpEnabled')` change. With it
   * OFF (the default) the reconciler's intersection is ∅ and nothing
   * attaches.
   */
  setCdpEnabled: (enabled: boolean) => void;
  /**
   * Read/observe the reconciler's effective state. Wired by `background.ts`
   * into the `cdp` Status reporter (gated on the host having CDP) — the
   * read-side mirror of `setCdpEnabled`'s write side.
   */
  cdpAttach: CdpAttachObservable;
  /**
   * Arm / disarm a tab for the debug-mode control plane (§2 Option C). An
   * armed tab joins the CDP desired set like a live DevTools port; the
   * arming UI (Phase C3/D) drives these. Inert until then — no caller arms.
   */
  armCdpTab: (tabId: number) => void;
  disarmCdpTab: (tabId: number) => void;
}

export function startLifecyclePipeline(): LifecyclePipelineHandles {
  const tabLifecycleBus = new TabLifecycleBus();
  const lifecycleHost = startLifecycleHost({ bus: tabLifecycleBus });
  startRuleEngineDriver({ store: lifecycleHost.store, updateBadge: debouncedUpdateBadge, bus: tabLifecycleBus });
  startTabTelemetrySource({ store: lifecycleHost.store, bus: tabLifecycleBus });

  // Opt-in CDP attach reconciler: attached = { tabs with a live DevTools
  // port } ∩ { master switch ON }. The DevTools-port presence observer
  // feeds the first input; `setCdpEnabled` (returned below, driven by
  // `background.ts`'s `subscribeKey('inspection.cdpEnabled')`) feeds the
  // master switch. Default OFF → the intersection is ∅, nothing attaches,
  // and the heuristic path is byte-for-byte unchanged.
  // Control plane (T2): the declarative standing-state port over the
  // debugger source's session sender, and the replay seam that re-applies a
  // tab's derived CDP state on every (re-)attach. `deriveState` is empty
  // until Phases D/F compile debug rules into CDP state; the seam exists now
  // so replay-on-reattach is structural, not retrofitted.
  const tabControlPort = new ChromeCdpTabControlPort(lifecycleHost.debuggerSource);
  const cdpControlReplay = createCdpControlReplay({
    tabControlPort,
    deriveState: () => EMPTY_TAB_CONTROL_STATE,
  });
  const cdpAttachController = new CdpAttachController({
    source: lifecycleHost.debuggerSource,
    router: lifecycleHost.router,
    replay: cdpControlReplay,
  });
  startDevtoolsPortPresence({
    onConnected: (tabId) => cdpAttachController.notePortConnected(tabId),
    onDisconnected: (tabId) => cdpAttachController.notePortDisconnected(tabId),
  });

  // Watch-session floors persist per-tab so a panel reconnect/remount (or
  // an SW restart) restores the session rather than dropping in-flight rows.
  const sessionFloors = createPersistentWatchSessionFloors();
  const lifecycleHub = new RequestLifecycleHub({
    store: lifecycleHost.store,
    bus: tabLifecycleBus,
    sessionFloors,
  });
  startLifecyclePortHost({
    hub: lifecycleHub,
    ready: sessionFloors.ready,
    provenance: lifecycleHost.router,
    // The CDP correlator fetches response bodies on demand; it gates on its
    // own attach set, so a heuristic-owned tab is a clean no-op.
    bodyFetcher: lifecycleHost.cdpCorrelator,
  });

  // Page stream: two sources, one per tab-owner (same ownership the request
  // correlators route on). CDP-owned tabs take pages from the CDP
  // Page-domain feed (Chrome-exact timings); heuristic tabs from the
  // Performance-API nav bridge, which is suppressed for CDP-owned tabs.
  const pageHub = new PageStreamHub({ bus: tabLifecycleBus });
  startPagePortHost({ hub: pageHub });
  startDevtoolsPageNavBridge({
    hub: pageHub,
    isCdpOwned: (tabId) => lifecycleHost.router.ownerOf(tabId) === 'cdp',
  });
  startCdpPageBridge({ source: lifecycleHost.debuggerSource, hub: pageHub, bus: tabLifecycleBus });

  // Memory-cache rows: renderer cache hits never reach `webRequest`/HAR,
  // so they ride a separate Resource Timing snapshot feed reconciled
  // panel-local (`oh-rt:<tabId>`).
  const resourceTimingHost = startResourceTimingRelay({ bus: tabLifecycleBus });

  // Per-DevTools-session reset: a genuine reopen advances the lifecycle
  // floor and drops the prior session's cached Resource Timing groups, so
  // close/reopen in the same browser tab starts a clean log (Chrome parity).
  startDevtoolsSessionCoordinator({ hub: lifecycleHub, relay: resourceTimingHost.relay, pageHub });

  const ruleFireHub = new RuleFireHub({ bus: tabLifecycleBus });
  startRuleFirePortHost({ hub: ruleFireHub });
  const firesBridge = startTabTelemetryFiresBridge({
    hub: ruleFireHub,
    isCdpOwned: (tabId) => lifecycleHost.router.ownerOf(tabId) === 'cdp',
  });

  setupOnRuleMatchedDebugBridge({
    onAuthoritativeFire: (tabId, record) => firesBridge.notifyAuthoritativeFire(tabId, record),
  });

  return {
    lifecycleStore: lifecycleHost.store,
    setCdpEnabled: (enabled) => cdpAttachController.setEnabled(enabled),
    cdpAttach: cdpAttachController,
    armCdpTab: (tabId) => cdpAttachController.noteArmed(tabId),
    disarmCdpTab: (tabId) => cdpAttachController.noteDisarmed(tabId),
  };
}
