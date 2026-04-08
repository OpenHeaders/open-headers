import type { V5 } from '@openheaders/core/types';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';

interface UseHeaderRulesReturn {
  rules: V5.Rule[];
  ruleCollections: V5.CollectionTree[];
}

/**
 * Hook for rules data access.
 * Returns flat array of all rules and the rule collection trees.
 */
export function useHeaderRules(): UseHeaderRulesReturn {
  const { rules, ruleCollections } = useCentralizedWorkspace();

  return {
    rules,
    ruleCollections,
  };
}
