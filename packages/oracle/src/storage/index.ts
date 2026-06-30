/**
 * Oracle's storage façade. Re-exports the host-storage contract + typed-key
 * registry from `@openheaders/core/storage` so oracle-internal code keeps a
 * single import path. Oracle reads and writes exclusively through the
 * host-installed `hostStorage` proxy — it owns no concrete adapter. Each host
 * supplies its own (the browser extension's `ExtensionStorage` lives in
 * `apps/extension/src/host/`; a desktop build would ship its own).
 */

export {
  getHostStorage,
  type HostStorage,
  hostStorage,
  OH,
  type PersistedLocalFolder,
  type PersistedPanelLayout,
  type PersistedPopupState,
  type PersistedTabSession,
  requireHostStorage,
  type StorageArea,
  type StorageKey,
  setHostStorage,
  storageKey,
  UI,
  type WorkspaceKeys,
  wsKeys,
} from '@openheaders/core/storage';
