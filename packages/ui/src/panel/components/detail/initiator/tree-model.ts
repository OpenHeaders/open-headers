import { matchesCascadeQuery, type parseCascadeQuery } from '../../../data/cascade/cascade-filter';
import type { SubtreeStats } from '../../../data/cascade/cascade-summary';
import { computeInitiatorRowMeta, type InitiatorRowMeta } from '../../../data/initiator/initiator-row-meta';
import { type InspectorRowWithFires, lifecycleTransferredBytes } from '../../../data/inspector-row-projection';

export type SortMode = 'initiator' | 'chronological' | 'largest';

export interface FlatRow {
  key: string;
  url: string;
  row: InspectorRowWithFires;
  meta: InitiatorRowMeta;
  subtree: SubtreeStats | null;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  parentKey: string | null;
  isAnchor: boolean;
  matches: boolean;
}

export interface TreeNode {
  key: string;
  row: InspectorRowWithFires;
  children: TreeNode[];
  matches: boolean;
  hasMatchInSubtree: boolean;
  parentKey: string | null;
  depth: number;
}

export function sortChildren(
  children: readonly InspectorRowWithFires[],
  mode: SortMode,
  subtreeStats: ReadonlyMap<string, SubtreeStats>,
): readonly InspectorRowWithFires[] {
  if (mode === 'initiator') return children;
  const arr = children.slice();
  if (mode === 'chronological') {
    arr.sort((a, b) => a.lifecycle.startedAtMs - b.lifecycle.startedAtMs);
    return arr;
  }
  // largest: own size + subtree size, descending
  arr.sort((a, b) => {
    const aw = (subtreeStats.get(a.lifecycle.requestId)?.bytes ?? 0) + (lifecycleTransferredBytes(a.lifecycle) ?? 0);
    const bw = (subtreeStats.get(b.lifecycle.requestId)?.bytes ?? 0) + (lifecycleTransferredBytes(b.lifecycle) ?? 0);
    return bw - aw;
  });
  return arr;
}

export function buildTree(
  root: InspectorRowWithFires,
  getChildren: (url: string) => readonly InspectorRowWithFires[],
  pageOrigin: string | null,
  query: ReturnType<typeof parseCascadeQuery>,
  sortMode: SortMode,
  subtreeStats: ReadonlyMap<string, SubtreeStats>,
): TreeNode {
  const useQuery = query.length > 0;
  function build(
    current: InspectorRowWithFires,
    parentKey: string | null,
    depth: number,
    seen: ReadonlySet<string>,
  ): TreeNode {
    const id = current.lifecycle.requestId;
    const key = parentKey === null ? id : `${parentKey}/${id}`;
    const meta = computeInitiatorRowMeta(current.lifecycle, pageOrigin);
    const matches = useQuery ? matchesCascadeQuery(current.lifecycle.url, meta, query) : false;
    let children: TreeNode[] = [];
    if (!seen.has(current.lifecycle.url)) {
      const nextSeen = new Set(seen);
      nextSeen.add(current.lifecycle.url);
      const sorted = sortChildren(getChildren(current.lifecycle.url), sortMode, subtreeStats);
      children = sorted.map((c) => build(c, key, depth + 1, nextSeen));
    }
    const hasMatchInSubtree = matches || children.some((c) => c.hasMatchInSubtree);
    return { key, row: current, children, matches, hasMatchInSubtree, parentKey, depth };
  }
  return build(root, null, 0, new Set());
}

export function flattenTree(
  tree: TreeNode,
  expanded: ReadonlyMap<string, boolean>,
  filtering: boolean,
  pageOrigin: string | null,
  subtreeStats: ReadonlyMap<string, SubtreeStats>,
): FlatRow[] {
  const out: FlatRow[] = [];
  function walk(node: TreeNode): void {
    if (filtering && !node.hasMatchInSubtree) return;
    const visibleChildren = filtering ? node.children.filter((c) => c.hasMatchInSubtree) : node.children;
    const hasChildren = visibleChildren.length > 0;
    const isExpanded = filtering ? true : (expanded.get(node.key) ?? true);
    out.push({
      key: node.key,
      url: node.row.lifecycle.url,
      row: node.row,
      meta: computeInitiatorRowMeta(node.row.lifecycle, pageOrigin),
      subtree: subtreeStats.get(node.row.lifecycle.requestId) ?? null,
      depth: node.depth,
      hasChildren,
      expanded: isExpanded,
      parentKey: node.parentKey,
      isAnchor: node.parentKey === null,
      matches: node.matches,
    });
    if (hasChildren && isExpanded) {
      for (const c of visibleChildren) walk(c);
    }
  }
  walk(tree);
  return out;
}
