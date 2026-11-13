/**
 * A log row's ref labels, the reference's reading — pure. The refs on a
 * commit are listed local, then remote, then tag (HEAD ahead of them on
 * the checked-out commit). A local branch and the same-named remote
 * branches on the same commit are ONE label that says both at once —
 * `origin & feature/auth-headers` — with a short form for a narrow list:
 * the branch alone, its folders folded (`../auth-headers`).
 *
 * The compact view draws one label for the row: a glyph for everything
 * that points at the commit, named after the leading branch. The full
 * view draws a label per branch and one per tag. A tag is always a
 * glyph; its NAME shows only while Tag Names is on.
 */

import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';

type Ref = Pick<WorkspaceTreeRefWire, 'name' | 'kind'>;

const KIND_ORDER: Record<WorkspaceTreeRefWire['kind'], number> = { local: 0, remote: 1, tag: 2 };

/** The refs in the order a label lists them: local, remote, tag — each kind as it arrived. */
export function orderedRefs<T extends Ref>(refs: readonly T[]): T[] {
  return [...refs].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

export interface RefLabelName {
  full: string;
  /** What a narrow list says instead; null when the name has no shorter form. */
  short: string | null;
}

/** What a glyph stands for — its colour is the view's. */
export type RefGlyph = 'head' | WorkspaceTreeRefWire['kind'];

export interface RefLabel {
  /** The ref the label leads with (`HEAD` when it stands alone) — its identity in the row. */
  lead: string;
  /** One glyph per thing the label stands for, the leading one first. */
  glyphs: RefGlyph[];
  /** Null for a tag whose name is not shown. */
  name: RefLabelName | null;
}

interface BranchGroup {
  lead: string;
  glyphs: RefGlyph[];
  name: RefLabelName;
}

/** The remote a remote branch belongs to, when it carries `branch` itself (`origin/main` for `main`). */
function remoteOf(remoteBranch: string, branch: string): string | null {
  if (!remoteBranch.endsWith(`/${branch}`)) return null;
  const remote = remoteBranch.slice(0, remoteBranch.length - branch.length - 1);
  return remote.length > 0 && !remote.includes('/') ? remote : null;
}

/** The branches as labels: each local branch with the remotes that carry it, then the remote branches left over. */
function branchGroups(ordered: readonly Ref[]): BranchGroup[] {
  const locals = ordered.filter((ref) => ref.kind === 'local');
  const remotes = ordered.filter((ref) => ref.kind === 'remote');
  const joined = new Set<string>();
  const groups: BranchGroup[] = locals.map((local) => {
    const carriers: string[] = [];
    for (const remote of remotes) {
      const name = remoteOf(remote.name, local.name);
      if (name === null || joined.has(remote.name)) continue;
      joined.add(remote.name);
      carriers.push(name);
    }
    const leaf = local.name.slice(local.name.lastIndexOf('/') + 1);
    return {
      lead: local.name,
      glyphs: ['local', ...carriers.map((): RefGlyph => 'remote')],
      name:
        carriers.length === 0
          ? { full: local.name, short: null }
          : {
              full: `${carriers.join(' & ')} & ${local.name}`,
              short: leaf === local.name ? local.name : `../${leaf}`,
            },
    };
  });
  for (const remote of remotes) {
    if (!joined.has(remote.name)) {
      groups.push({ lead: remote.name, glyphs: ['remote'], name: { full: remote.name, short: null } });
    }
  }
  return groups;
}

/** The name a row's leading label reads; null when no ref points at the commit (HEAD alone). */
export function refLabelName(refs: readonly Ref[]): RefLabelName | null {
  const ordered = orderedRefs(refs);
  const [group] = branchGroups(ordered);
  if (group !== undefined) return group.name;
  return ordered.length > 0 ? { full: ordered[0].name, short: null } : null;
}

export interface RefLabelOptions {
  /** The row is the checked-out commit — HEAD's glyph leads. */
  isHead: boolean;
  /** One label for the row (Compact References View), or one per branch and per tag. */
  compact: boolean;
  /** Show › Tag Names — off, a tag is its glyph alone. */
  tagNames: boolean;
}

const HEAD_ALONE: RefLabel = { lead: 'HEAD', glyphs: ['head'], name: { full: 'HEAD', short: null } };

/** The labels a row draws, in order. */
export function refLabels(refs: readonly Ref[], { isHead, compact, tagNames }: RefLabelOptions): RefLabel[] {
  const ordered = orderedRefs(refs);
  const groups = branchGroups(ordered);
  const tags = ordered.filter((ref) => ref.kind === 'tag');
  if (groups.length === 0 && tags.length === 0) return isHead ? [HEAD_ALONE] : [];
  const tagName = (tag: Ref): RefLabelName | null => (tagNames ? { full: tag.name, short: null } : null);
  const head: RefGlyph[] = isHead ? ['head'] : [];

  if (compact) {
    return [
      {
        lead: ordered[0].name,
        glyphs: [...head, ...groups.flatMap((group) => group.glyphs), ...tags.map((): RefGlyph => 'tag')],
        name: groups.length > 0 ? groups[0].name : tagName(tags[0]),
      },
    ];
  }

  return [
    ...(groups.length === 0 && isHead ? [HEAD_ALONE] : []),
    ...groups.map((group, index) => ({
      lead: group.lead,
      glyphs: index === 0 ? [...head, ...group.glyphs] : group.glyphs,
      name: group.name,
    })),
    ...tags.map((tag): RefLabel => ({ lead: tag.name, glyphs: ['tag'], name: tagName(tag) })),
  ];
}
