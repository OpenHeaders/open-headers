import type { RequestRecord, Rule } from '@openheaders/core/types';
import { isRuleEffective } from '@openheaders/core/utils';
import { type CdpTabControlState, EMPTY_TAB_CONTROL_STATE } from '@openheaders/oracle/correlator-cdp';
import { getPauseMarkers } from '@openheaders/oracle/entity/pause-markers-store';
import { getRules } from '@openheaders/oracle/entity/rule-store';
import { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RuleFireHub } from '@openheaders/oracle/rule-fire-hub';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import type { CdpAttachObservable } from '../correlator-host';
import {
  CdpAttachController,
  ChromeCdpRequestControlPort,
  ChromeCdpTabControlPort,
  compileFetchPatterns,
  createCdpControlReplay,
  startCdpFetchInterceptor,
  startDevtoolsPortPresence,
  startLifecycleHost,
} from '../correlator-host';
import { startDevtoolsSessionCoordinator } from '../devtools-session-coordinator';
import { getRulesPaused } from '../dnr-manager';
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
  // Control plane (T2): the declarative standing-state port + the imperative
  // per-request port, both over the debugger source's session sender, and the
  // replay seam that re-applies a tab's derived CDP state on every (re-)attach.
  const tabControlPort = new ChromeCdpTabControlPort(lifecycleHost.debuggerSource);
  const requestControlPort = new ChromeCdpRequestControlPort(lifecycleHost.debuggerSource);
  // Phase D1: `deriveState` compiles `Fetch.enable` patterns from the live
  // debug-tier rules — but ONLY for ARMED tabs (§2 Option C: debug-tier
  // control is inert until the user arms the tab; a panel-open-but-unarmed
  // tab attaches via its port yet gets no Fetch interception). The controller
  // owns the armed set but is constructed below (it needs the replay), so the
  // gate reads it through a small forward ref; `deriveState` only ever runs
  // from `replay`, which fires after attach, so the ref is always set by then.
  let isTabArmed: (tabId: number) => boolean = () => false;
  const liveRules = (): Rule[] =>
    getRules().filter((rule) => isRuleEffective(rule, getPauseMarkers(), getRulesPaused()));
  const deriveState = (tabId: number): CdpTabControlState => {
    if (!isTabArmed(tabId)) return EMPTY_TAB_CONTROL_STATE;
    const fetchPatterns = compileFetchPatterns(liveRules());
    return fetchPatterns.length === 0 ? EMPTY_TAB_CONTROL_STATE : { ...EMPTY_TAB_CONTROL_STATE, fetchPatterns };
  };
  // Authoritative fire sink for D2 fulfill/rewrite. Resolved to the fires
  // bridge below (constructed after the rule-fire hub); a fulfill only fires
  // once a tab is armed and traffic flows, so the ref is always set by then.
  let reportFire: (tabId: number, record: RequestRecord) => void = () => {};
  const cdpControlReplay = createCdpControlReplay({
    tabControlPort,
    deriveState,
    childSessionsOf: (tabId) => lifecycleHost.debuggerSource.childSessionsOf(tabId),
  });
  // Fan the tab's standing CDP state onto child sessions (workers / OOPIFs)
  // as they attach/detach during its lifetime, so Fetch interception reaches
  // worker- and iframe-originated requests, not just the root page target.
  lifecycleHost.debuggerSource.onChildAttached((tabId, sessionId) => cdpControlReplay.applyChild(tabId, sessionId));
  lifecycleHost.debuggerSource.onChildDetached((tabId, sessionId) => cdpControlReplay.forgetChild(tabId, sessionId));
  const cdpAttachController = new CdpAttachController({
    source: lifecycleHost.debuggerSource,
    router: lifecycleHost.router,
    replay: cdpControlReplay,
  });
  isTabArmed = (tabId) => cdpAttachController.isArmed(tabId);
  // Rule-driven interceptor (D2): each `Fetch.requestPaused` is re-checked
  // against the live rules and answered — static `mock` → fulfill, static
  // `body` → request-body rewrite, everything else → pass-through — with a
  // fulfill/rewrite reported as an authoritative fire.
  startCdpFetchInterceptor({
    subscribeFetch: (listener) => lifecycleHost.debuggerSource.subscribeFetch(listener),
    requestControlPort,
    getRules: liveRules,
    reportFire: (tabId, record) => reportFire(tabId, record),
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
  reportFire = (tabId, record) => firesBridge.notifyAuthoritativeFire(tabId, record);

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
