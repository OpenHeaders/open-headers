/**
 * The registry of the roots we start (the activity monitor plan §6, law
 * 5): every OS child is registered where it is spawned, with the owner
 * it runs for, and what runs beneath it is found from that root — by
 * walking down from it, or, where the platform's reader holds roots,
 * from what the reader holds of it (the plan §7, fork 3).
 *
 * A root's start time is read ONCE, at the spawn, through the host's
 * reader — the one instant the pid is certainly ours — so no clock of
 * ours is ever set against the reader's. A host with no reader holds no
 * root: it has no figure to give for one.
 */

import {
  type HeldProcessRoot,
  type ProcessReader,
  type ProcessRecord,
  type ProcessRoot,
  readProcessDescendants,
} from './seam';

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
  /** What the reader holds of the root, from its registration to its release — absent where roots are walked. */
  held?: HeldProcessRoot;
}

export interface ProcessRootRegistration {
  /** The root as the reader saw it at the spawn; null where the host has no reader, or the process was already gone. */
  registered: RegisteredProcessRoot | null;
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

const NOT_HELD: ProcessRootRegistration = { registered: null, release: () => undefined };

export function createProcessRootRegistry(initialReader: ProcessReader | null = null): ProcessRootRegistry {
  let reader = initialReader;
  const entries = new Set<RegisteredProcessRoot>();

  return {
    attachReader(next) {
      reader = next;
    },
    register(owner, pid, options = {}) {
      if (reader === null || pid === undefined) return NOT_HELD;
      const record = reader.read(pid);
      if (record === null) return NOT_HELD;
      const root: ProcessRoot = { pid, startedAt: record.startedAt };
      const terminal = options.terminal === true;
      // Held at once: what the root starts from here on is the system's to list.
      const held = reader.holdRoot?.(root, { terminal }) ?? null;
      const entry: RegisteredProcessRoot = { owner, root, terminal, ...(held === null ? {} : { held }) };
      entries.add(entry);
      return {
        registered: entry,
        release: () => {
          if (entries.delete(entry)) held?.release();
        },
      };
    },
    list: () => [...entries],
  };
}

/** The host process's one registry: every spawn site registers here unless it is handed another. */
export const hostProcessRoots: ProcessRootRegistry = createProcessRootRegistry();

/** An owner's key: the same for every root it starts, so its history outlives each of them. */
export function processRootOwnerKey(owner: ProcessRootOwner): string {
  return owner.id === undefined ? owner.kind : `${owner.kind}:${owner.id}`;
}

/** What a set of processes has cost, added up. */
export interface ProcessSubtreeCost {
  /**
   * CPU seconds. Of a walked root: each process's own time plus that of
   * its children that exited and were waited for (the plan §6, law 13)
   * — so a child that comes and goes between two reads is still
   * counted. It can FALL: a process that outlived its parent takes its
   * time with it when it ends, and between a child's exit and its
   * parent's wait the time is in neither place. A reader of two totals
   * clamps the difference. Of a held root: the system's own count of
   * everything that has run in it. null where no process's cost could
   * be read.
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

/** A registered root and everything that runs beneath it, at one read. */
export interface ProcessSubtree {
  /** The root's own processes, the root first: the owner's row itself, never a line beneath it. */
  own: ProcessRecord[];
  /** What runs beneath the root, each with its own record. */
  beneath: ProcessRecord[];
  /**
   * Every process alive in it. Of a held root the system's own list
   * counts: a process the system will not let be read is counted, and
   * has no record.
   */
  processCount: number;
  cost: ProcessSubtreeCost;
}

/** What the reader holds of a root, read: membership and the whole CPU are the system's, each figure the process's own. */
function readHeldSubtree(reader: ProcessReader, root: ProcessRecord, held: HeldProcessRoot): ProcessSubtree {
  const members = held.memberPids();
  const own = [root];
  const beneath: ProcessRecord[] = [];
  let unread = 0;
  for (const pid of members) {
    if (pid === root.pid) continue;
    const isOwn = held.ownPids.includes(pid);
    const record = reader.read(pid);
    if (record !== null) (isOwn ? own : beneath).push(record);
    else if (!isOwn) unread += 1;
  }
  return {
    own,
    beneath,
    processCount: own.length + beneath.length + unread,
    cost: { cpuSeconds: held.cpuSeconds(), memoryBytes: totalProcessCost([...own, ...beneath]).memoryBytes },
  };
}

/** null when the root is gone or its pid now names another process. */
export function readProcessSubtree(reader: ProcessReader, registered: RegisteredProcessRoot): ProcessSubtree | null {
  const root = reader.read(registered.root.pid);
  if (root === null || root.startedAt !== registered.root.startedAt) return null;
  if (registered.held !== undefined) return readHeldSubtree(reader, root, registered.held);
  const beneath = readProcessDescendants(reader, registered.root, { terminal: registered.terminal });
  return { own: [root], beneath, processCount: 1 + beneath.length, cost: totalProcessCost([root, ...beneath]) };
}
