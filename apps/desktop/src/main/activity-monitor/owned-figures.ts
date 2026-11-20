/**
 * The owners of what this host started itself (the activity monitor
 * plan §6, laws 5 and 13): a terminal session, the git object reader,
 * the HTTP/3 helper. One read per OWNER — its figures are the total of
 * every root it has registered and everything that runs beneath each,
 * found by walking down from the root. An owner keeps its identity
 * while its processes come and go, so its history does too.
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
  totalProcessCost,
} from '@openheaders/oracle-host-node/process-reader';

const OWNER_ROW_KIND: Record<ProcessRootKind, ActivityMonitorProcessKind> = {
  terminal: 'terminal',
  'git-objects': 'git',
  'h3-helper': 'http3-helper',
  'script-runtime': 'script-runtime',
};

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
  /** Every process alive beneath the owner, its roots among them. */
  processCount: number;
  /**
   * The subtree's CPU seconds so far — a total that can fall, which the
   * sampler's fold clamps. Absent where no process's cost could be read.
   */
  cumulativeCpuSeconds: number | undefined;
  memoryBytes: number | null;
}

interface OwnerSubtrees {
  owner: ProcessRootOwner;
  oldest: ProcessRecord;
  records: ProcessRecord[];
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
    if (subtree.length === 0) continue;
    const key = processRootOwnerKey(registered.owner);
    const known = owners.get(key);
    if (known === undefined) {
      owners.set(key, { owner: registered.owner, oldest: subtree[0], records: subtree });
      continue;
    }
    known.records.push(...subtree);
    if (subtree[0].startedAt < known.oldest.startedAt) known.oldest = subtree[0];
  }

  const reads: OwnedProcessRead[] = [];
  for (const [id, { owner, oldest, records }] of owners) {
    const total = totalProcessCost(records);
    reads.push({
      id,
      kind: OWNER_ROW_KIND[owner.kind],
      ...(owner.kind === 'terminal' && owner.id !== undefined ? { terminalSessionId: owner.id } : {}),
      pid: oldest.pid,
      startedAt: oldest.startedAt,
      processCount: records.length,
      cumulativeCpuSeconds: total.cpuSeconds ?? undefined,
      memoryBytes: total.memoryBytes,
    });
  }
  return reads;
}
