/**
 * Extension-side settings storage backend.
 *
 * Routes every scope read/write/subscription through the shared
 * `extensionStorage` adapter so the settings layer doesn't touch
 * `chrome.storage.*` directly.
 *
 * Scope mapping:
 *   - user       → `OH.settingsUser`                   (always global)
 *   - workspace  → `wsKeys(activeId).settingsWorkspace`
 *   - collection → `wsKeys(activeId).settingsCollection`
 *
 * `workspace` and `collection` scopes resolve the active workspace id
 * at call time from `OH.activeWorkspaceId`. That key is seeded during
 * background bootstrap before any surface mounts, so reads after first
 * paint always resolve a non-null id.
 *
 * Workspace-scoped subscriptions rebind automatically: when the active
 * workspace id changes, the old key listener stops forwarding and a
 * new listener is attached to the new key. The store's per-key
 * subscribers are re-notified so hooks pick up the new values.
 */

import { logger } from '@utils/logger';
import { extensionStorage, OH, type StorageKey, wsKeys } from '@/shared/storage';
import type { DictStorage, SettingScope, StorageUnsubscribe } from './adapter';

type ScopeDict = Record<string, unknown>;

async function resolveKey(scope: SettingScope): Promise<StorageKey<ScopeDict> | null> {
  if (scope === 'user') return OH.settingsUser;
  const id = await extensionStorage.get(OH.activeWorkspaceId);
  if (!id) return null;
  return scope === 'workspace' ? wsKeys(id).settingsWorkspace : wsKeys(id).settingsCollection;
}

export class ChromeDictStorage implements DictStorage {
  async load(scope: SettingScope): Promise<ScopeDict> {
    const spec = await resolveKey(scope);
    if (!spec) return {};
    return (await extensionStorage.get(spec)) ?? {};
  }

  async save(scope: SettingScope, values: ScopeDict): Promise<void> {
    const spec = await resolveKey(scope);
    if (!spec) {
      logger.info('Settings', `save(${scope}) skipped — no active workspace yet`);
      return;
    }
    await extensionStorage.set(spec, values);
  }

  subscribe(scope: SettingScope, fn: (values: ScopeDict) => void): StorageUnsubscribe {
    if (scope === 'user') {
      return extensionStorage.subscribe(OH.settingsUser, (next) => fn(next ?? {}));
    }

    // Workspace / collection scope — rebind when the active workspace
    // id changes. We track the current scope-key subscription and
    // swap it on every active-id update; subscribers see a synthetic
    // update with the new workspace's values so the store re-notifies
    // key listeners.
    let scopeUnsub: StorageUnsubscribe | null = null;

    const bindForWorkspace = async (id: string): Promise<void> => {
      scopeUnsub?.();
      const spec = scope === 'workspace' ? wsKeys(id).settingsWorkspace : wsKeys(id).settingsCollection;
      scopeUnsub = extensionStorage.subscribe(spec, (next) => fn(next ?? {}));
      const current = (await extensionStorage.get(spec)) ?? {};
      fn(current);
    };

    void extensionStorage.get(OH.activeWorkspaceId).then((id) => {
      if (id) void bindForWorkspace(id);
    });

    const activeIdUnsub = extensionStorage.subscribe(OH.activeWorkspaceId, (nextId) => {
      if (nextId) {
        void bindForWorkspace(nextId);
      } else {
        scopeUnsub?.();
        scopeUnsub = null;
        fn({});
      }
    });

    return () => {
      activeIdUnsub();
      scopeUnsub?.();
    };
  }
}
