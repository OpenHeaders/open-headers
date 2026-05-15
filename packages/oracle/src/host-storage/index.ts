/**
 * Cross-host persistence layer for the renderer-facing {@link HostStorage}
 * contract. Three pieces:
 *
 *   - {@link FileBackedHostStorage} — pure-Node KV impl backed by a
 *     single JSON file. Used by Electron main today, by future headless
 *     daemons, and (via `runOnce`) by the CLI.
 *   - {@link SecretCipher} — encryption seam for slots flagged
 *     `sensitive: true`. Electron wires `safeStorage`; daemons wire
 *     keytar / KMS / passphrase derivations.
 *   - {@link createHostStorageDispatcher} — transport-agnostic wire-level
 *     dispatcher (per-client subscriptions + monotonic seq numbers).
 *     Wrapped by Electron IPC today, by WS server later.
 *
 * The host composes: backend → dispatcher → transport binding. The wire
 * protocol is identical across hosts; only the transport differs.
 */

export {
  FileBackedHostStorage,
  type FileBackedHostStorageOptions,
} from './file-backed-host-storage';
export {
  createHostStorageDispatcher,
  type HostStorageDispatcher,
  type StorageChangeEvent,
  type StorageGetManyRequest,
  type StorageGetManyResponse,
  type StorageGetRequest,
  type StorageGetResponse,
  type StorageRemoveRequest,
  type StorageRemoveResponse,
  type StorageSetManyRequest,
  type StorageSetManyResponse,
  type StorageSetRequest,
  type StorageSetResponse,
  type StorageSubscribeRequest,
  type StorageSubscribeResponse,
  type StorageUnsubscribeRequest,
} from './dispatcher';
export { noopSecretCipher, type SecretCipher } from './secret-cipher';
