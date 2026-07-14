/**
 * Host-storage contract — the seam between UI code that needs to read
 * or write persisted state and the platform-specific adapter that
 * actually talks to the underlying store.
 *
 * Each app (browser extension, Electron desktop, web app, CLI) installs
 * its own implementation of {@link HostStorage} once at boot via
 * {@link setHostStorage}. UI code reads through the {@link hostStorage}
 * delegating proxy, which forwards every call to whichever adapter the
 * host installed — keeping consumer code identical across platforms.
 *
 * The contract intentionally mirrors the shape of the extension's
 * chrome-storage adapter (`@openheaders/oracle/storage`'s
 * `ExtensionStorage`) so the chrome implementation can satisfy it
 * without code change. Future adapters (electron-store, localStorage,
 * remote-daemon-backed) implement the same surface.
 */

import type * as v from 'valibot';
import type { ParseEntityOptions } from '../schemas';
import type { StorageKey } from './keys';

/**
 * Tri-state result of a guarded sensitive-slot read. Distinguishes a slot
 * that was never written (`absent`) from one whose ciphertext is present
 * but cannot be opened (`undecryptable` — the at-rest key was lost or
 * rotated, or the blob is corrupt).
 *
 * {@link HostStorage.getValidated} collapses both non-`ok` cases to `null`,
 * which silently masquerades a key loss as an empty slot. Consumers of
 * irreplaceable secrets (the vault) read through
 * {@link HostStorage.getValidatedGuarded} to tell "never set" from "present
 * but unreadable" and refuse to seed an empty projection over the latter.
 *
 * `ok` carries `value: T | null`; a `null` value is a decryptable blob that
 * failed the schema (drift) — the existing read-validates fall-through, not
 * a key loss.
 */
export type GuardedRead<T> = { status: 'ok'; value: T | null } | { status: 'absent' } | { status: 'undecryptable' };

/**
 * Observed availability of the at-rest cipher guarding sensitive slots.
 *
 * Derived from sensitive-slot traffic, never from probing — on macOS the
 * availability check itself triggers the OS-keychain fetch (and its user
 * prompt), so an eager probe would prompt users who hold no secrets at all.
 * `unknown` means no sensitive slot has been touched yet this session;
 * `unavailable` means at least one read/write was refused and the condition
 * still stands (an unavailability episode is open).
 */
export type SecretCipherStatus = 'unknown' | 'available' | 'unavailable';

/**
 * The runtime contract every host's persisted-state adapter must
 * satisfy. UI code only sees this interface — never the concrete
 * adapter class.
 */
export interface HostStorage {
  /** Read a single key. Resolves to `undefined` when the slot is empty. */
  get<T>(spec: StorageKey<T>): Promise<T | undefined>;
  /**
   * Read multiple keys in one round-trip. Return type is keyed by the
   * same property names as the input spec object, each value narrowed
   * to `T | undefined`.
   */
  getMany<M extends Record<string, StorageKey<unknown>>>(
    specs: M,
  ): Promise<{ [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never }>;
  /** Write a single key. */
  set<T>(spec: StorageKey<T>, value: T): Promise<void>;
  /** Write multiple keys; adapters group by area when relevant. */
  setMany(writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]>): Promise<void>;
  /** Remove one or many keys. */
  remove(specs: StorageKey<unknown> | ReadonlyArray<StorageKey<unknown>>): Promise<void>;
  /**
   * Schema-validated single-entity read. Returns `null` when the slot
   * is empty OR when the stored raw fails the schema.
   */
  getValidated<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<v.InferOutput<TSchema>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<v.InferOutput<TSchema> | null>;
  /** Schema-validated array read — drops entries that fail the schema. */
  getValidatedArray<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<Array<v.InferOutput<TSchema>>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<Array<v.InferOutput<TSchema>>>;
  /**
   * Schema-validated single-entity read that distinguishes a present-but-
   * undecryptable sensitive slot from an absent one (see {@link GuardedRead}).
   *
   * Optional capability: hosts whose backing store can detect an
   * undecryptable ciphertext — the extension's `chrome.storage.local` blob
   * sealed under an IndexedDB key, the desktop's file blob sealed under an
   * OS-keychain key — implement it. Pure in-memory fakes and forwarding
   * proxies that hold no cipher omit it, and consumers fall back to
   * {@link getValidated} (which can never observe `undecryptable` there).
   *
   * For a non-sensitive key `undecryptable` is impossible — it resolves
   * `ok`/`absent` exactly like {@link getValidated}.
   */
  getValidatedGuarded?<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<v.InferOutput<TSchema>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<GuardedRead<v.InferOutput<TSchema>>>;
  /**
   * Subscribe to changes for a single key. Fires with the new value or
   * `undefined` on removal. Returned function unregisters the listener.
   */
  subscribe<T>(spec: StorageKey<T>, fn: (next: T | undefined) => void): () => void;
}

let installed: HostStorage | null = null;

/**
 * Install (or replace) the host-storage adapter. Hosts call this once
 * at boot before any UI code reads persisted state. Calling twice
 * replaces the prior implementation — tests use this to swap in a
 * fake.
 */
export function setHostStorage(impl: HostStorage): void {
  installed = impl;
}

/** Returns the installed adapter, or null when no host has wired one yet. */
export function getHostStorage(): HostStorage | null {
  return installed;
}

/** Returns the installed adapter or throws if no host has wired one. */
export function requireHostStorage(): HostStorage {
  if (!installed) {
    throw new Error('HostStorage: no host adapter installed. Call setHostStorage at app boot.');
  }
  return installed;
}

/**
 * Delegating proxy — every call is forwarded to the currently-installed
 * host adapter. UI code imports this and uses it exactly like a
 * concrete adapter; the indirection lets each host plug in its own
 * implementation without consumers caring.
 */
export const hostStorage: HostStorage = new Proxy({} as HostStorage, {
  get(_target, prop): unknown {
    const impl = requireHostStorage();
    const value = (impl as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(impl) : value;
  },
});
