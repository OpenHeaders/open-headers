import type { V5 } from '@openheaders/core/types';
import { useCallback } from 'react';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';
import { showMessage } from '@/renderer/utils';

interface UseHeaderRulesReturn {
  rules: V5.Rule[];
  ruleCollections: V5.CollectionTree[];
  addRule: (collectionUid: string, rule: Omit<V5.Rule, 'uid' | 'path'>) => Promise<V5.Rule | null>;
  updateRule: (uid: string, updates: Partial<V5.Rule>) => Promise<boolean>;
  removeRule: (uid: string) => Promise<boolean>;
  toggleRule: (uid: string, enabled: boolean) => Promise<boolean>;
}

/**
 * Hook for rules data access and CRUD.
 * Returns flat array of all rules, rule collection trees, and mutation callbacks.
 */
export function useHeaderRules(): UseHeaderRulesReturn {
  const { rules, ruleCollections, service } = useCentralizedWorkspace();

  const addRule = useCallback(
    async (collectionUid: string, rule: Omit<V5.Rule, 'uid' | 'path'>): Promise<V5.Rule | null> => {
      try {
        return await service.addRule(collectionUid, rule);
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [service],
  );

  const updateRule = useCallback(
    async (uid: string, updates: Partial<V5.Rule>): Promise<boolean> => {
      try {
        await service.updateRule(uid, updates);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const removeRule = useCallback(
    async (uid: string): Promise<boolean> => {
      try {
        await service.removeRule(uid);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const toggleRule = useCallback(
    async (uid: string, enabled: boolean): Promise<boolean> => {
      try {
        await service.toggleRule(uid, enabled);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  return {
    rules,
    ruleCollections,
    addRule,
    updateRule,
    removeRule,
    toggleRule,
  };
}
