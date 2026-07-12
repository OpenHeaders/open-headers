/**
 * `JsContextsClientStore` — panel-side mirror of the live JS
 * execution-context set arriving on the engine-side `oh-contexts:<tabId>`
 * port.
 *
 * Sibling of `ConsoleClientStore`, but replace-semantics live state instead
 * of an append log: `upsert` adds or replaces by `contextKey`, `remove`
 * deletes, `clear` empties (tab-cleared, or a reconnect's `ready` — the
 * replay that follows rebuilds the whole set, so clearing first can never
 * leave stale contexts behind).
 *
 * Snapshot identity is structurally stable: `getSnapshot()` returns the same
 * reference until a mutation actually changes state, so
 * `useSyncExternalStore` consumers short-circuit re-renders on upstream
 * noops (e.g. a `remove` for an unknown key).
 */

import type { JsContext } from '@openheaders/core/js-contexts';

import { createSnapshotPublisher } from './snapshot-publisher';

export interface JsContextsClientSnapshot {
  /** First-add ordered live set. Same identity until a real mutation. */
  readonly contexts: readonly JsContext[];
}

const EMPTY_SNAPSHOT: JsContextsClientSnapshot = Object.freeze({
  contexts: Object.freeze([]) as readonly JsContext[],
});

export class JsContextsClientStore {
  private contexts = new Map<string, JsContext>();
  private readonly pub = createSnapshotPublisher<JsContextsClientSnapshot>(
    () => ({ contexts: [...this.contexts.values()] }),
    EMPTY_SNAPSHOT,
  );

  upsert(context: JsContext): void {
    this.contexts.set(context.contextKey, context);
    this.pub.markDirty();
  }

  remove(contextKey: string): void {
    if (!this.contexts.delete(contextKey)) return;
    this.pub.markDirty();
  }

  clear(): void {
    if (this.contexts.size === 0) return;
    this.contexts = new Map();
    this.pub.markDirty();
  }

  readonly subscribe = this.pub.subscribe;
  readonly getSnapshot = this.pub.getSnapshot;
}
