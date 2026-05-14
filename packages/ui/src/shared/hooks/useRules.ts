import type { RuleContextValue } from '@openheaders/ui/context';
import { RuleContext } from '@openheaders/ui/context';
import { useContext } from 'react';

/**
 * Custom hook to access the rule context
 */
export const useRules = (): RuleContextValue => {
  const context = useContext(RuleContext);

  if (context === undefined) {
    throw new Error('useRules must be used within a RuleProvider');
  }

  return context;
};
