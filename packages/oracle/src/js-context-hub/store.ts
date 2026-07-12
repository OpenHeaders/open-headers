/**
 * `JsContextStore` — per-tab live map of JavaScript execution contexts.
 *
 * Pure data. The hub owns one. Unlike `ConsoleStore` (bounded append log)
 * this holds LIVE state with replace semantics: `set` on an existing
 * `contextKey` replaces it, `remove` deletes it, and `clearSession` drops
 * every context of one CDP session (its `executionContextsCleared`, or the
 * session detaching). No cap — a tab's live context count is small by
 * construction (frames × worlds), not unbounded like a log.
 */

import { type JsContext, jsContextSessionPrefix } from '@openheaders/core/js-contexts';

export class JsContextStore {
  /** Per-tab live set, insertion-ordered by first add. */
  private readonly tabs = new Map<number, Map<string, JsContext>>();

  /** Add or replace a context. Returns `true` when state changed. */
  set(tabId: number, context: JsContext): boolean {
    let contexts = this.tabs.get(tabId);
    if (contexts === undefined) {
      contexts = new Map();
      this.tabs.set(tabId, contexts);
    }
    const prior = contexts.get(context.contextKey);
    if (prior !== undefined && jsContextEquals(prior, context)) return false;
    contexts.set(context.contextKey, context);
    return true;
  }

  /** Remove one context. Returns `true` when it existed. */
  remove(tabId: number, contextKey: string): boolean {
    const contexts = this.tabs.get(tabId);
    if (contexts === undefined) return false;
    const removed = contexts.delete(contextKey);
    if (removed && contexts.size === 0) this.tabs.delete(tabId);
    return removed;
  }

  /** Drop every context living on one session. Returns the removed keys. */
  clearSession(tabId: number, sessionKey: string): string[] {
    const contexts = this.tabs.get(tabId);
    if (contexts === undefined) return [];
    const prefix = jsContextSessionPrefix(sessionKey);
    const removed: string[] = [];
    for (const key of contexts.keys()) {
      if (key.startsWith(prefix)) removed.push(key);
    }
    for (const key of removed) contexts.delete(key);
    if (contexts.size === 0) this.tabs.delete(tabId);
    return removed;
  }

  /** Drop a tab's set. Returns `true` when state existed (hub uses this to
   *  gate the `tab-cleared` broadcast). */
  forgetTab(tabId: number): boolean {
    return this.tabs.delete(tabId);
  }

  /** Read-only snapshot in insertion order — used for replay. */
  snapshotTab(tabId: number): readonly JsContext[] {
    const contexts = this.tabs.get(tabId);
    return contexts === undefined ? EMPTY : [...contexts.values()];
  }
}

/** Field-wise equality — contexts are flat, so this gates no-op re-adds
 *  (the enable replaying an already-known context) out of the broadcast. */
function jsContextEquals(a: JsContext, b: JsContext): boolean {
  return (
    a.contextKey === b.contextKey &&
    a.origin === b.origin &&
    a.name === b.name &&
    a.isDefault === b.isDefault &&
    a.frameId === b.frameId &&
    a.targetKind === b.targetKind &&
    a.worldType === b.worldType
  );
}

const EMPTY: readonly JsContext[] = Object.freeze([]) as readonly JsContext[];
