/**
 * The host implementation of the attach controller's {@link CdpControlReplay}
 * seam (§4.6). On every (re-)attach it `apply`s the tab's derived standing
 * CDP control state to the root session through the {@link CdpTabControlPort};
 * on detach it `forget`s it. The desired state is recomputed from canonical
 * rules + arming by `deriveState` — never restored from cached imperative
 * state, so nothing survives a detach.
 *
 * `apply` is fire-and-forget here: a control-command failure must not knock
 * the tab off its committed CDP attachment, so a rejection is logged and
 * swallowed. `deriveState` returns {@link EMPTY_TAB_CONTROL_STATE} until
 * Phases D/F compile debug rules into CDP state.
 */

import type { CdpTabControlPort, CdpTabControlState } from '@openheaders/oracle/correlator-cdp';
import { logger } from '@utils/logger';
import type { CdpControlReplay } from './cdp-attach-controller';
import { cdpRootTarget } from './chrome-debugger-source';

export interface CdpControlReplayOptions {
  readonly tabControlPort: CdpTabControlPort;
  /**
   * The tab's desired standing CDP control state, derived from canonical
   * rules + arming. Empty until Phase D/F compile debug rules to CDP state.
   */
  readonly deriveState: (tabId: number) => CdpTabControlState;
}

export function createCdpControlReplay(options: CdpControlReplayOptions): CdpControlReplay {
  const { tabControlPort, deriveState } = options;
  return {
    replay(tabId: number): void {
      void tabControlPort.apply(cdpRootTarget(tabId), deriveState(tabId)).catch((err: unknown) => {
        logger.debug('CdpControlReplay', 'apply failed', {
          tabId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    },
    release(tabId: number): void {
      tabControlPort.forget(cdpRootTarget(tabId));
    },
  };
}
