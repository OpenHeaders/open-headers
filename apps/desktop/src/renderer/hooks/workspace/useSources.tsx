import type { V5 } from '@openheaders/core/types';
import { useCallback, useMemo } from 'react';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';

/**
 * Extract all requests from collection trees into a flat array.
 */
function flattenRequests(collections: V5.CollectionTree[]): V5.RequestNode[] {
  const result: V5.RequestNode[] = [];
  function walk(nodes: V5.TreeNode[]) {
    for (const node of nodes) {
      if (node.type === 'request') {
        result.push(node);
      } else if (node.type === 'folder') {
        walk(node.children);
      }
    }
  }
  for (const coll of collections) {
    walk(coll.tree);
  }
  return result;
}

interface UseSourcesReturn {
  sources: V5.RequestNode[];
  requestCollections: V5.CollectionTree[];
}

/**
 * Hook for request data access.
 * Returns flat list of request nodes and the full collection trees.
 * CRUD operations go through collection-level IPC (not individual request IPC yet).
 */
export function useSources(): UseSourcesReturn {
  const { requestCollections } = useCentralizedWorkspace();

  const sources = useMemo(() => flattenRequests(requestCollections), [requestCollections]);

  return {
    sources,
    requestCollections,
  };
}
