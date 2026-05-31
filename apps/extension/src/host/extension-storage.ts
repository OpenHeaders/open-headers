/**
 * ExtensionStorage — chrome.storage adapter implementing
 * {@link HostStorage} from `@openheaders/core/storage`. The
 * browser-extension host installs an instance of this class via
 * `setHostStorage(extensionStorage)` at boot (see `install-host-storage`)
 * so every consumer — UI, oracle, background — that reads through the
 * `hostStorage` proxy lands here. This is the extension's adapter; a
 * desktop or web build ships its own implementation of the same contract.
 *
 * Callers pass a `StorageKey<T>` from the typed key registry; the
 * adapter:
 *   - routes to the correct area (local / sync / session)
 *   - promisifies Chrome's callback-style API
 *   - narrows return types via the key's phantom payload
 *   - dedupes `onChanged` subscriptions per (area, key) pair
 *   - seals `sensitive: true` slots at rest through a per-host
 *     {@link BrowserSecretCipher} (WS-B B2) — secrets are never persisted
 *     as plain JSON; a vault seed replicated to this host (WS-B B1) lands
 *     encrypted under a key only this host can use.
 */

import { type ParseEntityOptions, parseEntity, parseEntityArray } from '@openheaders/core/schemas';
import type { GuardedRead, HostStorage, StorageArea, StorageKey } from '@openheaders/core/storage';
import type * as v from 'valibot';
import { type BrowserSecretCipher, createBrowserSecretCipher } from './browser-secret-cipher';

// Cross-browser API resolver. Firefox exposes the WebExtension surface
// as `browser`; everywhere else it's `chrome`. Kept inline (rather than
// `@/types/browser`'s helper) so this adapter stays a self-contained
// host module with no app-internal coupling beyond `@openheaders/core`.
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
  private readonly cipher: BrowserSecretCipher;

  constructor(cipher: BrowserSecretCipher) {
    this.cipher = cipher;
  }

  /**
   * Seal a sensitive value for at-rest storage. Throws when the cipher is
   * unavailable rather than silently downgrading to plaintext — mirrors the
   * desktop's `FileBackedHostStorage` invariant: a sensitive slot is never
   * written in the clear.
   */
  private async sealSlot<T>(value: T): Promise<string> {
    if (!this.cipher.isAvailable()) {
      throw new Error('ExtensionStorage: cipher unavailable; refusing to write sensitive slot in plaintext');
    }
    return this.cipher.encrypt(JSON.stringify(value));
  }

  /**
   * Open an at-rest blob into a tri-state. `absent` is never produced here
   * (callers check for a missing raw first); a present blob is either `ok`
   * with its decoded JS value, or `undecryptable` when the cipher is
   * unavailable / the raw isn't a blob / the AES-GCM open throws (a lost or
   * rotated at-rest key, or a corrupt blob). The decoded value is not yet
   * schema-validated — that is the caller's step.
   */
  private async openSlotGuarded(raw: unknown): Promise<{ status: 'ok'; value: unknown } | { status: 'undecryptable' }> {
    if (typeof raw !== 'string' || !this.cipher.isAvailable()) return { status: 'undecryptable' };
    try {
      return { status: 'ok', value: JSON.parse(await this.cipher.decrypt(raw)) };
    } catch {
      return { status: 'undecryptable' };
    }
  }

  /**
   * Open an at-rest blob. Returns `undefined` (never throws) on a missing
   * cipher or a decrypt failure — a corrupt / undecryptable slot reads as
   * empty and the caller falls through to a default, matching the desktop
   * read-fault tolerance. Read sites that must tell a key loss apart from an
   * empty slot use {@link getValidatedGuarded} instead.
   */
  private async openSlot<T>(raw: unknown): Promise<T | undefined> {
    const opened = await this.openSlotGuarded(raw);
    return opened.status === 'ok' ? (opened.value as T) : undefined;
  }

  /** Read a single key. Returns `undefined` when the slot is empty. */
  async get<T>(spec: StorageKey<T>): Promise<T | undefined> {
    const items = await areaGet(spec.area, [spec.key]);
    const raw = items[spec.key];
    if (raw === undefined) return undefined;
    if (spec.sensitive === true) return this.openSlot<T>(raw);
    return raw as T;
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
    await Promise.all(
      (Object.entries(specs) as [keyof M, StorageKey<unknown>][]).map(async ([name, spec]) => {
        const raw = merged[spec.key];
        out[name as string] = spec.sensitive === true && raw !== undefined ? await this.openSlot(raw) : raw;
      }),
    );
    return out as { [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never };
  }

  /** Write a single key. */
  async set<T>(spec: StorageKey<T>, value: T): Promise<void> {
    const stored = spec.sensitive === true ? await this.sealSlot(value) : (value as unknown);
    return areaSet(spec.area, { [spec.key]: stored });
  }

  /** Write multiple keys atomically within their area. Keys from different
   *  areas are dispatched to their respective `set` calls in parallel. */
  async setMany(writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]>): Promise<void> {
    const byArea = new Map<StorageArea, Record<string, unknown>>();
    for (const [spec, value] of writes) {
      const stored = spec.sensitive === true ? await this.sealSlot(value) : value;
      const bucket = byArea.get(spec.area) ?? {};
      bucket[spec.key] = stored;
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
   * Schema-validated single-entity read that distinguishes a present-but-
   * undecryptable sensitive slot from an absent one (see {@link GuardedRead}).
   * `getValidated` collapses both to `null`; this preserves the difference so
   * a consumer of irreplaceable secrets (the vault) refuses to seed an empty
   * projection over a ciphertext it merely can't open — the silent-loss hazard
   * when the IndexedDB at-rest key is evicted out from under the still-present
   * `chrome.storage.local` blob.
   */
  async getValidatedGuarded<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<v.InferOutput<TSchema>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<GuardedRead<v.InferOutput<TSchema>>> {
    const items = await areaGet(spec.area, [spec.key]);
    const raw = items[spec.key];
    if (raw === undefined) return { status: 'absent' };
    if (spec.sensitive !== true) {
      return { status: 'ok', value: parseEntity(schema, raw, options) };
    }
    const opened = await this.openSlotGuarded(raw);
    if (opened.status !== 'ok') return { status: 'undecryptable' };
    return { status: 'ok', value: parseEntity(schema, opened.value, options) };
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
   *
   * Sensitive slots carry an at-rest blob in `newValue`; it is decrypted
   * before `fn` fires. Decryption is async, so for a sensitive slot `fn`
   * runs a microtask after the change event — back-to-back writes to one
   * sensitive key may resolve out of order (acceptable: these are
   * low-frequency secret slots, never hot paths).
   */
  subscribe<T>(spec: StorageKey<T>, fn: (next: T | undefined) => void): () => void {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string): void => {
      if (areaName !== spec.area) return;
      const change = changes[spec.key];
      if (!change) return;
      const next = change.newValue;
      if (spec.sensitive === true && next !== undefined) {
        void this.openSlot<T>(next).then(fn);
        return;
      }
      fn(next as T | undefined);
    };
    rawOnChanged().addListener(listener);
    return () => rawOnChanged().removeListener(listener);
  }
}

/** Module-level singleton wired with the per-host at-rest cipher. Tests
 *  construct their own `new ExtensionStorage(cipher)` with a stub cipher. */
export const extensionStorage = new ExtensionStorage(createBrowserSecretCipher());
