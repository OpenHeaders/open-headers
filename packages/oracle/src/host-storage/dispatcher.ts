/**
 * Transport-agnostic dispatcher for the wire-level host-storage protocol.
 *
 * Wraps any {@link HostStorage} backend and exposes a small set of
 * `handle*` methods plus a per-client subscription registry. The Electron
 * IPC binding (`apps/desktop/src/main/install-host-storage.ts`) wraps it
 * in `ipcMain.handle('oh:storage:*')` + `webContents.send` fan-out. A
 * future WebSocket-server binding (commit 9 / a Mode-2 daemon) wraps the
 * same dispatcher around `ws.on('message')` + per-connection `send`.
 *
 * Wire-side responsibilities owned here, NOT by transport wrappers:
 *
 *   1. Per-client subscription bookkeeping — only clients that registered
 *      interest in a key receive its `change` events. Avoids broadcast
 *      spam that becomes a real cost under N WS clients.
 *   2. Per-key monotonic sequence numbers. Every write increments the
 *      counter for the affected key; `change` events carry the new seq.
 *      Subscribers reconnecting (e.g. WS resync) can pass `lastSeenSeq`
 *      on `subscribe` and receive an immediate replay if the current
 *      seq is higher.
 *   3. Sensitivity routing. The wire carries key strings only; the
 *      dispatcher reconstructs `StorageKey` specs via
 *      {@link isSensitiveKey} (authoritative server-side predicate).
 *      Renderers can't downgrade a sensitive slot by misreporting.
 */

import { isSensitiveKey } from '@openheaders/core/storage';
import type { HostStorage, StorageKey } from '@openheaders/core/storage';

type ClientId = string | number;

export interface StorageChangeEvent {
  key: string;
  value: unknown;
  seq: number;
}

export interface StorageGetRequest {
  key: string;
}
export interface StorageGetResponse {
  value: unknown;
  seq: number;
}

export interface StorageSetRequest {
  key: string;
  value: unknown;
}
export interface StorageSetResponse {
  seq: number;
}

export interface StorageGetManyRequest {
  keys: string[];
}
export interface StorageGetManyResponse {
  entries: Array<{ key: string; value: unknown; seq: number }>;
}

export interface StorageSetManyRequest {
  writes: Array<{ key: string; value: unknown }>;
}
export interface StorageSetManyResponse {
  seqs: Array<{ key: string; seq: number }>;
}

export interface StorageRemoveRequest {
  keys: string[];
}
export interface StorageRemoveResponse {
  seqs: Array<{ key: string; seq: number }>;
}

export interface StorageSubscribeRequest {
  key: string;
  lastSeenSeq?: number;
}
export interface StorageSubscribeResponse {
  value: unknown;
  seq: number;
  /** True when the caller's `lastSeenSeq` is behind the dispatcher's current seq. */
  stale: boolean;
}

export interface StorageUnsubscribeRequest {
  key: string;
}

export interface HostStorageDispatcher {
  handleGet(clientId: ClientId, req: StorageGetRequest): Promise<StorageGetResponse>;
  handleSet(clientId: ClientId, req: StorageSetRequest): Promise<StorageSetResponse>;
  handleGetMany(clientId: ClientId, req: StorageGetManyRequest): Promise<StorageGetManyResponse>;
  handleSetMany(clientId: ClientId, req: StorageSetManyRequest): Promise<StorageSetManyResponse>;
  handleRemove(clientId: ClientId, req: StorageRemoveRequest): Promise<StorageRemoveResponse>;
  handleSubscribe(clientId: ClientId, req: StorageSubscribeRequest): Promise<StorageSubscribeResponse>;
  handleUnsubscribe(clientId: ClientId, req: StorageUnsubscribeRequest): void;
  /** Drop all subscriptions for a client (e.g. webContents destroyed, WS disconnect). */
  detachClient(clientId: ClientId): void;
  /**
   * Register a sink for change events. The dispatcher calls this with the
   * set of client ids that have subscribed to the changed key; the
   * transport wrapper translates those ids back into webContents / WS
   * sockets and `send`s the event.
   */
  onChange(handler: (recipients: Set<ClientId>, event: StorageChangeEvent) => void): () => void;
}

interface DispatcherDeps {
  /**
   * Override the authoritative sensitivity predicate. Default is
   * {@link isSensitiveKey} from `@openheaders/core/storage`. Tests pass
   * their own.
   */
  sensitivityProbe?: (key: string) => boolean;
}

export function createHostStorageDispatcher(
  backend: HostStorage,
  deps: DispatcherDeps = {},
): HostStorageDispatcher {
  const sensitivityProbe = deps.sensitivityProbe ?? isSensitiveKey;
  const seqByKey = new Map<string, number>();
  // clientId → set of subscribed keys
  const subsByClient = new Map<ClientId, Set<string>>();
  // key → set of subscribed clientIds
  const subsByKey = new Map<string, Set<ClientId>>();
  // Backend-side subscription handles, opened lazily per key so the
  // dispatcher only watches keys someone is interested in.
  const backendUnsubs = new Map<string, () => void>();
  const changeHandlers = new Set<(r: Set<ClientId>, e: StorageChangeEvent) => void>();

  function specFor(key: string): StorageKey<unknown> {
    return { key, area: 'local', sensitive: sensitivityProbe(key) === true ? true : undefined };
  }

  function bumpSeq(key: string): number {
    const next = (seqByKey.get(key) ?? 0) + 1;
    seqByKey.set(key, next);
    return next;
  }

  function currentSeq(key: string): number {
    return seqByKey.get(key) ?? 0;
  }

  function ensureBackendSubscription(key: string): void {
    if (backendUnsubs.has(key)) return;
    const spec = specFor(key);
    const unsub = backend.subscribe(spec, (next) => {
      const recipients = subsByKey.get(key);
      if (!recipients || recipients.size === 0) return;
      const event: StorageChangeEvent = { key, value: next, seq: currentSeq(key) };
      for (const handler of changeHandlers) handler(recipients, event);
    });
    backendUnsubs.set(key, unsub);
  }

  function maybeCloseBackendSubscription(key: string): void {
    const recipients = subsByKey.get(key);
    if (recipients && recipients.size > 0) return;
    const unsub = backendUnsubs.get(key);
    if (unsub) {
      unsub();
      backendUnsubs.delete(key);
    }
    subsByKey.delete(key);
  }

  return {
    async handleGet(_clientId, { key }) {
      const value = await backend.get(specFor(key));
      return { value, seq: currentSeq(key) };
    },

    async handleSet(_clientId, { key, value }) {
      await backend.set(specFor(key), value);
      return { seq: bumpSeq(key) };
    },

    async handleGetMany(_clientId, { keys }) {
      const entries: StorageGetManyResponse['entries'] = [];
      for (const key of keys) {
        const value = await backend.get(specFor(key));
        entries.push({ key, value, seq: currentSeq(key) });
      }
      return { entries };
    },

    async handleSetMany(_clientId, { writes }) {
      const tuples = writes.map((w) => [specFor(w.key), w.value] as const);
      await backend.setMany(tuples);
      return { seqs: writes.map((w) => ({ key: w.key, seq: bumpSeq(w.key) })) };
    },

    async handleRemove(_clientId, { keys }) {
      const specs = keys.map((k) => specFor(k));
      await backend.remove(specs);
      return { seqs: keys.map((k) => ({ key: k, seq: bumpSeq(k) })) };
    },

    async handleSubscribe(clientId, { key, lastSeenSeq }) {
      const keysForClient = subsByClient.get(clientId) ?? new Set<string>();
      keysForClient.add(key);
      subsByClient.set(clientId, keysForClient);

      const clientsForKey = subsByKey.get(key) ?? new Set<ClientId>();
      clientsForKey.add(clientId);
      subsByKey.set(key, clientsForKey);

      ensureBackendSubscription(key);

      const value = await backend.get(specFor(key));
      const seq = currentSeq(key);
      const stale = typeof lastSeenSeq === 'number' && lastSeenSeq < seq;
      return { value, seq, stale };
    },

    handleUnsubscribe(clientId, { key }) {
      const keysForClient = subsByClient.get(clientId);
      if (keysForClient) {
        keysForClient.delete(key);
        if (keysForClient.size === 0) subsByClient.delete(clientId);
      }
      const clientsForKey = subsByKey.get(key);
      if (clientsForKey) {
        clientsForKey.delete(clientId);
        maybeCloseBackendSubscription(key);
      }
    },

    detachClient(clientId) {
      const keysForClient = subsByClient.get(clientId);
      if (!keysForClient) return;
      for (const key of keysForClient) {
        const clientsForKey = subsByKey.get(key);
        if (clientsForKey) {
          clientsForKey.delete(clientId);
          maybeCloseBackendSubscription(key);
        }
      }
      subsByClient.delete(clientId);
    },

    onChange(handler) {
      changeHandlers.add(handler);
      return () => {
        changeHandlers.delete(handler);
      };
    },
  };
}
