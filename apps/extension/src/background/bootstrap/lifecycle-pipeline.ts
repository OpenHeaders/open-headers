import { PageStreamHub } from '@openheaders/oracle/page-stream-hub';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RuleFireHub } from '@openheaders/oracle/rule-fire-hub';
import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { startLifecycleHost } from '../correlator-host';
import { startLifecyclePortHost } from '../lifecycle-port-host';
import { setupOnRuleMatchedDebugBridge } from '../modules/on-rule-matched-debug';
import { startDevtoolsPageNavBridge, startPagePortHost } from '../page-port-host';
import { startRuleEngineDriver } from '../rule-engine-driver';
import { startRuleFirePortHost } from '../rule-fire-port-host';
import { startTabTelemetryFiresBridge } from '../modules/tab-telemetry-fires-bridge';
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

  const lifecycleHub = new RequestLifecycleHub({ store: lifecycleHost.store, bus: tabLifecycleBus });
  startLifecyclePortHost({ hub: lifecycleHub });

  const pageHub = new PageStreamHub({ bus: tabLifecycleBus });
  startPagePortHost({ hub: pageHub });
  startDevtoolsPageNavBridge({ hub: pageHub });

  const ruleFireHub = new RuleFireHub({ bus: tabLifecycleBus });
  startRuleFirePortHost({ hub: ruleFireHub });
  const firesBridge = startTabTelemetryFiresBridge({ hub: ruleFireHub });

  setupOnRuleMatchedDebugBridge({
    onAuthoritativeFire: (tabId, record) => firesBridge.notifyAuthoritativeFire(tabId, record),
  });

  return { lifecycleStore: lifecycleHost.store };
}
