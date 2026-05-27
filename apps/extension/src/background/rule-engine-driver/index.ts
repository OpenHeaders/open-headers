/**
 * Rule Engine Driver — in-process consumer of `RequestLifecycleStore`
 * that owns the rule-engine-facing side of what `request-monitor` used
 * to do: tracked-URL ingestion, observed-fire arbitration, badge
 * triggering, and tab-nav cleanup.
 *
 * One of two in-process subscribers of the lifecycle pipeline; the
 * other is `tab-telemetry-source/`. Together they replace the deleted
 * `request-monitor.ts`; invariant 7a (no rule-engine module subscribes
 * to `chrome.webRequest.*` directly) holds once both are wired.
 *
 * Also subscribes to the cross-driver `TabLifecycleBus` so it can drop
 * a tab's tracked-URL set on `tab-forgotten` without the bridge calling
 * us directly. Typed mutator for `tabsWithActiveRules` arrives in
 * session 53 — raw Map.delete call for now.
 */

import { logger } from '@utils/logger';
import type { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import type { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';

import { tabsWithActiveRules } from '../modules/request-tracker';
import { type UpdateBadge } from './badge-trigger';
import { installLifecycleSubscription } from './lifecycle-subscription';
import { installNavCleanup } from './nav-cleanup';

export interface RuleEngineDriverOptions {
  readonly store: RequestLifecycleStore;
  readonly updateBadge: UpdateBadge;
  readonly bus: TabLifecycleBus;
}

export interface RuleEngineDriverHandle {
  dispose(): void;
}

export function startRuleEngineDriver(options: RuleEngineDriverOptions): RuleEngineDriverHandle {
  const detachStore = installLifecycleSubscription(options);
  const detachNav = installNavCleanup(options);
  const detachBus = options.bus.subscribe((event) => {
    if (event.kind !== 'tab-forgotten') return;
    tabsWithActiveRules.delete(event.tabId);
  });
  logger.info('RuleEngineDriver', 'rule-engine driver online');
  return {
    dispose: () => {
      detachStore();
      detachNav();
      detachBus();
    },
  };
}
