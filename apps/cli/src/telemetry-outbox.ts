/**
 * The telemetry outbox — store-and-forward for the CLI's two reporting
 * channels (the telemetry v2 plan §10, Session 5). One `oh` invocation
 * does its network work after its command has finished, and that exit
 * flush is abort-capped so a slow network can never hold a finished
 * command open; from a cold process the TLS handshake alone races the
 * cap, so an envelope the wire did not take in time is SEALED here —
 * the exact bytes the client built, its session id, state snapshot and
 * `sentAt` the facts of the run that produced it — and delivered by the
 * next invocation, whose drain fires at boot and overlaps the command's
 * own work. Delivery is decoupled from the process's lifetime:
 * at-least-once, never lost to the clock, and the cap stops deciding
 * what counts (the warehouse dedupes a redelivery by its sealed facts).
 *
 * The file sits beside `cli.json` (`telemetry-outbox.json`, 0600,
 * written whole through a rename, removed when empty) and holds a
 * handful of envelopes at most, the oldest dropped first. A usage
 * envelope carries the install id, so a channel's entries are
 * discarded the moment that channel is off — `OH_TELEMETRY=0` empties
 * the file — exactly where the identity is wiped. A worker that
 * REFUSES an envelope drops it: the shape is wrong and a retry would
 * loop; only an incomplete delivery (an abort, a network error, a
 * server-side failure) is kept, and an entry that fails a few drains
 * in a row is dropped as unrecoverable. One invocation learns the
 * network is down ONCE: the first incomplete delivery opens the
 * process's circuit, the drain stops there, and every later send of
 * the invocation seals without trying — an offline command waits for
 * one capped attempt, never one per envelope. Every file operation is
 * best-effort and silent: the outbox can never change a command's
 * outcome.
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { CLI_CONFIG_DIR_MODE, CLI_CONFIG_FILE_MODE } from '@openheaders/core/cli-config';

export const TELEMETRY_OUTBOX_FILE = 'telemetry-outbox.json';

/** Sealed envelopes kept per file, the oldest dropped first. */
export const TELEMETRY_OUTBOX_MAX_ENTRIES = 8;

/** Drains an entry may fail before it is dropped as unrecoverable. */
export const TELEMETRY_OUTBOX_MAX_ATTEMPTS = 5;

export const TELEMETRY_OUTBOX_CHANNELS = ['usage', 'errors'] as const;

export type TelemetryOutboxChannel = (typeof TELEMETRY_OUTBOX_CHANNELS)[number];

/** What one attempt on the wire came to: taken, refused by the worker, or not known to have arrived. */
export type TelemetryDelivery = 'delivered' | 'rejected' | 'undelivered';

/** One channel's wire: POST a sealed body, say what became of it; never throws. */
export interface TelemetryWire {
  deliver(body: string): Promise<TelemetryDelivery>;
}

/** One invocation's knowledge of the wire: `down` once a delivery came back unknown, read before every later try. */
export interface TelemetryDeliveryCircuit {
  down: boolean;
}

export const createDeliveryCircuit = (): TelemetryDeliveryCircuit => ({ down: false });

export interface TelemetryOutboxEntry {
  channel: TelemetryOutboxChannel;
  /** The envelope exactly as serialized for the wire. */
  body: string;
  /** Drains that failed to deliver it so far. */
  attempts: number;
}

export interface TelemetryOutbox {
  /** The sealed entries of one channel, oldest first. */
  entries(channel: TelemetryOutboxChannel): readonly TelemetryOutboxEntry[];
  /** Seal one body the wire did not take. */
  put(channel: TelemetryOutboxChannel, body: string): void;
  /** Forget a channel's entries — the channel is off. */
  discard(channel: TelemetryOutboxChannel): void;
  /**
   * Deliver the sealed entries of every channel given a wire, oldest
   * first and one at a time (the first pays the handshake, the rest
   * ride the warm connection); the first incomplete delivery opens the
   * circuit and stops the drain, and nothing is tried on an open one.
   */
  drain(
    wires: Partial<Record<TelemetryOutboxChannel, TelemetryWire>>,
    circuit: TelemetryDeliveryCircuit,
  ): Promise<void>;
  /** Resolve once every pending write has reached the disk (or silently failed). */
  settle(): Promise<void>;
}

const OUTBOX_VERSION = 1;

/** The outbox lives beside the config file it belongs to. */
export function telemetryOutboxPath(configPath: string): string {
  return path.join(path.dirname(configPath), TELEMETRY_OUTBOX_FILE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChannel(value: unknown): value is TelemetryOutboxChannel {
  return typeof value === 'string' && (TELEMETRY_OUTBOX_CHANNELS as readonly string[]).includes(value);
}

/** The file's content as entries; an unreadable file is empty, an unreadable entry is left out. */
export function parseTelemetryOutbox(raw: string): TelemetryOutboxEntry[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(parsed) || parsed.version !== OUTBOX_VERSION || !Array.isArray(parsed.entries)) return [];
  const entries: TelemetryOutboxEntry[] = [];
  for (const entry of parsed.entries) {
    if (!isRecord(entry) || !isChannel(entry.channel) || typeof entry.body !== 'string') continue;
    const attempts = typeof entry.attempts === 'number' && Number.isInteger(entry.attempts) ? entry.attempts : 0;
    entries.push({ channel: entry.channel, body: entry.body, attempts: Math.max(0, attempts) });
  }
  return entries;
}

export function serializeTelemetryOutbox(entries: readonly TelemetryOutboxEntry[]): string {
  return `${JSON.stringify({ version: OUTBOX_VERSION, entries }, null, 2)}\n`;
}

/**
 * Open the outbox at `filePath`: a missing or unreadable file is an
 * empty outbox. Writes replace the file whole (a temp file renamed into
 * place, so a crash mid-write leaves the old content) and are
 * serialized on one chain; an empty outbox removes the file.
 */
export async function openTelemetryOutbox(filePath: string): Promise<TelemetryOutbox> {
  let entries: TelemetryOutboxEntry[] = [];
  try {
    entries = parseTelemetryOutbox(await readFile(filePath, 'utf8'));
  } catch {
    // Missing or unreadable: nothing sealed.
  }
  let dirty = false;
  let writes: Promise<void> = Promise.resolve();

  const writeWhole = async (): Promise<void> => {
    if (entries.length === 0) {
      await rm(filePath, { force: true });
      return;
    }
    const temporary = `${filePath}.${process.pid}.tmp`;
    await mkdir(path.dirname(filePath), { recursive: true, mode: CLI_CONFIG_DIR_MODE });
    await writeFile(temporary, serializeTelemetryOutbox(entries), { mode: CLI_CONFIG_FILE_MODE });
    await rename(temporary, filePath);
  };

  const persist = (): void => {
    dirty = true;
    writes = writes
      .then(async () => {
        if (!dirty) return;
        dirty = false;
        await writeWhole();
      })
      .catch(() => undefined);
  };

  const dropEntry = (entry: TelemetryOutboxEntry): void => {
    entries = entries.filter((kept) => kept !== entry);
  };

  return {
    entries(channel) {
      return entries.filter((entry) => entry.channel === channel);
    },
    put(channel, body) {
      entries.push({ channel, body, attempts: 0 });
      while (entries.length > TELEMETRY_OUTBOX_MAX_ENTRIES) entries.shift();
      persist();
    },
    discard(channel) {
      const before = entries.length;
      entries = entries.filter((entry) => entry.channel !== channel);
      if (entries.length !== before) persist();
    },
    async drain(wires, circuit) {
      let changed = false;
      for (const channel of TELEMETRY_OUTBOX_CHANNELS) {
        const wire = wires[channel];
        if (!wire || circuit.down) continue;
        for (const entry of entries.filter((candidate) => candidate.channel === channel)) {
          const delivery = await wire.deliver(entry.body);
          changed = true;
          if (delivery !== 'undelivered') {
            dropEntry(entry);
            continue;
          }
          entry.attempts += 1;
          if (entry.attempts >= TELEMETRY_OUTBOX_MAX_ATTEMPTS) dropEntry(entry);
          circuit.down = true;
          break;
        }
      }
      if (changed) persist();
    },
    settle() {
      return writes;
    },
  };
}

const RETRYABLE_STATUSES = new Set([408, 429]);

/**
 * The production wire: one abort-capped POST. A 2xx is delivered; any
 * other 4xx is the worker refusing the shape (dropped — a retry would
 * loop); a timeout, a network error, a 5xx, or a 408/429 leave the
 * delivery unknown. Never throws.
 */
export function createFetchWire(endpoint: string, abortMs: number, fetchImpl: typeof fetch = fetch): TelemetryWire {
  return {
    async deliver(body) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), abortMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          signal: controller.signal,
        });
        if (response.ok) return 'delivered';
        const refused = response.status >= 400 && response.status < 500 && !RETRYABLE_STATUSES.has(response.status);
        return refused ? 'rejected' : 'undelivered';
      } catch {
        return 'undelivered';
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
}

/**
 * A channel's transport for the core controllers: serialize, try the
 * wire once unless the circuit is already open, seal what it did not
 * take. Always resolves `true` — the envelope's fate is settled here
 * (delivered, sealed for the next invocation, or refused and dropped),
 * and a controller's own retry would only repeat a refused shape or
 * duplicate what the outbox holds.
 */
export function createSpoolingTransport<T>(
  outbox: TelemetryOutbox,
  channel: TelemetryOutboxChannel,
  wire: TelemetryWire,
  circuit: TelemetryDeliveryCircuit,
): { send(envelope: T): Promise<boolean> } {
  return {
    async send(envelope) {
      const body = JSON.stringify(envelope);
      let delivery: TelemetryDelivery = 'undelivered';
      if (!circuit.down) {
        try {
          delivery = await wire.deliver(body);
        } catch {
          delivery = 'undelivered';
        }
      }
      if (delivery === 'undelivered') {
        circuit.down = true;
        outbox.put(channel, body);
      }
      return true;
    },
  };
}
