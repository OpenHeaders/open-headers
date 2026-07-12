/**
 * `JsContextHub` — per-tab broadcaster for the live JS execution-context set.
 *
 * Sibling of `ConsoleStreamHub`, but the store is a per-tab map with replace
 * semantics (live state), not an append log: `recordCreated` upserts (and
 * short-circuits a field-identical re-add — the standing `Runtime.enable`
 * replays already-live contexts on every attach), `recordDestroyed` removes,
 * `clearSession` drops one CDP session's whole set (its
 * `executionContextsCleared`, or the session detaching — each removal
 * broadcast individually so the consumer reducer stays two-variant).
 *
 * `forgetTab(tabId)` drops the tab's set and broadcasts `'tab-cleared'` —
 * driven by `TabLifecycleBus` on tab close AND by the adapter on CDP detach
 * (unlike the console log, which outlives detach as history, the context set
 * is live state and dies with the attachment).
 *
 * Replay: `attach` delivers `ready` then re-emits the live set as
 * `'context-added'` updates synchronously (same single-threaded guarantee as
 * the console hub). Failure isolation via `TabSinkRegistry` per-sink catch.
 */

import type { JsContext, JsContextUpdate } from '@openheaders/core/js-contexts';

import type { TabLifecycleBus } from '../tab-lifecycle-bus';
import { TabSinkRegistry } from '../tab-sink-registry';

import { snapshotToUpdates } from './replay';
import { JsContextStore } from './store';
import type { AttachmentHandle, Sink } from './types';

export interface JsContextHubOptions {
  readonly bus?: TabLifecycleBus;
}

export class JsContextHub {
  private readonly store = new JsContextStore();
  private readonly registry = new TabSinkRegistry<JsContextUpdate>('JsContextHub');
  private readonly unsubscribeBus: (() => void) | null;

  constructor(options: JsContextHubOptions = {}) {
    this.unsubscribeBus = options.bus
      ? options.bus.subscribe((event) => {
          if (event.kind === 'tab-forgotten') this.forgetTab(event.tabId);
        })
      : null;
  }

  /** Engine input — a context came alive (or was replayed by the enable).
   *  Upserts; a field-identical re-add is a no-op (no broadcast). */
  recordCreated(tabId: number, context: JsContext): void {
    this.registry.guardDisposed();
    if (!this.store.set(tabId, context)) return;
    this.registry.broadcast(tabId, { kind: 'context-added', tabId, context });
  }

  /** Engine input — a context died. Unknown keys are a no-op. */
  recordDestroyed(tabId: number, contextKey: string): void {
    this.registry.guardDisposed();
    if (!this.store.remove(tabId, contextKey)) return;
    this.registry.broadcast(tabId, { kind: 'context-removed', tabId, contextKey });
  }

  /** Engine input — one CDP session's contexts all died
   *  (`executionContextsCleared`, or the session detached). */
  clearSession(tabId: number, sessionKey: string): void {
    this.registry.guardDisposed();
    for (const contextKey of this.store.clearSession(tabId, sessionKey)) {
      this.registry.broadcast(tabId, { kind: 'context-removed', tabId, contextKey });
    }
  }

  forgetTab(tabId: number): void {
    this.registry.guardDisposed();
    if (!this.store.forgetTab(tabId)) return;
    this.registry.broadcast(tabId, { kind: 'tab-cleared', tabId });
  }

  /** Read-only snapshot — exposed for tests + parity tooling. */
  snapshotTab(tabId: number): readonly JsContext[] {
    return this.store.snapshotTab(tabId);
  }

  attach(tabId: number, sink: Sink): AttachmentHandle {
    return this.registry.attach(tabId, sink, (s) => {
      s.deliverReady(tabId);
      for (const update of snapshotToUpdates(tabId, this.store.snapshotTab(tabId))) {
        s.deliverUpdate(update);
      }
    });
  }

  dispose(): void {
    this.unsubscribeBus?.();
    this.registry.dispose();
  }
}
