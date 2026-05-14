/**
 * Runtime registry for settings and categories.
 *
 * Schema files call `registerSetting` at module load. The shell queries
 * via `allDefs` / `byCategory` / `getDef`. The store consumes the same
 * registry to know which scopes to load, what defaults to seed, and
 * which settings carry custom storage adapters.
 *
 * There is exactly one module-level registry. Callers that need test
 * isolation use `__resetRegistryForTests` — not exported from the
 * package barrel but available via the direct module import.
 */

import type { CategoryDef, SettingDef, SettingKey, SettingsMap } from './types';

// ── Internal state ───────────────────────────────────────────────────

const defs = new Map<SettingKey, SettingDef>();
const categories = new Map<string, CategoryDef>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const fn of listeners) fn();
}

// ── Registration API ─────────────────────────────────────────────────

export function registerSetting<K extends SettingKey>(def: SettingDef<K>): void {
  if (defs.has(def.key)) {
    // Re-registration under HMR or duplicate schema file imports is
    // common during development. Overwrite silently — the latest
    // definition wins, which matches what developers expect from HMR.
    defs.set(def.key, def as SettingDef);
    notify();
    return;
  }
  defs.set(def.key, def as SettingDef);
  notify();
}

export function registerCategory(def: CategoryDef): void {
  categories.set(def.id, def);
  notify();
}

// ── Query API ────────────────────────────────────────────────────────

export function getDef<K extends SettingKey>(key: K): SettingDef<K> | undefined {
  return defs.get(key) as SettingDef<K> | undefined;
}

/** Non-nullable variant for call sites that know the key is registered. */
export function requireDef<K extends SettingKey>(key: K): SettingDef<K> {
  const def = defs.get(key);
  if (!def) throw new Error(`Settings: no definition registered for key "${key}"`);
  return def as SettingDef<K>;
}

export function allDefs(): readonly SettingDef[] {
  return Array.from(defs.values());
}

export function allCategories(): readonly CategoryDef[] {
  return Array.from(categories.values()).sort((a, b) => a.order - b.order);
}

export function getCategory(id: string): CategoryDef | undefined {
  return categories.get(id);
}

export function byCategory(categoryId: string): readonly SettingDef[] {
  return allDefs().filter((d) => d.category === categoryId);
}

/**
 * Resolve every default value in the registry to a plain dict. Used
 * at store init to seed unset keys.
 */
export function allDefaults(): Partial<SettingsMap> {
  const out: Record<string, unknown> = {};
  for (const def of defs.values()) {
    out[def.key] = def.default;
  }
  return out as Partial<SettingsMap>;
}

// ── Subscription (for store + shell invalidation) ────────────────────

export function subscribeRegistry(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── Test utilities ───────────────────────────────────────────────────

export function __resetRegistryForTests(): void {
  defs.clear();
  categories.clear();
  listeners.clear();
}
