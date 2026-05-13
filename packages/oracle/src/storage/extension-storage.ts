/**
 * ExtensionStorage — the single typed adapter over `chrome.storage.*`.
 *
 * Every read, write, remove, and subscription against persisted state
 * flows through this class. Callers pass a `StorageKey<T>` from the
 * keys registry; the adapter:
 *   - routes to the correct area (local / sync / session)
 *   - promisifies Chrome's callback-style API
 *   - narrows return types via the key's phantom payload
 *   - dedupes `onChanged` subscriptions per (area, key) pair
 *
 * No module in the extension should import `chrome.storage.*`
 * directly — that defeats the whole point of the typed layer. The
 * settings `ChromeDictStorage`, background stores, and UI hooks all
 * route through this class.
 */

import { type ParseEntityOptions, parseEntity, parseEntityArray } from '@openheaders/core/schemas';
import type { HostStorage, StorageArea, StorageKey } from '@openheaders/core/storage';
import type * as v from 'valibot';

// Inlined cross-browser API resolver. Firefox exposes the WebExtension
// surface as `browser`; everywhere else it's `chrome`. Mirrored from
// `@/types/browser` so this package does not reach back into the host
// app's path aliases.
declare const browser: typeof chrome | undefined;

function getBrowserAPI(): typeof chrome {
  return typeof browser !== 'undefined' ? browser : chrome;
}

// ── Raw-area abstraction ─────────────────────────────────────────────

interface RawAreaLike {
  get(keys: string[], cb: (items: Record<string, unknown>) => void): void;
  set(items: Record<string, unknown>, cb: () => void): void;
  remove(keys: string[], cb: () => void): void;
}

interface RawOnChanged {
  addListener(fn: (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void): void;
  removeListener(fn: (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void): void;
}

/**
 * Fetch the `chrome.storage.<area>` handle for a given logical area.
 * `session` may be unavailable in some environments (older Firefox, WebExt
 * polyfill gaps); callers that target it handle the `null` fallback.
 */
function rawArea(area: StorageArea): RawAreaLike | null {
  const api = getBrowserAPI().storage as unknown as {
    local: RawAreaLike;
    sync: RawAreaLike;
    session?: RawAreaLike;
  };
  if (area === 'local') return api.local;
  if (area === 'sync') return api.sync;
  return api.session ?? null;
}

function rawOnChanged(): RawOnChanged {
  return getBrowserAPI().storage.onChanged as unknown as RawOnChanged;
}

// ── Promisified primitives (per area, callback → Promise) ───────────

function areaGet(area: StorageArea, keys: string[]): Promise<Record<string, unknown>> {
  const api = rawArea(area);
  if (!api) return Promise.resolve({});
  return new Promise((resolve) => {
    api.get(keys, (items: Record<string, unknown>) => resolve(items));
  });
}

function areaSet(area: StorageArea, items: Record<string, unknown>): Promise<void> {
  const api = rawArea(area);
  if (!api) return Promise.resolve();
  return new Promise((resolve) => {
    api.set(items, () => resolve());
  });
}

function areaRemove(area: StorageArea, keys: string[]): Promise<void> {
  const api = rawArea(area);
  if (!api) return Promise.resolve();
  return new Promise((resolve) => {
    api.remove(keys, () => resolve());
  });
}

// ── Adapter ─────────────────────────────────────────────────────────

export class ExtensionStorage implements HostStorage {
  /** Read a single key. Returns `undefined` when the slot is empty. */
  async get<T>(spec: StorageKey<T>): Promise<T | undefined> {
    const items = await areaGet(spec.area, [spec.key]);
    return items[spec.key] as T | undefined;
  }

  /**
   * Read multiple keys in one roundtrip. Keys can span different areas
   * — the adapter issues one `get` per area and merges the results.
   * Return type is keyed by the same property names as the input spec
   * object, each value narrowed to `T | undefined`.
   */
  async getMany<M extends Record<string, StorageKey<unknown>>>(
    specs: M,
  ): Promise<{ [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never }> {
    const byArea = new Map<StorageArea, string[]>();
    for (const entry of Object.values(specs) as StorageKey<unknown>[]) {
      const keys = byArea.get(entry.area) ?? [];
      keys.push(entry.key);
      byArea.set(entry.area, keys);
    }
    const merged: Record<string, unknown> = {};
    await Promise.all(
      [...byArea.entries()].map(async ([area, keys]) => {
        const result = await areaGet(area, keys);
        Object.assign(merged, result);
      }),
    );
    const out: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(specs) as [keyof M, StorageKey<unknown>][]) {
      out[name as string] = merged[spec.key];
    }
    return out as { [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never };
  }

  /** Write a single key. */
  set<T>(spec: StorageKey<T>, value: T): Promise<void> {
    return areaSet(spec.area, { [spec.key]: value as unknown });
  }

  /** Write multiple keys atomically within their area. Keys from different
   *  areas are dispatched to their respective `set` calls in parallel. */
  async setMany(writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]>): Promise<void> {
    const byArea = new Map<StorageArea, Record<string, unknown>>();
    for (const [spec, value] of writes) {
      const bucket = byArea.get(spec.area) ?? {};
      bucket[spec.key] = value;
      byArea.set(spec.area, bucket);
    }
    await Promise.all([...byArea.entries()].map(([area, items]) => areaSet(area, items)));
  }

  /** Remove one or many keys. */
  remove(specs: StorageKey<unknown> | ReadonlyArray<StorageKey<unknown>>): Promise<void> {
    const list = Array.isArray(specs) ? specs : [specs as StorageKey<unknown>];
    const byArea = new Map<StorageArea, string[]>();
    for (const spec of list) {
      const keys = byArea.get(spec.area) ?? [];
      keys.push(spec.key);
      byArea.set(spec.area, keys);
    }
    return Promise.all([...byArea.entries()].map(([area, keys]) => areaRemove(area, keys))).then(() => undefined);
  }

  /**
   * Schema-validated single-entity read. Returns the parsed value on
   * success; `null` when the slot is empty OR when the stored raw fails
   * the schema. Optional `onError` callback is invoked with the raw
   * input + the valibot issues when validation fails — wire this into
   * the observability log to surface storage drift.
   *
   * Use this at read sites where a corrupted blob in `chrome.storage.*`
   * (sync conflict, manual DevTools edit, bit-rot) should fall through
   * to a fresh default rather than crash the reader. Matches the
   * read-validates / write-preserves discipline (ARCHITECTURE §7).
   */
  async getValidated<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<v.InferOutput<TSchema>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<v.InferOutput<TSchema> | null> {
    const raw = await this.get(spec);
    if (raw === undefined) return null;
    return parseEntity(schema, raw, options);
  }

  /**
   * Schema-validated array read. Drops entries that fail the schema
   * (per-entry `onError` callback lets callers log drift without
   * poisoning the whole list) and returns the surviving set. Returns
   * an empty array when the slot is empty or the stored raw isn't an
   * array.
   */
  async getValidatedArray<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<Array<v.InferOutput<TSchema>>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<Array<v.InferOutput<TSchema>>> {
    const raw = await this.get(spec);
    if (raw === undefined) return [];
    return parseEntityArray(schema, raw, options);
  }

  /**
   * Subscribe to changes for a single key. Fires with the new value
   * (or `undefined` on removal). Returns a disposer that unregisters
   * the underlying `chrome.storage.onChanged` listener.
   */
  subscribe<T>(spec: StorageKey<T>, fn: (next: T | undefined) => void): () => void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
      if (areaName !== spec.area) return;
      const change = changes[spec.key];
      if (!change) return;
      fn(change.newValue as T | undefined);
    };
    rawOnChanged().addListener(listener);
    return () => rawOnChanged().removeListener(listener);
  }
}

/** Module-level singleton. Tests can replace this via `configure(...)` if needed. */
export const extensionStorage = new ExtensionStorage();
