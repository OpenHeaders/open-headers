/**
 * A log row's ref label, the reference's reading — pure. The refs on a
 * commit are listed local, then remote, then tag (HEAD ahead of them on
 * the checked-out commit); the label names the first of them, and a
 * local branch whose same-named remote branch sits on the same commit
 * says both at once: `origin & feature/auth-headers`. That joined name
 * has a short form for a narrow list — the branch alone, its folders
 * folded: `../auth-headers`.
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

/** The name a row's one label reads; null when no ref points at the commit (HEAD alone). */
export function refLabelName(refs: readonly Ref[]): RefLabelName | null {
  const [primary] = orderedRefs(refs);
  if (primary === undefined) return null;
  if (primary.kind !== 'local') return { full: primary.name, short: null };
  const remotes = refs
    .filter((ref) => ref.kind === 'remote' && ref.name.endsWith(`/${primary.name}`))
    .map((ref) => ref.name.slice(0, ref.name.length - primary.name.length - 1))
    .filter((remote) => remote.length > 0 && !remote.includes('/'));
  if (remotes.length === 0) return { full: primary.name, short: null };
  const leaf = primary.name.slice(primary.name.lastIndexOf('/') + 1);
  return {
    full: `${remotes.join(' & ')} & ${primary.name}`,
    short: leaf === primary.name ? primary.name : `../${leaf}`,
  };
}
