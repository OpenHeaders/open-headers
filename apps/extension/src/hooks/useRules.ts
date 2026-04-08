import type { RuleContextValue } from '@context/RuleContext';
import { RuleContext } from '@context/RuleContext';
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
