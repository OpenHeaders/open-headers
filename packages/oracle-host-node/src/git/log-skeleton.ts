/**
 * A whole history's skeleton — every commit every ref reaches, in the
 * log's order, as rows by number: what the log's models read
 * (`LogSkeleton`), with the hash behind each row and a way back from a
 * hash to its row.
 *
 * One streamed `rev-list --parents`, read as it arrives and packed as
 * it is read: a hash is its bytes, a parent is a row number, and no
 * string or object is held per commit — a million commits are tens of
 * megabytes, not hundreds. The hashes are found again through one
 * open-addressed table over the packed bytes (a hash is already
 * uniform, so its first four bytes are its slot).
 *
 * Nothing here holds the host's thread: the read is the stream's, and
 * the two passes after it — the table, the parents — are taken a
 * stretch at a time.
 */

import type { LogSkeleton } from '@openheaders/core/workspace-tree';
import { breathe } from './breathe';
import type { GitRunner } from './git-exec';
import type { GitStreamRunner } from './git-stream';
import { LOG_ORDER, resolveCommitWalk } from './repo';
import { repoArgs } from './repo-args';

/** Rows a pass reads before it hands the thread back. */
const STRETCH_ROWS = 20_000;

export interface HistorySkeleton {
  skeleton: LogSkeleton;
  /** Bytes a hash takes — 20, or 32 in a SHA-256 repo. */
  width: number;
  /** Row `i`'s hash is `hashes[i * width .. (i + 1) * width)`. */
  hashes: Buffer;
  /** Slot → row, -1 where empty; a power of two long. */
  table: Int32Array;
}

export type ReadLogSkeletonResult =
  | { ok: true; history: HistorySkeleton }
  | { ok: false; reason: 'timeout' | 'aborted' | 'failed' };

export interface ReadLogSkeletonOptions {
  timeoutMs: number;
  /** Ends the read — nobody waits for this history any more. */
  signal?: AbortSignal;
}

/** A buffer of fixed-width records that doubles when it is full. */
class Packed {
  bytes = Buffer.alloc(1 << 16);
  count = 0;

  constructor(readonly width: number) {}

  push(hex: string): void {
    if ((this.count + 1) * this.width > this.bytes.length) {
      this.bytes = Buffer.concat([this.bytes, Buffer.alloc(this.bytes.length)]);
    }
    this.bytes.write(hex, this.count * this.width, 'hex');
    this.count += 1;
  }
}

/** The walk's output as it is read: a line a commit — its hash, then its parents' hashes, a space between each. */
class SkeletonReading {
  commits: Packed | null = null;
  pointers: Packed | null = null;
  /** Where each row's parents start among the pointers. */
  readonly starts: number[] = [0];
  /** A line that is no line of hashes was read — the read is not a history. */
  malformed = false;
  /** The line a chunk ended in the middle of; it waits for the next chunk. */
  rest = '';
  /** Characters a hash takes, known from the first line. */
  private hex = 0;

  take(chunk: string): void {
    const text = this.rest + chunk;
    const cut = text.lastIndexOf('\n');
    this.rest = text.slice(cut + 1);
    let at = 0;
    while (at < cut && !this.malformed) {
      const end = text.indexOf('\n', at);
      if (this.commits === null || this.pointers === null) {
        const space = text.indexOf(' ', at);
        this.hex = (space === -1 || space > end ? end : space) - at;
        if (this.hex !== 40 && this.hex !== 64) {
          this.malformed = true;
          return;
        }
        this.commits = new Packed(this.hex / 2);
        this.pointers = new Packed(this.hex / 2);
      }
      if ((end - at + 1) % (this.hex + 1) !== 0) {
        this.malformed = true;
        return;
      }
      this.commits.push(text.slice(at, at + this.hex));
      for (let parent = at + this.hex + 1; parent < end; parent += this.hex + 1) {
        this.pointers.push(text.slice(parent, parent + this.hex));
      }
      this.starts.push(this.pointers.count);
      at = end + 1;
    }
  }
}

function slotOf(bytes: Buffer, offset: number, mask: number): number {
  return bytes.readUInt32BE(offset) & mask;
}

/** The row of the hash at `offset` of `bytes`; -1 when the history does not hold it. */
function findRow(history: Pick<HistorySkeleton, 'hashes' | 'table' | 'width'>, bytes: Buffer, offset: number): number {
  const { hashes, table, width } = history;
  const mask = table.length - 1;
  let slot = slotOf(bytes, offset, mask);
  for (let row = table[slot]; row !== -1; row = table[slot]) {
    if (hashes.compare(bytes, offset, offset + width, row * width, (row + 1) * width) === 0) return row;
    slot = (slot + 1) & mask;
  }
  return -1;
}

/**
 * The row of a hash held packed — `history.width` bytes of `bytes` from
 * `offset`, as another reading of the same repo holds its own; -1 when
 * this history does not hold it.
 */
export function historyRowOfPacked(history: HistorySkeleton, bytes: Buffer, offset: number): number {
  return findRow(history, bytes, offset);
}

/** The row a full hash sits on; -1 for one the history does not hold, or for anything that is no full hash. */
export function historyRowOf(history: HistorySkeleton, sha: string): number {
  if (sha.length !== history.width * 2 || !/^[0-9a-f]+$/.test(sha)) return -1;
  return findRow(history, Buffer.from(sha, 'hex'), 0);
}

/** The hash of a row. */
export function historyShaOf(history: HistorySkeleton, row: number): string {
  return history.hashes.toString('hex', row * history.width, (row + 1) * history.width);
}

/**
 * The first row whose hash starts with `prefix` (lowercase hex), in the
 * log's order; -1 for none. One pass over the packed hashes — a lookup
 * a person asks for, not one a list is built from.
 */
export function historyRowOfPrefix(history: HistorySkeleton, prefix: string): number {
  if (prefix.length === 0 || prefix.length > history.width * 2 || !/^[0-9a-f]+$/.test(prefix)) return -1;
  const whole = Buffer.from(prefix.slice(0, prefix.length - (prefix.length % 2)), 'hex');
  const half = prefix.length % 2 === 1 ? Number.parseInt(prefix[prefix.length - 1], 16) : -1;
  const { hashes, width } = history;
  for (let row = 0; row < history.skeleton.count; row += 1) {
    const at = row * width;
    if (hashes.compare(whole, 0, whole.length, at, at + whole.length) !== 0) continue;
    if (half === -1 || hashes[at + whole.length] >> 4 === half) return row;
  }
  return -1;
}

const EMPTY: HistorySkeleton = {
  skeleton: { count: 0, starts: new Int32Array(1), parents: new Int32Array(0) },
  width: 20,
  hashes: Buffer.alloc(0),
  table: new Int32Array(1).fill(-1),
};

/**
 * Read the history every ref and the checked-out commit reach. A repo
 * with no commit yet answers an empty history; a parent the walk never
 * lists (a shallow clone's edge) is numbered past the history's end.
 */
export async function readLogSkeleton(
  stream: GitStreamRunner,
  run: GitRunner,
  rootDir: string,
  options: ReadLogSkeletonOptions,
): Promise<ReadLogSkeletonResult> {
  const walk = await resolveCommitWalk(run, rootDir, undefined, { allRefs: true });
  if (walk === null || walk === 'empty') return { ok: false, reason: 'failed' };

  const reading = new SkeletonReading();
  const result = await stream(
    [...repoArgs(rootDir), 'rev-list', LOG_ORDER, '--parents', ...walk.args],
    { cwd: rootDir, timeoutMs: options.timeoutMs, ...(options.signal !== undefined ? { signal: options.signal } : {}) },
    (chunk) => reading.take(chunk),
  );
  if (result.timedOut) return { ok: false, reason: 'timeout' };
  if (result.aborted) return { ok: false, reason: 'aborted' };
  if (result.code !== 0) {
    // Every ref over a repo with none: an empty history, not a failure.
    return walk.mayBeEmpty ? { ok: true, history: EMPTY } : { ok: false, reason: 'failed' };
  }
  if (reading.malformed || reading.rest.length > 0) return { ok: false, reason: 'failed' };
  if (reading.commits === null || reading.pointers === null) return { ok: true, history: EMPTY };
  return { ok: true, history: await build(reading.commits, reading.pointers, reading.starts) };
}

async function build(commits: Packed, pointers: Packed, starts: number[]): Promise<HistorySkeleton> {
  const { width } = commits;
  const { count } = commits;
  // A copy at its own size: the buffer it grew in is up to twice as long.
  const hashes = Buffer.from(commits.bytes.subarray(0, count * width));
  let size = 2;
  while (size < count * 2) size *= 2;
  const table = new Int32Array(size).fill(-1);
  const mask = size - 1;
  for (let row = 0; row < count; row += 1) {
    if (row % STRETCH_ROWS === STRETCH_ROWS - 1) await breathe();
    let slot = slotOf(hashes, row * width, mask);
    while (table[slot] !== -1) slot = (slot + 1) & mask;
    table[slot] = row;
  }

  // A parent the walk never listed is outside the history: each one its own number past the end.
  const parents = new Int32Array(pointers.count);
  const outside = new Map<string, number>();
  const found = { hashes, table, width };
  for (let pointer = 0; pointer < pointers.count; pointer += 1) {
    if (pointer % STRETCH_ROWS === STRETCH_ROWS - 1) await breathe();
    let row = findRow(found, pointers.bytes, pointer * width);
    if (row === -1) {
      const sha = pointers.bytes.toString('hex', pointer * width, (pointer + 1) * width);
      row = outside.get(sha) ?? count + outside.size;
      outside.set(sha, row);
    }
    parents[pointer] = row;
  }
  return { skeleton: { count, starts: Int32Array.from(starts), parents }, width, hashes, table };
}
