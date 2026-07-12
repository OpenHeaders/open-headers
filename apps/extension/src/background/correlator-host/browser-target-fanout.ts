/**
 * Browser-target → per-tab fanout (JS contexts Phase B). The target plane's
 * events carry no `tabId`; this binder resolves each against the
 * reconciler's committed owner mapping and fans it to every owning tab's
 * hubs — a service worker serving N attached tabs surfaces in all N
 * streams, matching the browser's own page console.
 *
 * It keeps a live-context **mirror** per target because ownership and
 * context lifetime move independently: the `Runtime.enable` replay seeds
 * contexts only once per attachment, but a tab can join a worker's
 * owner-set later (navigation into the origin, a new tab attaching). The
 * mirror is what an owner joining mid-attachment is seeded from; an owner
 * leaving gets the target's session subset cleared. Console entries are
 * history, not live state — a late joiner starts at the join (no backfill).
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';
import type { JsContext } from '@openheaders/core/js-contexts';
import type { BrowserTargetOwnersListener } from './browser-target-attach-controller';
import { type BrowserTargetJsContextEvent, browserTargetSessionKey } from './browser-target-source';

interface FanoutSourceRef {
  subscribeContexts(listener: (event: BrowserTargetJsContextEvent) => void): () => void;
  subscribeConsole(listener: (targetId: string, entry: ConsoleEntry) => void): () => void;
}

interface FanoutControllerRef {
  ownersOf(targetId: string): readonly number[];
  onOwnersChanged(listener: BrowserTargetOwnersListener): () => void;
}

/** The slice of `JsContextHub` the fanout feeds. */
interface JsContextsSink {
  recordCreated(tabId: number, context: JsContext): void;
  recordDestroyed(tabId: number, contextKey: string): void;
  clearSession(tabId: number, sessionKey: string): void;
}

/** The slice of `ConsoleStreamHub` the fanout feeds. */
interface ConsoleSink {
  recordEntry(tabId: number, entry: ConsoleEntry): void;
}

export interface BrowserTargetFanoutOptions {
  readonly source: FanoutSourceRef;
  readonly controller: FanoutControllerRef;
  readonly contexts: JsContextsSink;
  readonly console: ConsoleSink;
}

export interface BrowserTargetFanout {
  dispose(): void;
}

export function startBrowserTargetFanout(options: BrowserTargetFanoutOptions): BrowserTargetFanout {
  const { source, controller, contexts, console: consoleSink } = options;
  /** Live contexts per target — the seed for owners joining mid-attachment. */
  const mirror = new Map<string, Map<string, JsContext>>();

  const offContexts = source.subscribeContexts((event) => {
    switch (event.kind) {
      case 'context-created': {
        const live = mirror.get(event.targetId) ?? new Map<string, JsContext>();
        live.set(event.context.contextKey, event.context);
        mirror.set(event.targetId, live);
        for (const tabId of controller.ownersOf(event.targetId)) contexts.recordCreated(tabId, event.context);
        break;
      }
      case 'context-destroyed': {
        mirror.get(event.targetId)?.delete(event.contextKey);
        for (const tabId of controller.ownersOf(event.targetId)) contexts.recordDestroyed(tabId, event.contextKey);
        break;
      }
      case 'target-cleared': {
        mirror.delete(event.targetId);
        const sessionKey = browserTargetSessionKey(event.targetId);
        for (const tabId of controller.ownersOf(event.targetId)) contexts.clearSession(tabId, sessionKey);
        break;
      }
    }
  });

  const offConsole = source.subscribeConsole((targetId, entry) => {
    for (const tabId of controller.ownersOf(targetId)) consoleSink.recordEntry(tabId, entry);
  });

  const offOwners = controller.onOwnersChanged((targetId, added, removed) => {
    const live = mirror.get(targetId);
    if (live !== undefined && live.size > 0) {
      for (const tabId of added) {
        for (const context of live.values()) contexts.recordCreated(tabId, context);
      }
    }
    if (removed.length > 0) {
      const sessionKey = browserTargetSessionKey(targetId);
      for (const tabId of removed) contexts.clearSession(tabId, sessionKey);
    }
  });

  return {
    dispose(): void {
      offContexts();
      offConsole();
      offOwners();
      mirror.clear();
    },
  };
}
