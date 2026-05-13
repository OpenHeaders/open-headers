/**
 * Oracle's storage façade. Re-exports the host-storage contract +
 * typed-key registry from `@openheaders/core/storage` so oracle-internal
 * code keeps a single import path, and adds the chrome.storage-backed
 * `ExtensionStorage` adapter (the host implementation of
 * {@link HostStorage} the browser-extension app wires at boot).
 */

export {
  ALLOWED_FETCH_HOSTS_SETTING_KEY,
  DEFAULT_ALLOWED_FETCH_HOSTS,
  getHostStorage,
  hostStorage,
  type HostStorage,
  OH,
  type PersistedLocalFolder,
  type PersistedPanelLayout,
  type PersistedPopupState,
  type PersistedTabSession,
  requireHostStorage,
  setHostStorage,
  type StorageArea,
  type StorageKey,
  storageKey,
  UI,
  type WorkspaceKeys,
  wsKeys,
} from '@openheaders/core/storage';
export { ExtensionStorage, extensionStorage } from './extension-storage';
