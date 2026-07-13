/**
 * Chrome adapter for the oracle {@link CdpEvalPort} — runs a rule's dynamic
 * body (user JS) in a per-frame isolated world over the shared
 * {@link CdpSessionSender} (Phase D2b-2). Maps `callInIsolatedWorld` onto
 * `Page.createIsolatedWorld` (cached per `(tabId,sessionId,frameId)`, lazily
 * recreated when the cached context is gone after a navigation) +
 * `Runtime.callFunctionOn` (`awaitPromise` — the user fn may be async;
 * `returnByValue` — the wrapper returns a string). Never throws: a fault,
 * timeout, or unreachable world resolves to `{ok:false}` so the interceptor
 * releases the paused request instead of hanging it.
 */

import type { CdpEvalArg, CdpEvalOutcome, CdpEvalPort, CdpSessionTarget } from '@openheaders/oracle/correlator-cdp';
import type { CdpSessionSender } from './cdp-session-sender';

/** Walltime ceiling for one eval — a user fn that hangs must not pin the
 *  paused request open indefinitely. */
const EVAL_TIMEOUT_MS = 5000;

/** Backstop on cached isolated worlds; a still-valid evicted entry is just
 *  recreated on its next call (cheap), so FIFO eviction is always safe. */
const MAX_ISOLATED_WORLDS = 256;

const ISOLATED_WORLD_NAME = 'OpenHeadersDebug';

export class ChromeCdpEvalPort implements CdpEvalPort {
  private readonly sender: CdpSessionSender;
  /** `(tabId:sessionId:frameId)` → isolated-world executionContextId. */
  private readonly contexts = new Map<string, number>();

  constructor(sender: CdpSessionSender) {
    this.sender = sender;
  }

  get available(): boolean {
    return this.sender.cdpAvailable;
  }

  async callInIsolatedWorld(
    target: CdpSessionTarget,
    frameId: string,
    functionDeclaration: string,
    arg: CdpEvalArg,
  ): Promise<CdpEvalOutcome> {
    try {
      return await this.withTimeout(this.run(target, frameId, functionDeclaration, arg));
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async run(
    target: CdpSessionTarget,
    frameId: string,
    functionDeclaration: string,
    arg: CdpEvalArg,
  ): Promise<CdpEvalOutcome> {
    const contextId = await this.contextFor(target, frameId);
    try {
      return await this.callOn(target, contextId, functionDeclaration, arg);
    } catch {
      // Any first callFunctionOn failure is treated as a torn-down isolated
      // world (a navigation invalidates the cached context, and Chrome's
      // wording for that is not contractual) — drop it, recreate once, and
      // retry. A still-valid world is cheap to recreate, so an over-eager
      // recreate is safe; a second failure is a genuine fault.
      this.contexts.delete(key(target, frameId));
      const fresh = await this.createWorld(target, frameId);
      return await this.callOn(target, fresh, functionDeclaration, arg);
    }
  }

  private async contextFor(target: CdpSessionTarget, frameId: string): Promise<number> {
    const cached = this.contexts.get(key(target, frameId));
    if (cached !== undefined) return cached;
    return this.createWorld(target, frameId);
  }

  private async createWorld(target: CdpSessionTarget, frameId: string): Promise<number> {
    const res = await this.sender.sendOnSession(target.tabId, target.sessionId, 'Page.createIsolatedWorld', {
      frameId,
      worldName: ISOLATED_WORLD_NAME,
    });
    const contextId = (res as { executionContextId?: unknown } | null)?.executionContextId;
    if (typeof contextId !== 'number') {
      throw new Error('Page.createIsolatedWorld returned no executionContextId');
    }
    this.remember(key(target, frameId), contextId);
    return contextId;
  }

  private async callOn(
    target: CdpSessionTarget,
    contextId: number,
    functionDeclaration: string,
    arg: CdpEvalArg,
  ): Promise<CdpEvalOutcome> {
    const res = await this.sender.sendOnSession(target.tabId, target.sessionId, 'Runtime.callFunctionOn', {
      functionDeclaration,
      executionContextId: contextId,
      arguments: [{ value: arg }],
      awaitPromise: true,
      returnByValue: true,
    });
    return interpret(res);
  }

  private remember(mapKey: string, contextId: number): void {
    if (this.contexts.size >= MAX_ISOLATED_WORLDS) {
      const oldest = this.contexts.keys().next().value;
      if (oldest !== undefined) this.contexts.delete(oldest);
    }
    this.contexts.set(mapKey, contextId);
  }

  private withTimeout<T>(p: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('eval timed out')), EVAL_TIMEOUT_MS);
      p.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    });
  }
}

function key(target: CdpSessionTarget, frameId: string): string {
  return `${target.tabId}:${target.sessionId}:${frameId}`;
}

/** Read a `Runtime.callFunctionOn` result: a thrown user fn surfaces in
 *  `exceptionDetails`; otherwise `result.value` is the wrapper's returned
 *  string (the realm-local stringify already ran). */
function interpret(res: unknown): CdpEvalOutcome {
  if (typeof res !== 'object' || res === null) return { ok: false, error: 'unexpected callFunctionOn shape' };
  const shaped = res as {
    exceptionDetails?: { text?: string; exception?: { description?: string } };
    result?: { value?: unknown };
  };
  if (shaped.exceptionDetails) {
    const text = shaped.exceptionDetails.exception?.description ?? shaped.exceptionDetails.text ?? 'eval threw';
    return { ok: false, error: text };
  }
  const value = shaped.result?.value;
  if (typeof value !== 'string') return { ok: false, error: 'eval did not return a string' };
  return { ok: true, value };
}
