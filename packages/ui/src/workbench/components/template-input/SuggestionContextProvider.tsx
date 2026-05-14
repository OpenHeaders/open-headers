/**
 * SuggestionContextProvider — supplies default {@link SuggestionContext}
 * fields (collectionId + workflowStep) to every {@link TemplateInput}
 * inside an editor surface.
 *
 * Pattern: mount one provider at the top of each editor surface (rule
 * editor, request editor, workflow step editor). Individual inputs can
 * still override via their explicit `suggestionContext` prop when they
 * need per-field gating (e.g. a password field that shouldn't suggest
 * anything).
 *
 * Default context = no collection, no workflow step, every scope
 * allowed. The consumer {@link useAutoSuggestionContext} merges the
 * provider's defaults with optional caller-side overrides so mount
 * sites only specify the fields they need to change.
 */

import type { SuggestionContext } from '@openheaders/core/variables';
import type React from 'react';
import { createContext, useContext, useMemo } from 'react';

export interface AutoSuggestionContextValue {
  /** Current collection for mount sites that resolve `{{collection.X}}`. */
  collectionId?: string;
  /** Active workflow step — present only when an editor is mounted
   *  INSIDE a workflow step editor. */
  workflowStep?: SuggestionContext['workflowStep'];
  /** Global per-scope gate. Individual inputs can override. */
  allowed?: SuggestionContext['allowed'];
  /** Mask every preview regardless of scope default. */
  maskAll?: boolean;
}

const SuggestionContextCtx = createContext<AutoSuggestionContextValue>({});

export interface SuggestionContextProviderProps {
  value: AutoSuggestionContextValue;
  children: React.ReactNode;
}

/**
 * Provider — wrap an editor surface with this and the child
 * TemplateInput instances pick up `collectionId` / `workflowStep`
 * automatically via {@link useAutoSuggestionContext}.
 */
export const SuggestionContextProvider: React.FC<SuggestionContextProviderProps> = ({ value, children }) => {
  // Memoize the provider value so consumers only re-render when the
  // logical context changes (not on every parent re-render).
  const memo = useMemo(
    () => ({
      collectionId: value.collectionId,
      workflowStep: value.workflowStep,
      allowed: value.allowed,
      maskAll: value.maskAll,
    }),
    [value.collectionId, value.workflowStep, value.allowed, value.maskAll],
  );
  return <SuggestionContextCtx.Provider value={memo}>{children}</SuggestionContextCtx.Provider>;
};

/**
 * Hook — returns a fully-formed {@link SuggestionContext} for the
 * current editor surface. `overrides` is shallow-merged on top of the
 * provider's value so mount sites only specify what differs.
 */
export function useAutoSuggestionContext(overrides?: Partial<SuggestionContext>): SuggestionContext {
  const base = useContext(SuggestionContextCtx);
  return useMemo<SuggestionContext>(() => {
    const merged: SuggestionContext = {};
    if (overrides?.collectionId !== undefined) merged.collectionId = overrides.collectionId;
    else if (base.collectionId !== undefined) merged.collectionId = base.collectionId;

    if (overrides?.workflowStep !== undefined) merged.workflowStep = overrides.workflowStep;
    else if (base.workflowStep !== undefined) merged.workflowStep = base.workflowStep;

    if (overrides?.allowed !== undefined || base.allowed !== undefined) {
      merged.allowed = { ...base.allowed, ...overrides?.allowed };
    }

    if (overrides?.maskAll !== undefined) merged.maskAll = overrides.maskAll;
    else if (base.maskAll !== undefined) merged.maskAll = base.maskAll;

    return merged;
  }, [base, overrides?.collectionId, overrides?.workflowStep, overrides?.allowed, overrides?.maskAll]);
}
