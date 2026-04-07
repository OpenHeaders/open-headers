import type { HeaderRule } from '@openheaders/core';
import { useCallback } from 'react';
import { useCentralizedWorkspace } from '@/renderer/hooks/useCentralizedWorkspace';
import { showMessage } from '@/renderer/utils/ui/messageUtil';

interface UseHeaderRulesReturn {
  rules: HeaderRule[];
  addRule: (ruleData: Partial<HeaderRule>) => Promise<HeaderRule | null>;
  updateRule: (ruleId: string, updates: Partial<HeaderRule>) => Promise<boolean>;
  removeRule: (ruleId: string) => Promise<boolean>;
  toggleRule: (ruleId: string, enabled: boolean) => Promise<boolean>;
}

/**
 * Hook for header rules management
 */
export function useHeaderRules(): UseHeaderRulesReturn {
  const { rules, service } = useCentralizedWorkspace();
  const headerRules = rules.header || [];

  const addRule = useCallback(
    async (ruleData: Partial<HeaderRule>): Promise<HeaderRule | null> => {
      try {
        const rule = await service.addHeaderRule(ruleData);
        return rule;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return null;
      }
    },
    [service],
  );

  const updateRule = useCallback(
    async (ruleId: string, updates: Partial<HeaderRule>): Promise<boolean> => {
      try {
        await service.updateHeaderRule(ruleId, updates);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const removeRule = useCallback(
    async (ruleId: string): Promise<boolean> => {
      try {
        await service.removeHeaderRule(ruleId);
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  const toggleRule = useCallback(
    async (ruleId: string, enabled: boolean): Promise<boolean> => {
      try {
        await service.updateHeaderRule(ruleId, { isEnabled: enabled });
        return true;
      } catch (error: unknown) {
        showMessage('error', error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [service],
  );

  return {
    rules: headerRules,
    addRule,
    updateRule,
    removeRule,
    toggleRule,
  };
}
