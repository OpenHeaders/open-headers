/**
 * Cross-host persistence layer for the renderer-facing {@link HostStorage}
 * contract. Host-neutral pieces only — Node-bound implementations live
 * in `@openheaders/oracle-host-node/host-storage`.
 *
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
