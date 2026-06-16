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
  type CdpGetRequestPostData,
  type CdpGetResponseBody,
  type CdpRequestControlPort,
  type CdpRequestPostData,
  type CdpResponseBody,
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
  | { readonly kind: 'continue-with-auth'; readonly target: CdpSessionTarget; readonly request: CdpContinueWithAuth }
  | { readonly kind: 'get-response-body'; readonly target: CdpSessionTarget; readonly request: CdpGetResponseBody }
  | {
      readonly kind: 'get-request-post-data';
      readonly target: CdpSessionTarget;
      readonly request: CdpGetRequestPostData;
    };

/** A scripted answer for the next `getResponseBody` — a body or a rejection. */
type ScriptedResponseBody =
  | { readonly ok: true; readonly body: CdpResponseBody }
  | { readonly ok: false; readonly error: string };

/** A scripted answer for the next `getRequestPostData` — a body or a rejection. */
type ScriptedRequestPostData =
  | { readonly ok: true; readonly postData: CdpRequestPostData }
  | { readonly ok: false; readonly error: string };

export interface InMemoryRequestControlPort extends CdpRequestControlPort {
  /** Every reaction in call order. */
  readonly reactions: readonly RecordedReaction[];
  /** Queue the body the next `getResponseBody` resolves to (FIFO). */
  enqueueResponseBody(body: CdpResponseBody): void;
  /** Queue a rejection for the next `getResponseBody` (the unreadable-body path). */
  rejectNextResponseBody(error: string): void;
  /** Queue the body the next `getRequestPostData` resolves to (FIFO). */
  enqueueRequestPostData(postData: CdpRequestPostData): void;
  /** Queue a rejection for the next `getRequestPostData` (the unreadable-body path). */
  rejectNextRequestPostData(error: string): void;
}

/** Create an in-memory {@link CdpRequestControlPort} that records reactions. */
export function createInMemoryRequestControlPort(): InMemoryRequestControlPort {
  const reactions: RecordedReaction[] = [];
  const bodies: ScriptedResponseBody[] = [];
  const postDatas: ScriptedRequestPostData[] = [];

  return {
    available: true,
    reactions,
    enqueueResponseBody(body: CdpResponseBody): void {
      bodies.push({ ok: true, body });
    },
    rejectNextResponseBody(error: string): void {
      bodies.push({ ok: false, error });
    },
    enqueueRequestPostData(postData: CdpRequestPostData): void {
      postDatas.push({ ok: true, postData });
    },
    rejectNextRequestPostData(error: string): void {
      postDatas.push({ ok: false, error });
    },
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
    async getResponseBody(target: CdpSessionTarget, request: CdpGetResponseBody): Promise<CdpResponseBody> {
      reactions.push({ kind: 'get-response-body', target, request });
      // No scripted entry ⇒ an empty body (models a readable but body-less
      // reply), so the eval still runs rather than the request hanging.
      const scripted = bodies.shift() ?? { ok: true, body: { body: '', base64Encoded: false } };
      if (!scripted.ok) throw new Error(scripted.error);
      return scripted.body;
    },
    async getRequestPostData(target: CdpSessionTarget, request: CdpGetRequestPostData): Promise<CdpRequestPostData> {
      reactions.push({ kind: 'get-request-post-data', target, request });
      // No scripted entry ⇒ an empty body (the request-stage fallback only runs
      // when `hasPostData` flagged a body, so the default models a readable one).
      const scripted = postDatas.shift() ?? { ok: true, postData: { postData: '' } };
      if (!scripted.ok) throw new Error(scripted.error);
      return scripted.postData;
    },
  };
}
