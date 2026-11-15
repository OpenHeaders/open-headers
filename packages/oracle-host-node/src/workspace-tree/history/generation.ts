/**
 * One reading of a repo's history — its skeleton and where the refs and
 * the checked-out commit stand on it, as rows: what every list made
 * from the history reads beside the skeleton. A reading is never
 * changed; when a tip moves the history is read again and that is
 * another generation, under another id.
 */

import { randomUUID } from 'node:crypto';
import { reachFrom } from '@openheaders/core/workspace-tree';
import { type HistorySkeleton, historyRowOf } from '../../git';
import type { HistoryTips } from './tips';

export interface HistoryGeneration {
  /** Names this reading — a list made from another reading carries another. */
  id: string;
  history: HistorySkeleton;
  tips: HistoryTips;
  /** The checked-out commit's row; -1 when the history holds none. */
  headRow: number;
  /** The row a ref's name leads to, as git resolves a name: a tag before a branch before a remote branch. */
  refRows: ReadonlyMap<string, number>;
  /** Per row: 1 where the checked-out commit reaches — the current-branch band. */
  onHead: Uint8Array;
  /** Per row: 1 where a ref points or the checked-out commit stands — a linear run never crosses one. */
  anchors: Uint8Array;
  /** Per row: 1 where a branch (local or remote) points — a lane reaching one restarts its colour. */
  branchHeads: Uint8Array;
  /** Per row: 1 on the checked-out branch's upstream — the head a topological list places last. */
  upstream: Uint8Array;
}

const NAME_ORDER = { remote: 0, local: 1, tag: 2 } as const;

export function makeGeneration(history: HistorySkeleton, tips: HistoryTips): HistoryGeneration {
  const { count } = history.skeleton;
  const headRow = tips.headSha === null ? -1 : historyRowOf(history, tips.headSha);
  const refRows = new Map<string, number>();
  const anchors = new Uint8Array(count);
  const branchHeads = new Uint8Array(count);
  const upstream = new Uint8Array(count);
  const ordered = [...tips.refs].sort((a, b) => NAME_ORDER[a.kind] - NAME_ORDER[b.kind]);
  for (const ref of ordered) {
    // A ref that names no commit the history holds (a tag on a tree, a tip newer than this reading) has no row.
    const row = historyRowOf(history, ref.sha);
    if (row === -1) continue;
    refRows.set(ref.name, row);
    anchors[row] = 1;
    if (ref.kind !== 'tag') branchHeads[row] = 1;
    if (ref.kind === 'remote' && tips.branch !== null && ref.name.endsWith(`/${tips.branch}`)) upstream[row] = 1;
  }
  if (headRow !== -1) anchors[headRow] = 1;
  return {
    id: randomUUID(),
    history,
    tips,
    headRow,
    refRows,
    onHead: reachFrom(history.skeleton, headRow === -1 ? [] : [headRow]),
    anchors,
    branchHeads,
    upstream,
  };
}
