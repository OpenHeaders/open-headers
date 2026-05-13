/**
 * Extension-side settings storage backend.
 *
 * Routes every scope read/write/subscription through the shared
 * `extensionStorage` adapter so the settings layer doesn't touch
 * `chrome.storage.*` directly.
 *
 * Scope mapping:
 *   - user                  → `OH.settingsUser`                                (always global)
 *   - workspace-taste       → `wsKeys(globalActiveId).settingsWorkspaceTaste`  (R2a — taste settings stay on the global default even in MWPT per-tab mode)
 *   - workspace-behavioral  → `wsKeys(tabActiveId).settingsWorkspaceBehavioral` (R2b — behavioral settings follow the per-tab seam; pre-MWPT the seam == global active)
 *
 * Workspace-scoped subscriptions rebind automatically: when the active
 * workspace id changes, the old key listener stops forwarding and a
 * new listener is attached to the new key. The store's per-key
 * subscribers are re-notified so hooks pick up the new values.
 *
 * Forward-declared seam (`resolveTabWorkspaceId`) — today it returns
 * the global active id, identical to `resolveGlobalWorkspaceId`. MWPT
 * P1 swaps it for a per-tab read so a diverged tab editing workspace X
 * sees X's behavioral settings, not the global default's. This file is
 * the single call site the MWPT seam needs to touch.
 */

import { logger } from '@utils/logger';
import { extensionStorage, OH, type StorageKey, wsKeys } from '@openheaders/oracle/storage';
import type { DictStorage, SettingScope, StorageUnsubscribe } from './adapter';

type ScopeDict = Record<string, unknown>;

async function resolveGlobalWorkspaceId(): Promise<string | null> {
  return (await extensionStorage.get(OH.runtimeActive)) ?? null;
}

/**
 * Forward-declared per-tab workspace seam (MWPT P1 will route this
 * through the slice's `workspaceId` when the user has opted into
 * per-tab mode). Today it returns the global active id — identical
 * behavior to `resolveGlobalWorkspaceId`. Keeping the call site
 * separate gives MWPT a single seam to migrate without churning the
 * surrounding subscription logic.
 */
async function resolveTabWorkspaceId(): Promise<string | null> {
  return resolveGlobalWorkspaceId();
}

async function resolveKey(scope: SettingScope): Promise<StorageKey<ScopeDict> | null> {
  if (scope === 'user') return OH.settingsUser;
  if (scope === 'workspace-taste') {
    const id = await resolveGlobalWorkspaceId();
    return id ? wsKeys(id).settingsWorkspaceTaste : null;
  }
  // 'workspace-behavioral'
  const id = await resolveTabWorkspaceId();
  return id ? wsKeys(id).settingsWorkspaceBehavioral : null;
}

function workspaceKeyFor(scope: 'workspace-taste' | 'workspace-behavioral', id: string): StorageKey<ScopeDict> {
  return scope === 'workspace-taste' ? wsKeys(id).settingsWorkspaceTaste : wsKeys(id).settingsWorkspaceBehavioral;
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

    // Workspace-taste / workspace-behavioral — rebind when the relevant
    // workspace id changes. Both rebind on `OH.runtimeActive` today;
    // when MWPT P1 lands, `'workspace-behavioral'` will rebind on the
    // per-tab seam's id stream instead.
    let scopeUnsub: StorageUnsubscribe | null = null;

    const bindForWorkspace = async (id: string): Promise<void> => {
      scopeUnsub?.();
      const spec = workspaceKeyFor(scope, id);
      scopeUnsub = extensionStorage.subscribe(spec, (next) => fn(next ?? {}));
      const current = (await extensionStorage.get(spec)) ?? {};
      fn(current);
    };

    void extensionStorage.get(OH.runtimeActive).then((id) => {
      if (id) void bindForWorkspace(id);
    });

    const activeIdUnsub = extensionStorage.subscribe(OH.runtimeActive, (nextId) => {
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
