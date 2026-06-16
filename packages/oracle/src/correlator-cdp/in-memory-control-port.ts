/**
 * In-memory adapters for the CDP control ports — the host-neutral test
 * doubles, mirroring `./scheduling/in-memory-timer` on the control side.
 * They record what was applied / reacted so tests can assert the
 * control-plane contract (replay-on-reattach, reconcile output) without a
 * `chrome.debugger` transport.
 *
 * The tab-control double runs the real {@link reconcileTabControl} against
 * its own remembered per-target state, so each recorded `apply` carries the
 * exact command set the chrome executor would issue — and `forget` resets
 * that memory exactly as a detach does on the live path.
 */

import {
  type CdpContinueRequest,
  type CdpContinueResponse,
  type CdpContinueWithAuth,
  type CdpControlCommand,
  type CdpFulfillResponse,
  type CdpRequestControlPort,
  type CdpSessionTarget,
  type CdpTabControlPort,
  type CdpTabControlState,
  EMPTY_TAB_CONTROL_STATE,
  reconcileTabControl,
} from './control-port';

function targetKey(target: CdpSessionTarget): string {
  return `${target.tabId}:${target.sessionId}`;
}

/** One recorded `apply` — the target, the state, and the reconciled commands. */
export interface RecordedTabControl {
  readonly target: CdpSessionTarget;
  readonly state: CdpTabControlState;
  readonly commands: readonly CdpControlCommand[];
}

export interface InMemoryTabControlPort extends CdpTabControlPort {
  /** Every `apply` in call order. */
  readonly applied: readonly RecordedTabControl[];
  /** Every `forget` target in call order. */
  readonly forgotten: readonly CdpSessionTarget[];
}

/** Create an in-memory {@link CdpTabControlPort} that records applies/forgets. */
export function createInMemoryTabControlPort(): InMemoryTabControlPort {
  const lastApplied = new Map<string, CdpTabControlState>();
  const applied: RecordedTabControl[] = [];
  const forgotten: CdpSessionTarget[] = [];

  return {
    available: true,
    applied,
    forgotten,
    async apply(target: CdpSessionTarget, state: CdpTabControlState): Promise<void> {
      const key = targetKey(target);
      const prev = lastApplied.get(key) ?? EMPTY_TAB_CONTROL_STATE;
      const commands = reconcileTabControl(prev, state);
      lastApplied.set(key, state);
      applied.push({ target, state, commands });
    },
    forget(target: CdpSessionTarget): void {
      lastApplied.delete(targetKey(target));
      forgotten.push(target);
    },
  };
}

/** One recorded per-request reaction. */
export type RecordedReaction =
  | { readonly kind: 'fulfill'; readonly target: CdpSessionTarget; readonly response: CdpFulfillResponse }
  | { readonly kind: 'continue'; readonly target: CdpSessionTarget; readonly request: CdpContinueRequest }
  | { readonly kind: 'continue-response'; readonly target: CdpSessionTarget; readonly request: CdpContinueResponse }
  | { readonly kind: 'continue-with-auth'; readonly target: CdpSessionTarget; readonly request: CdpContinueWithAuth };

export interface InMemoryRequestControlPort extends CdpRequestControlPort {
  /** Every reaction in call order. */
  readonly reactions: readonly RecordedReaction[];
}

/** Create an in-memory {@link CdpRequestControlPort} that records reactions. */
export function createInMemoryRequestControlPort(): InMemoryRequestControlPort {
  const reactions: RecordedReaction[] = [];

  return {
    available: true,
    reactions,
    async fulfill(target: CdpSessionTarget, response: CdpFulfillResponse): Promise<void> {
      reactions.push({ kind: 'fulfill', target, response });
    },
    async continueRequest(target: CdpSessionTarget, request: CdpContinueRequest): Promise<void> {
      reactions.push({ kind: 'continue', target, request });
    },
    async continueResponse(target: CdpSessionTarget, request: CdpContinueResponse): Promise<void> {
      reactions.push({ kind: 'continue-response', target, request });
    },
    async continueWithAuth(target: CdpSessionTarget, request: CdpContinueWithAuth): Promise<void> {
      reactions.push({ kind: 'continue-with-auth', target, request });
    },
  };
}
