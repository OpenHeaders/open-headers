/**
 * Pure-Node {@link HostStorage} implementation backed by a single JSON
 * file. Designed to be the canonical persistent KV for any host that
 * owns durable state on a local filesystem — Electron main process,
 * headless Node daemon, CLI `runOnce` (per
 * `docs/SYNC_ENGINE_DESIGN.md` §20.1).
 *
 * Zero Electron coupling. Encryption is delegated to a
 * {@link SecretCipher}; the host wires whichever cipher matches its
 * environment (`safeStorage` for Electron, keytar / KMS / passphrase for
 * daemons, {@link noopSecretCipher} for tests).
 *
 * On-disk envelope (`schemaVersion: 1`):
 *
 *     {
 *       "schemaVersion": 1,
 *       "values":  { "<key>": <plain-json>, ... },
 *       "secrets": { "<key>": "<encrypted-blob>", ... }
 *     }
 *
 * Two buckets keep the plain/encrypted distinction unambiguous on disk —
 * no sentinel-keyed objects, no ambiguity when a plain value happens to
 * be shaped like an encrypted envelope.
 *
 * Writes are atomic per the rename-after-write pattern (`*.tmp` →
 * `rename`). Concurrent writers are NOT supported — desktop main / a
 * daemon owns the file exclusively; CLI `runOnce` should serialize
 * against the daemon if one is present, or hold an OS file lock if
 * running standalone (future concern, not v1).
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { type ParseEntityOptions, parseEntity, parseEntityArray } from '@openheaders/core/schemas';
import type { GuardedRead, HostStorage, StorageKey } from '@openheaders/core/storage';
import type { SecretCipher } from '@openheaders/oracle/host-storage';
import type * as v from 'valibot';

const ENVELOPE_VERSION = 1;

interface DiskEnvelope {
  schemaVersion: number;
  values: Record<string, unknown>;
  secrets: Record<string, string>;
}

function emptyEnvelope(): DiskEnvelope {
  return { schemaVersion: ENVELOPE_VERSION, values: {}, secrets: {} };
}

export interface FileBackedHostStorageOptions {
  /** Absolute path to the JSON file backing this store. */
  filePath: string;
  /** Encryption adapter for slots flagged `sensitive: true`. */
  secretCipher: SecretCipher;
  /**
   * Optional logger for corrupted-file / cipher-unavailable cases.
   * Defaults to silent — hosts should pass a {@link HostLogger}.
   */
  log?: (level: 'warn' | 'error', msg: string, ...rest: unknown[]) => void;
}

type ChangeListener = (next: unknown) => void;

export class FileBackedHostStorage implements HostStorage {
  private readonly filePath: string;
  private readonly cipher: SecretCipher;
  private readonly log: (level: 'warn' | 'error', msg: string, ...rest: unknown[]) => void;
  private readonly listeners = new Map<string, Set<ChangeListener>>();
  private envelope: DiskEnvelope = emptyEnvelope();
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(options: FileBackedHostStorageOptions) {
    this.filePath = options.filePath;
    this.cipher = options.secretCipher;
    this.log = options.log ?? (() => undefined);
  }

  async get<T>(spec: StorageKey<T>): Promise<T | undefined> {
    await this.ensureLoaded();
    return this.readSlot<T>(spec);
  }

  async getMany<M extends Record<string, StorageKey<unknown>>>(
    specs: M,
  ): Promise<{ [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never }> {
    await this.ensureLoaded();
    const out: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(specs) as [keyof M, StorageKey<unknown>][]) {
      out[name as string] = this.readSlot(spec);
    }
    return out as { [K in keyof M]: M[K] extends StorageKey<infer V> ? V | undefined : never };
  }

  async set<T>(spec: StorageKey<T>, value: T): Promise<void> {
    await this.ensureLoaded();
    this.writeSlot(spec, value);
    await this.flush();
    this.fire(spec.key, value);
  }

  async setMany(writes: ReadonlyArray<readonly [StorageKey<unknown>, unknown]>): Promise<void> {
    await this.ensureLoaded();
    for (const [spec, value] of writes) {
      this.writeSlot(spec, value);
    }
    await this.flush();
    for (const [spec, value] of writes) {
      this.fire(spec.key, value);
    }
  }

  async remove(specs: StorageKey<unknown> | ReadonlyArray<StorageKey<unknown>>): Promise<void> {
    await this.ensureLoaded();
    const list = Array.isArray(specs) ? specs : [specs as StorageKey<unknown>];
    let dirty = false;
    for (const spec of list) {
      if (spec.sensitive === true) {
        if (spec.key in this.envelope.secrets) {
          delete this.envelope.secrets[spec.key];
          dirty = true;
        }
      } else {
        if (spec.key in this.envelope.values) {
          delete this.envelope.values[spec.key];
          dirty = true;
        }
      }
    }
    if (dirty) await this.flush();
    for (const spec of list) {
      this.fire(spec.key, undefined);
    }
  }

  async getValidated<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<v.InferOutput<TSchema>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<v.InferOutput<TSchema> | null> {
    await this.ensureLoaded();
    const raw = this.readSlot(spec);
    if (raw === undefined) return null;
    return parseEntity(schema, raw, options);
  }

  async getValidatedArray<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<Array<v.InferOutput<TSchema>>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<Array<v.InferOutput<TSchema>>> {
    await this.ensureLoaded();
    const raw = this.readSlot(spec);
    if (raw === undefined) return [];
    return parseEntityArray(schema, raw, options);
  }

  async getValidatedGuarded<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    spec: StorageKey<v.InferOutput<TSchema>>,
    schema: TSchema,
    options?: ParseEntityOptions,
  ): Promise<GuardedRead<v.InferOutput<TSchema>>> {
    await this.ensureLoaded();
    const opened = this.readSlotGuarded(spec);
    if (opened.status !== 'ok') return opened;
    return { status: 'ok', value: parseEntity(schema, opened.value, options) };
  }

  subscribe<T>(spec: StorageKey<T>, fn: (next: T | undefined) => void): () => void {
    const bucket = this.listeners.get(spec.key) ?? new Set<ChangeListener>();
    const cast = fn as ChangeListener;
    bucket.add(cast);
    this.listeners.set(spec.key, bucket);
    return () => {
      const current = this.listeners.get(spec.key);
      if (!current) return;
      current.delete(cast);
      if (current.size === 0) this.listeners.delete(spec.key);
    };
  }

  // ── Internal ────────────────────────────────────────────────────────

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (!this.loadPromise) this.loadPromise = this.load();
    await this.loadPromise;
  }

  private async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DiskEnvelope>;
      this.envelope = {
        schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : ENVELOPE_VERSION,
        values: parsed.values && typeof parsed.values === 'object' ? { ...parsed.values } : {},
        secrets:
          parsed.secrets && typeof parsed.secrets === 'object'
            ? Object.fromEntries(
                Object.entries(parsed.secrets).filter(
                  (entry): entry is [string, string] => typeof entry[1] === 'string',
                ),
              )
            : {},
      };
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException | undefined)?.code;
      if (code === 'ENOENT') {
        this.envelope = emptyEnvelope();
      } else {
        this.log('error', `FileBackedHostStorage: failed to load ${this.filePath}; starting empty`, err);
        this.envelope = emptyEnvelope();
      }
    }
    this.loaded = true;
  }

  private readSlot<T>(spec: StorageKey<T>): T | undefined {
    const opened = this.readSlotGuarded(spec);
    return opened.status === 'ok' ? (opened.value as T) : undefined;
  }

  /**
   * Read a slot into a tri-state, distinguishing an absent slot from a
   * present-but-undecryptable one (cipher unavailable or the OS-keychain key
   * lost / blob corrupt). {@link readSlot} collapses both non-`ok` cases to
   * `undefined` for the read-fault-tolerant default path; {@link getValidatedGuarded}
   * preserves the difference for consumers of irreplaceable secrets.
   */
  private readSlotGuarded(
    spec: StorageKey<unknown>,
  ): { status: 'ok'; value: unknown } | { status: 'absent' } | { status: 'undecryptable' } {
    if (spec.sensitive === true) {
      const blob = this.envelope.secrets[spec.key];
      if (blob === undefined) return { status: 'absent' };
      if (!this.cipher.isAvailable()) {
        this.log('warn', `FileBackedHostStorage: cipher unavailable; refusing to decrypt slot "${spec.key}"`);
        return { status: 'undecryptable' };
      }
      try {
        return { status: 'ok', value: JSON.parse(this.cipher.decrypt(blob)) };
      } catch (err) {
        this.log('error', `FileBackedHostStorage: decrypt failed for "${spec.key}"`, err);
        return { status: 'undecryptable' };
      }
    }
    if (!(spec.key in this.envelope.values)) return { status: 'absent' };
    return { status: 'ok', value: this.envelope.values[spec.key] };
  }

  private writeSlot<T>(spec: StorageKey<T>, value: T): void {
    if (spec.sensitive === true) {
      if (!this.cipher.isAvailable()) {
        throw new Error(`FileBackedHostStorage: cipher unavailable; cannot write sensitive slot "${spec.key}"`);
      }
      const blob = this.cipher.encrypt(JSON.stringify(value));
      this.envelope.secrets[spec.key] = blob;
      // Defensive: if a value with this key existed in `values` (e.g. a
      // pre-encryption migration), drop it so we never have a stale plain
      // copy shadowing the encrypted authoritative one.
      if (spec.key in this.envelope.values) delete this.envelope.values[spec.key];
    } else {
      this.envelope.values[spec.key] = value;
      if (spec.key in this.envelope.secrets) delete this.envelope.secrets[spec.key];
    }
  }

  private flush(): Promise<void> {
    const next = this.writeChain.then(() => this.writeNow());
    this.writeChain = next.catch(() => undefined);
    return next;
  }

  private async writeNow(): Promise<void> {
    // Owner-only at rest: the envelope carries encrypted secrets and
    // credential hashes. The mode rides the tmp file through the rename,
    // so a pre-existing wider file tightens on its first flush.
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const tmp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    const body = JSON.stringify(this.envelope, null, 2);
    await fs.writeFile(tmp, body, { encoding: 'utf-8', mode: 0o600 });
    await fs.rename(tmp, this.filePath);
  }

  private fire(key: string, value: unknown): void {
    const bucket = this.listeners.get(key);
    if (!bucket) return;
    for (const fn of bucket) {
      try {
        fn(value);
      } catch (err) {
        this.log('warn', `FileBackedHostStorage: subscriber for "${key}" threw`, err);
      }
    }
  }
}
