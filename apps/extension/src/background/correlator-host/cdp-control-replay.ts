/**
 * The host implementation of the attach controller's {@link CdpControlReplay}
 * seam (§4.6). On every (re-)attach it `apply`s the tab's derived standing
 * CDP control state through the {@link CdpTabControlPort}; on detach it
 * `forget`s it. The desired state is recomputed from canonical rules + arming
 * by `deriveState` — never restored from cached imperative state, so nothing
 * survives a detach.
 *
 * Fans across sessions (Phase D2). The standing state — `Fetch.enable`
 * patterns above all — is applied to the root page target AND every kept
 * child session (workers / OOPIFs), so interception reaches all of a tab's
 * traffic, not just the page context. {@link CdpControlReplayController}
 * additionally exposes per-child apply/forget for children that attach or
 * detach DURING a tab's attached lifetime (driven by the debugger source's
 * child-session observers).
 *
 * `apply` is fire-and-forget: a control-command failure must not knock the
 * tab off its committed CDP attachment, so a rejection is logged and
 * swallowed. `deriveState` returns {@link EMPTY_TAB_CONTROL_STATE} for an
 * un-armed tab (and until Phase D/F compile debug rules to CDP state).
 */

import type { CdpSessionTarget, CdpTabControlPort, CdpTabControlState } from '@openheaders/oracle/correlator-cdp';
import { logger } from '@utils/logger';
import type { CdpControlReplay } from './cdp-attach-controller';
import { cdpRootTarget } from './chrome-debugger-source';

export interface CdpControlReplayOptions {
  readonly tabControlPort: CdpTabControlPort;
  /**
   * The tab's desired standing CDP control state, derived from canonical
   * rules + arming. Empty for an un-armed tab.
   */
  readonly deriveState: (tabId: number) => CdpTabControlState;
  /** The kept child session ids for a tab (workers / OOPIFs). */
  readonly childSessionsOf: (tabId: number) => readonly string[];
}

/**
 * The replay seam plus the per-child hooks the debugger source's
 * `onChildAttached` / `onChildDetached` observers drive.
 */
export interface CdpControlReplayController extends CdpControlReplay {
  /** Apply the tab's derived state to a newly-attached child session. */
  applyChild(tabId: number, sessionId: string): void;
  /** Drop a detached child session's remembered applied state. */
  forgetChild(tabId: number, sessionId: string): void;
}

export function createCdpControlReplay(options: CdpControlReplayOptions): CdpControlReplayController {
  const { tabControlPort, deriveState, childSessionsOf } = options;

  const apply = (target: CdpSessionTarget, state: CdpTabControlState, tabId: number): void => {
    void tabControlPort.apply(target, state).catch((err: unknown) => {
      logger.debug('CdpControlReplay', 'apply failed', {
        tabId,
        sessionId: target.sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  };

  return {
    replay(tabId: number): void {
      const state = deriveState(tabId);
      apply(cdpRootTarget(tabId), state, tabId);
      for (const sessionId of childSessionsOf(tabId)) apply({ tabId, sessionId }, state, tabId);
    },
    release(tabId: number): void {
      tabControlPort.forget(cdpRootTarget(tabId));
      for (const sessionId of childSessionsOf(tabId)) tabControlPort.forget({ tabId, sessionId });
    },
    applyChild(tabId: number, sessionId: string): void {
      apply({ tabId, sessionId }, deriveState(tabId), tabId);
    },
    forgetChild(tabId: number, sessionId: string): void {
      tabControlPort.forget({ tabId, sessionId });
    },
  };
}
