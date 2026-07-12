/**
 * Settings store — Layer 3.
 *
 * One module-level store backs every `useSetting` hook across the app.
 * Design goals:
 *
 *   1. Per-key subscriptions. Components that read `appearance.theme`
 *      don't re-render when `appearance.density` changes. Achieved by
 *      notifying subscribers keyed on setting-key, not globally.
 *
 *   2. Dict persistence. Every setting for a given scope lands in one
 *      dict under a single storage key — the store splits per-key
 *      updates and merges at write time. No per-setting escape hatch.
 *
 *   3. valibot validation. Every write runs through the setting's
 *      schema; invalid values are rejected and the store retains the
 *      previous value. Reads at init also validate to catch corrupt or
 *      out-of-date persisted data.
 *
 *   4. Debounced persistence. Rapid writes batch into one dict flush
 *      per scope (150ms).
 *
 *   5. Cross-context sync. The store subscribes to every scope on
 *      init, so changes in the popup propagate to workbench.html and
 *      vice versa.
 */

import { hasCapability } from '@openheaders/core/capabilities';
import { hostLogger as logger } from '@openheaders/core/logger';
// Concrete module, not the forms barrel — the barrel drags the
// reprime/awareness stack into the settings store and closes a
// chunk-level import cycle at build time.
import { stableStringify } from '@openheaders/ui/shared/forms/fingerprint';
import * as v from 'valibot';
import { allDefaults, allDefs, getDef, subscribeRegistry } from './registry';
import type { DictStorage, SettingScope, StorageUnsubscribe } from './storage/adapter';
import { ChromeDictStorage } from './storage/chrome-storage';
import type { SettingDef, SettingKey, SettingsMap } from './types';

const DEBOUNCE_MS = 150;
const SCOPES: readonly SettingScope[] = ['user', 'workspace-taste', 'workspace-behavioral'];

// ── Types ────────────────────────────────────────────────────────────

type KeyListener = () => void;

interface StoreState {
  values: Map<SettingKey, unknown>;
  /** Keys whose current value differs from the registered default. */
  modified: Set<SettingKey>;
  ready: boolean;
}

// ── Module state ─────────────────────────────────────────────────────

const state: StoreState = {
  values: new Map(),
  modified: new Set(),
  ready: false,
};

const keyListeners = new Map<SettingKey, Set<KeyListener>>();
const globalListeners = new Set<() => void>();
const pendingScopes = new Set<SettingScope>();
const scopeTimers = new Map<SettingScope, ReturnType<typeof setTimeout>>();
const storageSubscriptions: StorageUnsubscribe[] = [];

let dictStorage: DictStorage = new ChromeDictStorage();
let initPromise: Promise<void> | null = null;

// ── Notification ─────────────────────────────────────────────────────

function notifyKey(key: SettingKey): void {
  const set = keyListeners.get(key);
  if (set) for (const fn of set) fn();
  for (const fn of globalListeners) fn();
}

// ── Internal helpers ─────────────────────────────────────────────────

function validate<K extends SettingKey>(def: SettingDef<K>, raw: unknown): SettingsMap[K] | undefined {
  const result = v.safeParse(def.schema, raw);
  if (!result.success) {
    logger.info('Settings', `rejected value for "${def.key}"`, result.issues);
    return undefined;
  }
  return result.output;
}

function effectiveDefault<K extends SettingKey>(def: SettingDef<K>): SettingsMap[K] {
  return def.getDefault ? def.getDefault() : def.default;
}

function isDefault<K extends SettingKey>(def: SettingDef<K>, value: unknown): boolean {
  // Shallow equality is sufficient for the primitive setting types we
  // ship today (string, number, boolean, enum). Object-valued settings
  // (keyvalue, multi-select) compare structurally via stableStringify:
  // persisted values round-trip chrome.storage, which alphabetizes
  // object keys, so an insertion-ordered comparison would misreport a
  // default-equal value as modified.
  const dflt = effectiveDefault(def);
  if (value === dflt) return true;
  if (typeof value === 'object' && value !== null && typeof dflt === 'object') {
    try {
      return stableStringify(value) === stableStringify(dflt);
    } catch {
      return false;
    }
  }
  return false;
}

function applyValue<K extends SettingKey>(def: SettingDef<K>, value: SettingsMap[K]): void {
  state.values.set(def.key, value);
  if (isDefault(def, value)) state.modified.delete(def.key);
  else state.modified.add(def.key);
}

// ── Initialization ───────────────────────────────────────────────────

/**
 * Replace the default dict storage backend. Tests call this with an
 * in-memory implementation; desktop will call it with an IPC backend.
 * Must be invoked before `initSettingsStore`.
 */
export function configureSettingsStorage(storage: DictStorage): void {
  dictStorage = storage;
}

/**
 * Load every registered scope and wire up cross-context sync. Safe to
 * call multiple times — subsequent calls return the same in-flight
 * promise.
 */
export function initSettingsStore(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    // Seed defaults for every registered key so `get(key)` always has
    // a meaningful value, even before async loads complete.
    const defaults = allDefaults();
    for (const [key, value] of Object.entries(defaults)) {
      state.values.set(key as SettingKey, value);
    }

    // Group defs by scope and merge persisted dict values into state.
    const defsByScope = new Map<SettingScope, SettingDef[]>();
    for (const scope of SCOPES) defsByScope.set(scope, []);
    for (const def of allDefs()) defsByScope.get(def.scope)?.push(def);

    for (const scope of SCOPES) {
      const scopeDefs = defsByScope.get(scope);
      if (!scopeDefs || scopeDefs.length === 0) continue;
      const raw = await dictStorage.load(scope);
      for (const def of scopeDefs) {
        if (def.key in raw) {
          const validated = validate(def, raw[def.key]);
          if (validated !== undefined) {
            applyValue(def, validated);
            // Per-key listeners subscribed BEFORE init finished (every
            // `useSettingValue` call during the first render) need an
            // explicit notify here — they watch key listeners, not the
            // global ready flag, so without this the UI paints with the
            // registered default and never re-renders with the stored
            // value after load.
            notifyKey(def.key);
          }
        }
      }
      // Subscribe for cross-context updates on this scope.
      const unsub = dictStorage.subscribe(scope, (values) => {
        for (const def of scopeDefs) {
          if (def.key in values) {
            const validated = validate(def, values[def.key]);
            if (validated !== undefined) {
              applyValue(def, validated);
              notifyKey(def.key);
            }
          }
        }
      });
      storageSubscriptions.push(unsub);
    }

    state.ready = true;
    for (const fn of globalListeners) fn();

    // Popup pages close fast — a 150ms debounce is enough for the
    // timer to never fire if the user clicks a setting then closes
    // the popup. Flush any pending scopes on pagehide so cross-
    // context writes (theme, density, etc.) actually commit.
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => {
        for (const scope of Array.from(pendingScopes)) {
          const timer = scopeTimers.get(scope);
          if (timer) clearTimeout(timer);
          void flushScope(scope);
        }
      });
    }
  })();
  return initPromise;
}

// Re-seed newly-registered settings so HMR and lazy schema imports work
// without a page reload. Every call walks the full registry; keys the
// store already has a value for are left alone, new keys pick up the
// registered default, and any persisted dict entry for a brand-new key
// gets re-loaded from its scope on the next tick so the value is live by
// the time a component actually reads it. Unregistered keys are not
// purged — that would drop in-flight values during a transient unload.
subscribeRegistry(() => {
  let seededAny = false;
  const scopesToReload = new Set<SettingScope>();
  for (const def of allDefs()) {
    if (!state.values.has(def.key)) {
      state.values.set(def.key, effectiveDefault(def));
      seededAny = true;
      scopesToReload.add(def.scope);
    }
  }
  if (!seededAny) return;
  // If init already ran, pull persisted values for any scope with a
  // freshly-registered key so the user's saved value overrides the
  // default as quickly as possible.
  if (!state.ready) return;
  for (const scope of scopesToReload) {
    void dictStorage.load(scope).then((raw) => {
      for (const def of allDefs()) {
        if (def.scope !== scope) continue;
        if (!(def.key in raw)) continue;
        const validated = validate(def, raw[def.key]);
        if (validated !== undefined) {
          applyValue(def, validated);
          notifyKey(def.key);
        }
      }
    });
  }
});

// ── Read API ─────────────────────────────────────────────────────────

export function get<K extends SettingKey>(key: K): SettingsMap[K] {
  const def = getDef(key);
  // A setting whose required host capability is absent reads as its
  // (host-aware) default, ignoring any seeded or persisted value: the
  // feature can't run on this host, so its value must stay inert. This
  // is the `requiresCapability` contract, enforced for every reader —
  // the UI rows and the SW effectors that share this store alike.
  if (def?.requiresCapability && !hasCapability(def.requiresCapability)) {
    return effectiveDefault(def);
  }
  if (state.values.has(key)) return state.values.get(key) as SettingsMap[K];
  if (!def) throw new Error(`Settings: no definition registered for key "${key}"`);
  return effectiveDefault(def);
}

export function isReady(): boolean {
  return state.ready;
}

export function isModified<K extends SettingKey>(key: K): boolean {
  // Capability-gated settings the host can't run read as their default
  // (see `get`), so they're never "modified" here regardless of any
  // stale persisted value.
  const def = getDef(key);
  if (def?.requiresCapability && !hasCapability(def.requiresCapability)) return false;
  return state.modified.has(key);
}

// ── Write API ────────────────────────────────────────────────────────

export function set<K extends SettingKey>(key: K, value: SettingsMap[K]): void {
  const def = getDef(key);
  if (!def) {
    logger.info('Settings', `set() ignored — no definition for "${key}"`);
    return;
  }
  const validated = validate(def, value);
  if (validated === undefined) return;

  applyValue(def, validated);
  notifyKey(key);

  // Debounce per scope to batch rapid writes.
  pendingScopes.add(def.scope);
  const existing = scopeTimers.get(def.scope);
  if (existing) clearTimeout(existing);
  scopeTimers.set(
    def.scope,
    setTimeout(() => {
      void flushScope(def.scope);
    }, DEBOUNCE_MS),
  );
}

async function flushScope(scope: SettingScope): Promise<void> {
  pendingScopes.delete(scope);
  scopeTimers.delete(scope);
  const dict: Record<string, unknown> = {};
  for (const def of allDefs()) {
    if (def.scope !== scope) continue;
    dict[def.key] = state.values.get(def.key);
  }
  await dictStorage.save(scope, dict);
}

export function reset<K extends SettingKey>(key: K): void {
  const def = getDef(key);
  if (!def) return;
  set(key, effectiveDefault(def));
}

/**
 * Reset every modified setting back to its registered default. Writes
 * are debounced per scope so this triggers at most one storage flush
 * per scope, regardless of how many keys were touched.
 */
export function resetAll(): number {
  let resetCount = 0;
  for (const def of allDefs()) {
    if (state.modified.has(def.key)) {
      set(def.key, effectiveDefault(def));
      resetCount++;
    }
  }
  return resetCount;
}

// ── Subscription API ─────────────────────────────────────────────────

export function subscribeKey<K extends SettingKey>(key: K, fn: KeyListener): () => void {
  let set = keyListeners.get(key);
  if (!set) {
    set = new Set();
    keyListeners.set(key, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
    if (set?.size === 0) keyListeners.delete(key);
  };
}

export function subscribeAll(fn: () => void): () => void {
  globalListeners.add(fn);
  return () => globalListeners.delete(fn);
}

// ── Test utilities ───────────────────────────────────────────────────

export function __resetStoreForTests(): void {
  state.values.clear();
  state.modified.clear();
  state.ready = false;
  keyListeners.clear();
  globalListeners.clear();
  pendingScopes.clear();
  for (const timer of scopeTimers.values()) clearTimeout(timer);
  scopeTimers.clear();
  for (const unsub of storageSubscriptions) unsub();
  storageSubscriptions.length = 0;
  initPromise = null;
  dictStorage = new ChromeDictStorage();
}
