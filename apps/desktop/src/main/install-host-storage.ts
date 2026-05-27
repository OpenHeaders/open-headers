/**
 * Compose the desktop main-process side of the host-storage wire:
 * {@link FileBackedHostStorage} (Node, encrypted via Electron
 * `safeStorage` for sensitive slots) → {@link createHostStorageDispatcher}
 * (per-client subscriptions + monotonic seq numbers) → Electron IPC
 * bindings (`ipcMain.handle('oh:storage:*')` + `webContents.send`).
 *
 * The same dispatcher will later be wrapped by the commit-9 WS server
 * (and by any future headless-daemon / cloud-daemon process) — only the
 * transport binding here is Electron-specific.
 *
 * Subscription routing:
 *
 *   - Each renderer is identified by `webContents.id` (the {@link ClientId}).
 *   - The renderer's IPC adapter calls `oh:storage:subscribe` with the
 *     keys it wants notifications for; the dispatcher tracks per-client
 *     interest.
 *   - On every `change`, the dispatcher hands us the set of interested
 *     clientIds; we resolve them back to `webContents` and `send` the
 *     event. Renderers that never subscribed to the changed key get
 *     nothing — no broadcast spam.
 *   - When a renderer's webContents is destroyed (window close, reload,
 *     etc.) we call `detachClient` to drop all of its subscriptions.
 */

import { app, ipcMain, webContents } from 'electron';
import {
  createHostStorageDispatcher,
  type HostStorageDispatcher,
  type SecretCipher,
  type StorageGetManyRequest,
  type StorageGetRequest,
  type StorageRemoveRequest,
  type StorageSetManyRequest,
  type StorageSetRequest,
  type StorageSubscribeRequest,
  type StorageUnsubscribeRequest,
} from '@openheaders/oracle/host-storage';
import { FileBackedHostStorage } from '@openheaders/oracle-host-node/host-storage';
import { hostLogger as logger } from '@openheaders/core/logger';
import * as path from 'node:path';
import { safeStorageCipher } from './safe-storage-cipher';

const SCOPE = 'HostStorageIpc';

const CHANNEL = {
  get: 'oh:storage:get',
  set: 'oh:storage:set',
  getMany: 'oh:storage:getMany',
  setMany: 'oh:storage:setMany',
  remove: 'oh:storage:remove',
  subscribe: 'oh:storage:subscribe',
  unsubscribe: 'oh:storage:unsubscribe',
  change: 'oh:storage:change',
} as const;

export interface InstallHostStorageOptions {
  /** Override the default `<userData>/storage.json` path. */
  filePath?: string;
  /** Override the default `safeStorage` cipher (tests use `noopSecretCipher`). */
  cipher?: SecretCipher;
}

export interface HostStorageHandle {
  backend: FileBackedHostStorage;
  dispatcher: HostStorageDispatcher;
}

export function installHostStorage(options: InstallHostStorageOptions = {}): HostStorageHandle {
  const filePath = options.filePath ?? path.join(app.getPath('userData'), 'storage.json');
  const cipher = options.cipher ?? safeStorageCipher;

  const backend = new FileBackedHostStorage({
    filePath,
    secretCipher: cipher,
    log: (level, msg, ...rest) => logger[level](SCOPE, msg, ...rest),
  });

  const dispatcher = createHostStorageDispatcher(backend);

  // Fan-out: route dispatcher change events to the right renderers.
  dispatcher.onChange((recipients, event) => {
    for (const id of recipients) {
      // ClientIds we hand to the dispatcher are webContents.id numbers.
      const wc = typeof id === 'number' ? webContents.fromId(id) : null;
      if (!wc || wc.isDestroyed()) continue;
      try {
        wc.send(CHANNEL.change, event);
      } catch (err) {
        logger.warn(SCOPE, `change send to webContents ${id} failed`, err);
      }
    }
  });

  // Track each renderer's webContents id so we can detach subscriptions
  // on destroy. We register the destroy listener lazily — once per
  // webContents — on first interaction.
  const knownClients = new Set<number>();
  function noteClient(wcId: number): void {
    if (knownClients.has(wcId)) return;
    knownClients.add(wcId);
    const wc = webContents.fromId(wcId);
    if (!wc) return;
    wc.once('destroyed', () => {
      dispatcher.detachClient(wcId);
      knownClients.delete(wcId);
    });
  }

  ipcMain.handle(CHANNEL.get, async (event, raw: unknown) => {
    noteClient(event.sender.id);
    return dispatcher.handleGet(event.sender.id, raw as StorageGetRequest);
  });
  ipcMain.handle(CHANNEL.set, async (event, raw: unknown) => {
    noteClient(event.sender.id);
    return dispatcher.handleSet(event.sender.id, raw as StorageSetRequest);
  });
  ipcMain.handle(CHANNEL.getMany, async (event, raw: unknown) => {
    noteClient(event.sender.id);
    return dispatcher.handleGetMany(event.sender.id, raw as StorageGetManyRequest);
  });
  ipcMain.handle(CHANNEL.setMany, async (event, raw: unknown) => {
    noteClient(event.sender.id);
    return dispatcher.handleSetMany(event.sender.id, raw as StorageSetManyRequest);
  });
  ipcMain.handle(CHANNEL.remove, async (event, raw: unknown) => {
    noteClient(event.sender.id);
    return dispatcher.handleRemove(event.sender.id, raw as StorageRemoveRequest);
  });
  ipcMain.handle(CHANNEL.subscribe, async (event, raw: unknown) => {
    noteClient(event.sender.id);
    return dispatcher.handleSubscribe(event.sender.id, raw as StorageSubscribeRequest);
  });
  ipcMain.handle(CHANNEL.unsubscribe, async (event, raw: unknown) => {
    noteClient(event.sender.id);
    dispatcher.handleUnsubscribe(event.sender.id, raw as StorageUnsubscribeRequest);
    return undefined;
  });

  app.on('before-quit', () => {
    for (const channel of Object.values(CHANNEL)) {
      if (channel === CHANNEL.change) continue;
      ipcMain.removeHandler(channel);
    }
  });

  return { backend, dispatcher };
}

export const HOST_STORAGE_CHANNELS = CHANNEL;
