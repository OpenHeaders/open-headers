import type { CdpScopeMode, RequestRecord, Rule } from '@openheaders/core/types';
import { isRuleEffective } from '@openheaders/core/utils';
import { type CdpTabControlState, EMPTY_TAB_CONTROL_STATE } from '@openheaders/oracle/correlator-cdp';
import { getPauseMarkers } from '@openheaders/oracle/entity/pause-markers-store';
import { getRules } from '@openheaders/oracle/entity/rule-store';
import { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { resolveRulesForCompile } from '@openheaders/oracle/rule-engine/variables-resolver';
import { RuleFireHub } from '@openheaders/oracle/rule-fire-hub';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import type { CdpAttachObservable, CdpControlReplay } from '../correlator-host';
import {
  CdpAttachController,
  ChromeCdpEvalPort,
  ChromeCdpRequestControlPort,
  ChromeCdpTabControlPort,
  createCdpControlReplay,
  deriveTabControlState,
  startCdpActiveTab,
  startCdpFetchInterceptor,
  startDevtoolsPortPresence,
  startLifecycleHost,
} from '../correlator-host';
import { startDevtoolsSessionCoordinator } from '../devtools-session-coordinator';
import { getRulesPaused } from '../dnr-manager';
import { refreshInterceptorsForTab, setCdpControlQuery } from '../inject-manager';
import { createPersistentWatchSessionFloors, startLifecyclePortHost } from '../lifecycle-port-host';
import { isCacheBypassActive } from '../modules/cache-bypass';
import { setupOnRuleMatchedDebugBridge } from '../modules/on-rule-matched-debug';
import { recordReportedFire } from '../modules/tab-telemetry';
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
   * Drive the CDP attach-scope mode. `background.ts` seeds this with
   * `getSetting('inspection.cdpScope')` once settings are ready, then feeds
   * every change. Chooses which driver sets the reconciler honours
   * (DevTools ports / the active tab / both); default `devtools` reproduces
   * the original DevTools-bound behaviour.
   */
  setCdpScopeMode: (mode: CdpScopeMode) => void;
  /**
   * Pin / unpin a tab into the CDP scope — the explicit per-tab overlay on
   * top of the scope mode (§2 banner consent). A pinned tab joins the
   * desired set regardless of mode, focus, or DevTools; the footer "include
   * this tab" control (Slice 2) drives these.
   */
  pinCdpTab: (tabId: number) => void;
  unpinCdpTab: (tabId: number) => void;
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
  // D2b-2: the host eval seam — runs a dynamic rule's user JS in the request
  // frame's isolated world so its body computes at the network layer.
  const evalPort = new ChromeCdpEvalPort(lifecycleHost.debuggerSource);
  // Phase D/E: `deriveState` compiles the standing CDP control state for any
  // tab that is IN SCOPE — the network plane (`Fetch.enable` patterns from the
  // Fetch-realizable rules) AND the delivery plane (document-bootstrap sources
  // from the residual wrappers, Phase E1b) — both replayed together. There is
  // no observe-vs-control split: a tab the reconciler attached (via its scope
  // mode or an explicit pin) gets the full control suite, and what each rule
  // does is the rule's own job. The controller owns the scope derivation but
  // is constructed below (it needs the replay), so the gate reads it through
  // a small forward ref; `deriveState` only ever runs from `replay`, which
  // fires after attach, so the ref is always set by then.
  let isTabInScope: (tabId: number) => boolean = () => false;
  // `{{…}}` is resolved here (env / collection / workspace vars + vault) the
  // same way the DNR/injection compile path resolves it — so a templated
  // response body, body rewrite, or auth credential ships its literal value over CDP,
  // not the raw template. The resolve is cheap (no I/O) and passes a strict
  // subset of the store's rules, so it never clobbers the DNR snapshot memo.
  const liveRules = (): Rule[] =>
    resolveRulesForCompile(getRules().filter((rule) => isRuleEffective(rule, getPauseMarkers(), getRulesPaused())));
  // The cache plane is the only standing-state input that is NOT rule-derived:
  // it is the per-tab "disable cache" toggle owned by the DNR cache-bypass
  // module, read here and threaded into the derive so it joins the all-empty
  // guard. The DNR rule stays installed as the un-armed/detached fallback —
  // `Network.setCacheDisabled` is a whole-tab superset, idempotent against it.
  const deriveState = (tabId: number): CdpTabControlState =>
    isTabInScope(tabId)
      ? deriveTabControlState(liveRules(), { cacheDisabled: isCacheBypassActive(tabId) })
      : EMPTY_TAB_CONTROL_STATE;
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
  // Precedence (D4): the page-context interceptor suppression reads the router
  // (the single source of tab ownership) and re-derives a tab's injection set
  // in lock-step with the control-plane replay/release. When a tab's ownership
  // flips — attach commits it to 'cdp', any detach (incl. banner-cancel) routes
  // it back to 'heuristic' — `refreshInterceptorsForTab` suppresses (or
  // re-enables) the in-page wrapper for the realizable debug-tier rules CDP now
  // owns, with no page reload. Child-session apply/forget never change tab
  // ownership, so they keep using the raw replay above.
  setCdpControlQuery((tabId) => lifecycleHost.router.ownerOf(tabId) === 'cdp');
  const replayWithInjectionRefresh: CdpControlReplay = {
    replay(tabId) {
      cdpControlReplay.replay(tabId);
      void refreshInterceptorsForTab(tabId);
    },
    release(tabId) {
      cdpControlReplay.release(tabId);
      void refreshInterceptorsForTab(tabId);
    },
  };
  const cdpAttachController = new CdpAttachController({
    source: lifecycleHost.debuggerSource,
    router: lifecycleHost.router,
    replay: replayWithInjectionRefresh,
  });
  isTabInScope = (tabId) => cdpAttachController.isInScope(tabId);
  // Rule-driven interceptor (D2): each `Fetch.requestPaused` is re-checked
  // against the live rules and answered — static `response` → fulfill, static
  // `request-body` → request-body rewrite, everything else → pass-through —
  // with a fulfill/rewrite reported as an authoritative fire.
  startCdpFetchInterceptor({
    subscribeFetch: (listener) => lifecycleHost.debuggerSource.subscribeFetch(listener),
    requestControlPort,
    evalPort,
    getRules: liveRules,
    reportFire: (tabId, record) => reportFire(tabId, record),
    // Control-plane → observation seam (D4c): record the interception hold onto
    // the request's lifecycle so the inspector attributes it to debug mode, not
    // the server. The store is the same in-process intake the correlators feed;
    // a pause whose lifecycle has not `started` yet is dropped (rare, cosmetic).
    reportPause: (tabId, requestId, pausedMs) =>
      lifecycleHost.store.apply({ kind: 'phase', tabId, requestId, patch: { pausedByDebugMs: pausedMs } }),
  });
  // Private fire-bridge (E4): residual in-page wrappers on a CDP-attached tab
  // report via Runtime.addBinding (page-invisible) instead of window.postMessage.
  // Route those binding fires into the SAME tab-telemetry plane the un-armed
  // postMessage path (`tabFire`) feeds — keyed by the tab the binding fired on.
  lifecycleHost.debuggerSource.subscribeBinding((fire) =>
    recordReportedFire(fire.tabId, fire.ruleUid, fire.url, fire.t),
  );
  startDevtoolsPortPresence({
    onConnected: (tabId) => cdpAttachController.notePortConnected(tabId),
    onDisconnected: (tabId) => cdpAttachController.notePortDisconnected(tabId),
  });
  // Active-tab input for the `active` / `both` scope modes — the current
  // attachable tab, following focus. Always running so a mode switch
  // reconciles against a current value; the controller ignores it in
  // `devtools` mode.
  startCdpActiveTab({ onActiveTab: (tabId) => cdpAttachController.noteActiveTab(tabId) });

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
    setCdpScopeMode: (mode) => cdpAttachController.setScopeMode(mode),
    pinCdpTab: (tabId) => cdpAttachController.notePinned(tabId),
    unpinCdpTab: (tabId) => cdpAttachController.noteUnpinned(tabId),
  };
}
