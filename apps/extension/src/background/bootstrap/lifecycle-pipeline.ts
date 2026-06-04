import { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RuleFireHub } from '@openheaders/oracle/rule-fire-hub';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { startLifecycleHost } from '../correlator-host';
import { startDevtoolsSessionCoordinator } from '../devtools-session-coordinator';
import { createPersistentWatchSessionFloors, startLifecyclePortHost } from '../lifecycle-port-host';
import { setupOnRuleMatchedDebugBridge } from '../modules/on-rule-matched-debug';
import { startTabTelemetryFiresBridge } from '../modules/tab-telemetry-fires-bridge';
import { startDevtoolsPageNavBridge, startPagePortHost } from '../page-port-host';
import { startResourceTimingRelay } from '../resource-timing-relay';
import { startRuleEngineDriver } from '../rule-engine-driver';
import { startRuleFirePortHost } from '../rule-fire-port-host';
import { startTabTelemetrySource } from '../tab-telemetry-source';
import { debouncedUpdateBadge } from './badge-update';

interface LifecyclePipelineHandles {
  lifecycleStore: ReturnType<typeof startLifecycleHost>['store'];
}

export function startLifecyclePipeline(): LifecyclePipelineHandles {
  const tabLifecycleBus = new TabLifecycleBus();
  const lifecycleHost = startLifecycleHost({ bus: tabLifecycleBus });
  startRuleEngineDriver({ store: lifecycleHost.store, updateBadge: debouncedUpdateBadge, bus: tabLifecycleBus });
  startTabTelemetrySource({ store: lifecycleHost.store, bus: tabLifecycleBus });

  // Watch-session floors persist per-tab so a panel reconnect/remount (or
  // an SW restart) restores the session rather than dropping in-flight rows.
  const sessionFloors = createPersistentWatchSessionFloors();
  const lifecycleHub = new RequestLifecycleHub({
    store: lifecycleHost.store,
    bus: tabLifecycleBus,
    sessionFloors,
  });
  startLifecyclePortHost({ hub: lifecycleHub, ready: sessionFloors.ready });

  const pageHub = new PageStreamHub({ bus: tabLifecycleBus });
  startPagePortHost({ hub: pageHub });
  startDevtoolsPageNavBridge({ hub: pageHub });

  // Memory-cache rows: renderer cache hits never reach `webRequest`/HAR,
  // so they ride a separate Resource Timing snapshot feed reconciled
  // panel-local (`oh-rt:<tabId>`).
  const resourceTimingHost = startResourceTimingRelay({ bus: tabLifecycleBus });

  // Per-DevTools-session reset: a genuine reopen advances the lifecycle
  // floor and drops the prior session's cached Resource Timing groups, so
  // close/reopen in the same browser tab starts a clean log (Chrome parity).
  startDevtoolsSessionCoordinator({ hub: lifecycleHub, relay: resourceTimingHost.relay });

  const ruleFireHub = new RuleFireHub({ bus: tabLifecycleBus });
  startRuleFirePortHost({ hub: ruleFireHub });
  const firesBridge = startTabTelemetryFiresBridge({ hub: ruleFireHub });

  setupOnRuleMatchedDebugBridge({
    onAuthoritativeFire: (tabId, record) => firesBridge.notifyAuthoritativeFire(tabId, record),
  });

  return { lifecycleStore: lifecycleHost.store };
}
