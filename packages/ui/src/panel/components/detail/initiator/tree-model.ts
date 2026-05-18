import { matchesCascadeQuery, type parseCascadeQuery } from '../../../data/cascade-filter';
import type { SubtreeStats } from '../../../data/cascade-summary';
import { computeInitiatorRowMeta, type InitiatorRowMeta } from '../../../data/initiator-row-meta';
import type { InspectorRequest } from '../../../data/types';

export type SortMode = 'initiator' | 'chronological' | 'largest';

export interface FlatRow {
  key: string;
  url: string;
  request: InspectorRequest;
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
  request: InspectorRequest;
  children: TreeNode[];
  matches: boolean;
  hasMatchInSubtree: boolean;
  parentKey: string | null;
  depth: number;
}

export function sortChildren(
  children: readonly InspectorRequest[],
  mode: SortMode,
  subtreeStats: ReadonlyMap<string, SubtreeStats>,
): readonly InspectorRequest[] {
  if (mode === 'initiator') return children;
  const arr = children.slice();
  if (mode === 'chronological') {
    arr.sort((a, b) => a.timestamp - b.timestamp);
    return arr;
  }
  // largest: own size + subtree size, descending
  arr.sort((a, b) => {
    const aw = (subtreeStats.get(a.id)?.bytes ?? 0) + (a.harEntry.response?.bodySize ?? 0);
    const bw = (subtreeStats.get(b.id)?.bytes ?? 0) + (b.harEntry.response?.bodySize ?? 0);
    return bw - aw;
  });
  return arr;
}

export function buildTree(
  root: InspectorRequest,
  getChildren: (url: string) => readonly InspectorRequest[],
  pageOrigin: string | null,
  query: ReturnType<typeof parseCascadeQuery>,
  sortMode: SortMode,
  subtreeStats: ReadonlyMap<string, SubtreeStats>,
): TreeNode {
  const useQuery = query.length > 0;
  function build(req: InspectorRequest, parentKey: string | null, depth: number, seen: ReadonlySet<string>): TreeNode {
    const key = parentKey === null ? req.id : `${parentKey}/${req.id}`;
    const meta = computeInitiatorRowMeta(req, pageOrigin);
    const matches = useQuery ? matchesCascadeQuery(req.url, meta, query) : false;
    let children: TreeNode[] = [];
    if (!seen.has(req.url)) {
      const nextSeen = new Set(seen);
      nextSeen.add(req.url);
      const sorted = sortChildren(getChildren(req.url), sortMode, subtreeStats);
      children = sorted.map((c) => build(c, key, depth + 1, nextSeen));
    }
    const hasMatchInSubtree = matches || children.some((c) => c.hasMatchInSubtree);
    return { key, request: req, children, matches, hasMatchInSubtree, parentKey, depth };
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
      url: node.request.url,
      request: node.request,
      meta: computeInitiatorRowMeta(node.request, pageOrigin),
      subtree: subtreeStats.get(node.request.id) ?? null,
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
