/**
 * branch-widget-model — pure shaping for the top bar's branch widget
 * and its popup. The
 * trigger reads the status frame as a label (the branch, the detached
 * sha, the unborn branch) plus the incoming / outgoing counts; the
 * popup folds the refs into the reference sections — Recent (the
 * per-workspace ring, recency order, only names that still exist as
 * local branches), then Local / Remote / Tags as the rail's folder
 * trees — every section folded on `/` while Group By Directory is on,
 * flat full names while it is off — and prunes every section to a
 * search needle. No React.
 */

import type { WorkspaceTreeGitStatusWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { buildOrderedRefTree, buildRefTree, filterRefTree, type RefTreeNode } from '../rail/ref-tree-model';
import { shortSha } from '../short-sha';

export type BranchTriggerLabel =
  | { kind: 'branch'; name: string }
  | { kind: 'detached'; sha: string }
  | { kind: 'none' };

/** What the trigger names: the branch, the detached head's short sha, or nothing (unavailable). */
export function branchTriggerLabel(status: WorkspaceTreeGitStatusWire | null): BranchTriggerLabel {
  if (status === null || !status.bound) return { kind: 'none' };
  if (status.branch !== null) return { kind: 'branch', name: status.branch };
  if (status.headSha !== null) return { kind: 'detached', sha: shortSha(status.headSha) };
  return { kind: 'none' };
}

export interface BranchTriggerCounts {
  /** Upstream commits the local branch lacks (the reference ↙ incoming). */
  incoming: number;
  /** Local commits the upstream lacks (the reference ↗ outgoing). */
  outgoing: number;
}

/** The ahead/behind pair as the trigger's badges; zeros without an upstream. */
export function branchTriggerCounts(status: WorkspaceTreeGitStatusWire | null): BranchTriggerCounts {
  return {
    incoming: status?.behind ?? 0,
    outgoing: status?.ahead ?? 0,
  };
}

export type BranchPopupSectionKind = 'recent' | 'local' | 'remote' | 'tag';

export interface BranchPopupSection {
  kind: BranchPopupSectionKind;
  nodes: RefTreeNode[];
}

export interface BranchPopupInput {
  refs: readonly WorkspaceTreeRefWire[];
  /** The branch `gitStatus` reports but `listRefs` lacks (unborn HEAD) — rendered as the current Local leaf. */
  unbornBranch: string | null;
  /** The Recent ring, newest first. */
  recent: readonly string[];
  showTags: boolean;
  groupByDirectory: boolean;
  /** The search needle; empty shows everything. */
  search: string;
}

/**
 * The popup's sections. Group By Directory shapes ALL of them: Recent
 * folds on `/` in recency order (a folder stands where its newest
 * branch did), the three namespace sections fold like the rail; off,
 * every section lists full names. A section with no rows (or no match
 * while searching) is omitted.
 */
export function buildBranchPopupSections(input: BranchPopupInput): BranchPopupSection[] {
  const { refs, unbornBranch, recent, showTags, groupByDirectory, search } = input;
  const sections: BranchPopupSection[] = [];

  const localNames = new Set(refs.filter((ref) => ref.kind === 'local').map((ref) => ref.name));
  if (unbornBranch !== null) localNames.add(unbornBranch);
  const recentNames = recent.filter((name) => localNames.has(name));
  const recentNodes: RefTreeNode[] = groupByDirectory
    ? buildOrderedRefTree(recentNames, 'local', 'recent')
    : recentNames.map((name) => ({ kind: 'leaf', label: name, name, refKind: 'local' }));
  const recentFiltered = filterRefTree(recentNodes, search);
  if (recentFiltered.length > 0) sections.push({ kind: 'recent', nodes: recentFiltered });

  const kinds: Array<WorkspaceTreeRefWire['kind']> = showTags ? ['local', 'remote', 'tag'] : ['local', 'remote'];
  for (const kind of kinds) {
    const tree = buildRefTree(
      refs.filter((ref) => ref.kind === kind),
      kind,
      groupByDirectory,
    );
    // The unborn current branch exists only in `gitStatus` — it leads
    // the Local section as a plain leaf (the rail's posture).
    const nodes: RefTreeNode[] =
      kind === 'local' && unbornBranch !== null
        ? [{ kind: 'leaf', label: unbornBranch, name: unbornBranch, refKind: 'local' }, ...tree]
        : tree;
    const filtered = filterRefTree(nodes, search);
    if (filtered.length > 0) sections.push({ kind, nodes: filtered });
  }
  return sections;
}

/** Case-insensitive substring match for the popup's action rows. */
export function actionMatches(label: string, search: string): boolean {
  const needle = search.trim().toLowerCase();
  return needle === '' || label.toLowerCase().includes(needle);
}
