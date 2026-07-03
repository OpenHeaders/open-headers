import { logger } from '@openheaders/core/utils';
import { onEnvironmentStoreChange } from '../../entity/environment-store';
import { onRequestStoreChange } from '../../entity/request-store';
import { onActiveWorkspaceChange } from '../../workspace/extension-workspace-store';
import { onLiveCacheStoreChange } from '../live-cache-store';
import { onLiveVariableStoreChange } from '../live-variable-store';
import { onLiveWorkflowStoreChange } from '../live-workflow-store';
import {
  onLiveCacheChangeForCascade,
  pendingCascadeUpstreams,
  resetLiveCascadeDetector,
  settleLiveValueCascade,
} from './live-cascade';
import { onRequestStoreChangeForRefresh, resetRequestEditDetector } from './request-edit';
import { LOG, type RefreshNow, setRefreshNow } from './shared';
import { onVariableStoreChangeForRefresh, resetVariableEditDetector } from './variable-edit';
import { __resetWorkflowDefinitionBaseline, settleWorkflowDefinitionChanges } from './workflow-definition';

// ── Lifecycle ─────────────────────────────────────────────────────

let unsubscribers: Array<() => void> = [];
let started = false;

/**
 * Start the definitional-freshness detectors. Subscribes to the
 * host-neutral oracle store events and wires the host's `refreshNow`
 * seam. Idempotent — a second call is a no-op. Returns nothing; tear
 * down via {@link stopDefinitionalFreshness}.
 */
export function startDefinitionalFreshness(deps: { refreshNow: RefreshNow }): void {
  if (started) return;
  started = true;
  setRefreshNow(deps.refreshNow);
  unsubscribers = [
    // A workflow-store change drives LF3 (delete + definition edit). A
    // definition edit can re-point a step at a different request,
    // shifting the variable-surface `refsKey` — re-baseline LF2 (no
    // trigger; a `refsKey` shift is LF1's path) so a later variable edit
    // isn't masked.
    onLiveWorkflowStoreChange(() => {
      void settleWorkflowDefinitionChanges().catch((err) => {
        logger.info(LOG, `workflow-definition settle failed: ${(err as Error).message}`);
      });
      onVariableStoreChangeForRefresh();
    }),
    // A live-variable binding change can alter which workflow a value
    // resolves through — re-diff the variable surface (LF2).
    onLiveVariableStoreChange(onVariableStoreChangeForRefresh),
    // A live-cache change drives the LF4 chained-workflow cascade.
    onLiveCacheStoreChange(onLiveCacheChangeForCascade),
    // A request edit drives LF1 (material executable-surface change) and
    // LF2 (a `{{collection.X}}` value behind a collection-variable edit).
    onRequestStoreChange(() => {
      onRequestStoreChangeForRefresh();
      onVariableStoreChangeForRefresh();
    }),
    // An env / vault / workspace-variable edit changes the value behind
    // an `{{env.X}}` / `{{vault.X}}` / `{{workspace.X}}` reference (LF2).
    onEnvironmentStoreChange(onVariableStoreChangeForRefresh),
    // A chained-workflow cascade detected just before a switch away stays
    // queued in its per-workspace bucket; drain it once that workspace is
    // active again so a pre-switch cascade is never lost.
    onActiveWorkspaceChange((newWsId) => {
      if ((pendingCascadeUpstreams.get(newWsId)?.length ?? 0) > 0) {
        void settleLiveValueCascade().catch((err) => {
          logger.info(LOG, `deferred cascade settle after workspace switch failed: ${(err as Error).message}`);
        });
      }
    }),
  ];
}

/** Tear down all subscriptions + reset detector state. Idempotent. */
export function stopDefinitionalFreshness(): void {
  if (!started) return;
  started = false;
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];
  setRefreshNow(null);
  resetRequestEditDetector();
  resetVariableEditDetector();
  __resetWorkflowDefinitionBaseline();
  resetLiveCascadeDetector();
}
