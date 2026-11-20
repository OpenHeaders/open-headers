/**
 * The registry of the roots we start (the activity monitor plan §6, law
 * 5): every OS child is registered where it is spawned, with the owner
 * it runs for, and what runs beneath it is found by walking down from
 * that root.
 *
 * A root's start time is read ONCE, at the spawn, through the host's
 * reader — the one instant the pid is certainly ours — so no clock of
 * ours is ever set against the reader's. A host with no reader holds no
 * root: it has no figure to give for one.
 */

import { type ProcessReader, type ProcessRecord, type ProcessRoot, readProcessDescendants } from './seam';

/** What starts OS children on a host, in the host's own words — never a name the interface shows. */
export type ProcessRootKind = 'terminal' | 'git-objects' | 'h3-helper' | 'script-runtime';

/**
 * Who a root runs for. An owner outlives the processes it starts: a
 * helper that exits and is started again is the same owner.
 */
export interface ProcessRootOwner {
  kind: ProcessRootKind;
  /** Which one of its kind, where a host runs more than one — a terminal session's id. */
  id?: string;
}

export interface ProcessRootOptions {
  /** The root is a terminal's shell: what shares its terminal belongs to it too. */
  terminal?: boolean;
}

export interface RegisteredProcessRoot {
  owner: ProcessRootOwner;
  root: ProcessRoot;
  terminal: boolean;
}

export interface ProcessRootRegistration {
  /** The root as the reader saw it at the spawn; null where the host has no reader, or the process was already gone. */
  root: ProcessRoot | null;
  /** The process has ended, or is being let go of. Safe to call more than once. */
  release(): void;
}

export interface ProcessRootRegistry {
  /** The host's reader, composed once at boot — before anything is spawned. */
  attachReader(reader: ProcessReader | null): void;
  /** Called where the child is spawned, with the pid the spawn handed back — absent when the spawn failed. */
  register(owner: ProcessRootOwner, pid: number | undefined, options?: ProcessRootOptions): ProcessRootRegistration;
  /** Every root still held, in the order they were registered. */
  list(): RegisteredProcessRoot[];
}

const NOT_HELD: ProcessRootRegistration = { root: null, release: () => undefined };

export function createProcessRootRegistry(initialReader: ProcessReader | null = null): ProcessRootRegistry {
  let reader = initialReader;
  const held = new Set<RegisteredProcessRoot>();

  return {
    attachReader(next) {
      reader = next;
    },
    register(owner, pid, options = {}) {
      if (reader === null || pid === undefined) return NOT_HELD;
      const record = reader.read(pid);
      if (record === null) return NOT_HELD;
      const entry: RegisteredProcessRoot = {
        owner,
        root: { pid, startedAt: record.startedAt },
        terminal: options.terminal === true,
      };
      held.add(entry);
      return { root: entry.root, release: () => void held.delete(entry) };
    },
    list: () => [...held],
  };
}

/** The host process's one registry: every spawn site registers here unless it is handed another. */
export const hostProcessRoots: ProcessRootRegistry = createProcessRootRegistry();

/** An owner's key: the same for every root it starts, so its history outlives each of them. */
export function processRootOwnerKey(owner: ProcessRootOwner): string {
  return owner.id === undefined ? owner.kind : `${owner.kind}:${owner.id}`;
}

/**
 * A root and everything beneath it, the root first. Empty when the root
 * is gone or its pid now names another process.
 */
export function readProcessSubtree(reader: ProcessReader, registered: RegisteredProcessRoot): ProcessRecord[] {
  const record = reader.read(registered.root.pid);
  if (record === null || record.startedAt !== registered.root.startedAt) return [];
  return [record, ...readProcessDescendants(reader, registered.root, { terminal: registered.terminal })];
}

/** What a set of processes has cost, added up. */
export interface ProcessSubtreeCost {
  /**
   * CPU seconds: each process's own time plus that of its children that
   * exited and were waited for (the plan §6, law 13) — so a child that
   * comes and goes between two reads is still counted. It can FALL: a
   * process that outlived its parent takes its time with it when it
   * ends, and between a child's exit and its parent's wait the time is
   * in neither place. A reader of two totals clamps the difference.
   * null where no process's cost could be read.
   */
  cpuSeconds: number | null;
  /** A point sample; null where no process's cost could be read. */
  memoryBytes: number | null;
}

export function totalProcessCost(records: readonly ProcessRecord[]): ProcessSubtreeCost {
  let cpuSeconds: number | null = null;
  let memoryBytes: number | null = null;
  for (const { cost } of records) {
    if (cost === null) continue;
    cpuSeconds = (cpuSeconds ?? 0) + cost.cpuSeconds + cost.exitedChildrenCpuSeconds;
    memoryBytes = (memoryBytes ?? 0) + cost.memoryBytes;
  }
  return { cpuSeconds, memoryBytes };
}
