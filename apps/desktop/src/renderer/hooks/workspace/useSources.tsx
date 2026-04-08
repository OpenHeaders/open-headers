import type { V5 } from '@openheaders/core/types';
import { useCallback, useMemo } from 'react';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';
import { showMessage } from '@/renderer/utils';

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

interface UseRequestsReturn {
  requests: V5.RequestNode[];
  requestCollections: V5.CollectionTree[];
  getRequest: (uid: string) => Promise<V5.Request | null>;
  addRequest: (collectionUid: string, request: Omit<V5.Request, 'uid' | 'path'>) => Promise<V5.Request | null>;
  updateRequest: (uid: string, updates: Partial<V5.Request>) => Promise<boolean>;
  removeRequest: (uid: string) => Promise<boolean>;
}

/**
 * Hook for request data access and CRUD.
 * Returns flat list of request nodes, full collection trees, and mutation callbacks.
 */
export function useRequests(): UseRequestsReturn {
  const { requestCollections, service } = useCentralizedWorkspace();

  const requests = useMemo(() => flattenRequests(requestCollections), [requestCollections]);

  const getRequest = useCallback(
    async (uid: string): Promise<V5.Request | null> => {
      try {
        return await service.getRequest(uid);
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [service],
  );

  const addRequest = useCallback(
    async (collectionUid: string, request: Omit<V5.Request, 'uid' | 'path'>): Promise<V5.Request | null> => {
      try {
        return await service.addRequest(collectionUid, request);
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [service],
  );

  const updateRequest = useCallback(
    async (uid: string, updates: Partial<V5.Request>): Promise<boolean> => {
      try {
        await service.updateRequest(uid, updates);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const removeRequest = useCallback(
    async (uid: string): Promise<boolean> => {
      try {
        await service.removeRequest(uid);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  return {
    requests,
    requestCollections,
    getRequest,
    addRequest,
    updateRequest,
    removeRequest,
  };
}
