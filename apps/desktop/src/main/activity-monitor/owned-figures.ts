/**
 * The owners of what this host started itself (the activity monitor
 * plan §6, laws 5 and 13): a terminal session, the git object reader,
 * the HTTP/3 helper. One read per OWNER — its figures are the total of
 * every root it has registered and everything that runs beneath each,
 * found from the root: walked down from it, or read from what the
 * host's reader holds of it (the plan §7, fork 3). An owner keeps its
 * identity while its processes come and go, so its history does too.
 * What runs beneath its roots rides along, each process with its own
 * figures: it is shown live and has no history of its own.
 */

import type { ActivityMonitorProcessKind } from '@openheaders/core/activity-monitor';
import {
  type ProcessReader,
  type ProcessRecord,
  type ProcessRootKind,
  type ProcessRootOwner,
  processRootOwnerKey,
  type RegisteredProcessRoot,
  readProcessSubtree,
} from '@openheaders/oracle-host-node/process-reader';

const OWNER_ROW_KIND: Record<ProcessRootKind, ActivityMonitorProcessKind> = {
  terminal: 'terminal',
  'git-objects': 'git',
  'h3-helper': 'http3-helper',
  'script-runtime': 'script-runtime',
};

/** One process beneath an owner's roots at one read (the plan §6, laws 12 and 13). */
export interface OwnedChildRead {
  pid: number;
  /** ms since epoch, by the reader's record. */
  startedAt: number;
  /** The base name of its executable; null where the system would not say. */
  name: string | null;
  /**
   * The CPU seconds it has used ITSELF so far — its exited children's
   * time is in the owner's total and in no line beneath it. Absent
   * where its cost could not be read.
   */
  cumulativeCpuSeconds: number | undefined;
  memoryBytes: number | null;
}

/** One owner at one read. */
export interface OwnedProcessRead {
  /** The owner's key — the row's identity, whichever processes it holds. */
  id: string;
  kind: ActivityMonitorProcessKind;
  terminalSessionId?: string;
  /** The root it started first, of those alive. */
  pid: number;
  /** ms since epoch, by the reader's record. */
  startedAt: number;
  /** Every process alive beneath the owner, its roots among them — one the system will not let be read counted too. */
  processCount: number;
  /**
   * The subtree's CPU seconds so far — a total that can fall, which the
   * sampler's fold clamps. Absent where no process's cost could be read.
   */
  cumulativeCpuSeconds: number | undefined;
  memoryBytes: number | null;
  /** What runs beneath its roots, the older process first — the roots themselves are the owner's row. */
  children: OwnedChildRead[];
}

interface OwnerSubtrees {
  owner: ProcessRootOwner;
  /** The root it started first, of those alive. */
  oldest: ProcessRecord;
  processCount: number;
  cpuSeconds: number | null;
  memoryBytes: number | null;
  beneath: ProcessRecord[];
}

/** Two figures added up; a figure that could not be read adds nothing, and two of them are none. */
function added(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  return b === null ? a : a + b;
}

function childReads(beneath: readonly ProcessRecord[]): OwnedChildRead[] {
  return [...beneath]
    .sort((a, b) => a.startedAt - b.startedAt || a.pid - b.pid)
    .map((record) => ({
      pid: record.pid,
      startedAt: record.startedAt,
      name: record.name,
      cumulativeCpuSeconds: record.cost?.cpuSeconds,
      memoryBytes: record.cost?.memoryBytes ?? null,
    }));
}

/** An owner whose every root is gone has no read: its row ends, and returns with its next root. */
export function readOwnedFigures(
  roots: readonly RegisteredProcessRoot[],
  reader: ProcessReader | null,
): OwnedProcessRead[] {
  if (reader === null) return [];
  const owners = new Map<string, OwnerSubtrees>();
  for (const registered of roots) {
    const subtree = readProcessSubtree(reader, registered);
    if (subtree === null) continue;
    const [root] = subtree.own;
    const key = processRootOwnerKey(registered.owner);
    const known = owners.get(key);
    if (known === undefined) {
      owners.set(key, {
        owner: registered.owner,
        oldest: root,
        processCount: subtree.processCount,
        cpuSeconds: subtree.cost.cpuSeconds,
        memoryBytes: subtree.cost.memoryBytes,
        beneath: subtree.beneath,
      });
      continue;
    }
    known.processCount += subtree.processCount;
    known.cpuSeconds = added(known.cpuSeconds, subtree.cost.cpuSeconds);
    known.memoryBytes = added(known.memoryBytes, subtree.cost.memoryBytes);
    known.beneath.push(...subtree.beneath);
    if (root.startedAt < known.oldest.startedAt) known.oldest = root;
  }

  const reads: OwnedProcessRead[] = [];
  for (const [id, { owner, oldest, processCount, cpuSeconds, memoryBytes, beneath }] of owners) {
    reads.push({
      id,
      kind: OWNER_ROW_KIND[owner.kind],
      ...(owner.kind === 'terminal' && owner.id !== undefined ? { terminalSessionId: owner.id } : {}),
      pid: oldest.pid,
      startedAt: oldest.startedAt,
      processCount,
      cumulativeCpuSeconds: cpuSeconds ?? undefined,
      memoryBytes,
      children: childReads(beneath),
    });
  }
  return reads;
}
