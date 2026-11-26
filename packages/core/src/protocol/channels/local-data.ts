/**
 * Local-data removal bridge RPC — a Windows package removing its own
 * data and capture trust. Desktop-shell answered, by the Electron main
 * process of a Windows package alone: a package has no uninstall hook, so
 * what the app keeps outside its package is removed by the person, from
 * Settings. No other host answers; the surface gates on the
 * `removeLocalData` capability.
 */

import type { ProxyTrustStoreId } from '../../types';

/** A trust store that kept the capture certificate when the removal asked it to go. */
export interface LocalDataRemovalRefusedStore {
  store: ProxyTrustStoreId;
  ref: string;
  error?: string;
}

export type LocalDataRemovalResult =
  /** What lies outside the data folder is undone; the app is closing and starts itself again to delete the folder. */
  | { outcome: 'restarting' }
  /** Windows keeps no launch alias for the app, so it cannot start itself again. Nothing was changed. */
  | { outcome: 'alias-off'; name: string }
  /** A store kept its trust, or the teardown did not run (`error`). Nothing else was changed. */
  | { outcome: 'trust-refused'; stores: ReadonlyArray<LocalDataRemovalRefusedStore>; error?: string }
  /** The removal could not be handed over to a new start; `reason` is a short token. The folder is as it was. */
  | { outcome: 'failed'; reason: string };

export interface LocalDataRpc {
  /**
   * Undo capture trust, remove the browsers' keys that name this data
   * folder, then close the app and delete the folder from a new start.
   * `force` goes on past a store that kept its trust — the person's
   * second word, given after `trust-refused` listed the stores. Resolves
   * before the app begins to close.
   */
  'oh.desktop.localData.remove': { req: { force?: boolean }; res: LocalDataRemovalResult };
}
