/**
 * Extension-side settings storage backend.
 *
 * Routes every scope read/write/subscription through the shared
 * `hostStorage` adapter so the settings layer doesn't touch
 * `chrome.storage.*` directly. The one exception is the enterprise
 * policy plane: `chrome.storage.managed` is a browser-owned, read-only
 * area with no host-storage seam (nothing ever writes it from the app),
 * so the managed pair below reads it in place — flat
 * setting-key → policy-value entries, declared for Chromium in the
 * manifest's `managed_schema`.
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

import { hostLogger as logger } from '@openheaders/core/logger';
import { hostStorage, OH, type StorageKey, wsKeys } from '@openheaders/core/storage';
import type { DictStorage, SettingScope, StorageUnsubscribe } from './adapter';

type ScopeDict = Record<string, unknown>;

async function resolveGlobalWorkspaceId(): Promise<string | null> {
  return (await hostStorage.get(OH.runtimeActive)) ?? null;
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

// This package carries no chrome ambient types (it builds for every
// host); the minimal structural surface the managed reads need is
// declared here and resolved off `globalThis` at call time.
type ManagedChangeListener = (changes: Record<string, unknown>, areaName: string) => void;

interface ManagedCapableChromeStorage {
  managed?: { get(keys: null): Promise<Record<string, unknown>> };
  onChanged?: {
    addListener(fn: ManagedChangeListener): void;
    removeListener(fn: ManagedChangeListener): void;
  };
}

function chromeStorageGlobal(): ManagedCapableChromeStorage | null {
  const g = globalThis as { chrome?: { storage?: ManagedCapableChromeStorage } };
  try {
    return g.chrome?.storage ?? null;
  } catch {
    return null;
  }
}

export class ChromeDictStorage implements DictStorage {
  async load(scope: SettingScope): Promise<ScopeDict> {
    const spec = await resolveKey(scope);
    if (!spec) return {};
    return (await hostStorage.get(spec)) ?? {};
  }

  async save(scope: SettingScope, values: ScopeDict): Promise<void> {
    const spec = await resolveKey(scope);
    if (!spec) {
      logger.info('Settings', `save(${scope}) skipped — no active workspace yet`);
      return;
    }
    await hostStorage.set(spec, values);
  }

  subscribe(scope: SettingScope, fn: (values: ScopeDict) => void): StorageUnsubscribe {
    if (scope === 'user') {
      return hostStorage.subscribe(OH.settingsUser, (next) => fn(next ?? {}));
    }

    // Workspace-taste / workspace-behavioral — rebind when the relevant
    // workspace id changes. Both rebind on `OH.runtimeActive` today;
    // when MWPT P1 lands, `'workspace-behavioral'` will rebind on the
    // per-tab seam's id stream instead.
    let scopeUnsub: StorageUnsubscribe | null = null;

    const bindForWorkspace = async (id: string): Promise<void> => {
      scopeUnsub?.();
      const spec = workspaceKeyFor(scope, id);
      scopeUnsub = hostStorage.subscribe(spec, (next) => fn(next ?? {}));
      const current = (await hostStorage.get(spec)) ?? {};
      fn(current);
    };

    void hostStorage.get(OH.runtimeActive).then((id) => {
      if (id) void bindForWorkspace(id);
    });

    const activeIdUnsub = hostStorage.subscribe(OH.runtimeActive, (nextId) => {
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

  async loadManaged(): Promise<ScopeDict> {
    const managed = chromeStorageGlobal()?.managed;
    if (!managed) return {};
    try {
      // A browser with no policy configured resolves an empty object;
      // some resolve an error instead — both read as "nothing managed".
      return (await managed.get(null)) ?? {};
    } catch {
      return {};
    }
  }

  subscribeManaged(fn: (values: ScopeDict) => void): StorageUnsubscribe {
    const storage = chromeStorageGlobal();
    if (!storage?.managed || !storage.onChanged) return () => {};
    const events = storage.onChanged;
    const listener: ManagedChangeListener = (_changes, areaName) => {
      if (areaName !== 'managed') return;
      // Policy deltas are rare; re-read the whole area so removals are
      // observed as absence, not stale `newValue: undefined` holes.
      void this.loadManaged().then(fn);
    };
    events.addListener(listener);
    return () => events.removeListener(listener);
  }
}
