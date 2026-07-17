/**
 * Rule-editor-document open intent — the seam between the response
 * quick-editors and the editor tab group, carrying a full-rule document
 * open (the rule-value seam's whole-rule sibling). Same registry +
 * stable-trampoline construction as `value-document-intent.tsx` — see
 * there for the loop-proofing rationale (React #185): the popovers
 * render from the popover host's tree position, so the tab-group owner
 * registers the real opener here and callers gate their affordance on
 * one being registered (the workbench never mounts the provider — no
 * affordance there by construction).
 */

import type { ResponseRuleDraft, RuleCondition } from '@openheaders/core/types';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { RuleEditorHandOff } from './inspector-tab';

export type RuleEditorDocumentTarget =
  | {
      mode: 'edit';
      ruleUid: string;
      ruleName: string;
      /** Popover's unsaved form state, pre-applied as the document's
       *  draft (body already wire-encoded) — absent when pristine. */
      handOff?: RuleEditorHandOff;
    }
  | {
      mode: 'create';
      name: string;
      /** Captured draft with the popover's edits merged in (wire body). */
      draft: ResponseRuleDraft;
      /** Popover's edited conditions — absent when the row was untouched. */
      conditions?: RuleCondition[];
    };

type OpenRuleEditorDocument = (target: RuleEditorDocumentTarget) => void;

interface RuleEditorDocumentIntentRegistry {
  opener: OpenRuleEditorDocument | null;
  setOpener: (open: OpenRuleEditorDocument | null) => void;
}

const RuleEditorDocumentIntentContext = createContext<RuleEditorDocumentIntentRegistry | null>(null);

export function RuleEditorDocumentIntentProvider({ children }: { children: React.ReactNode }) {
  const [opener, setOpenerState] = useState<OpenRuleEditorDocument | null>(null);
  // Function-valued state: the setter wraps in a thunk so React never
  // mistakes the opener for a state updater. Stable identity — the
  // register effect keys on it, not on the changing registry object.
  const setOpener = useCallback((open: OpenRuleEditorDocument | null) => setOpenerState(() => open), []);
  const value = useMemo<RuleEditorDocumentIntentRegistry>(() => ({ opener, setOpener }), [opener, setOpener]);
  return (
    <RuleEditorDocumentIntentContext.Provider value={value}>{children}</RuleEditorDocumentIntentContext.Provider>
  );
}

/**
 * Register the real opener (the tab-group owner). Cleared on unmount.
 * Registers a stable trampoline that reads the latest `open` from a
 * ref, so the provider's state is written once per mount — never per
 * `open` identity (the loop `value-document-intent.tsx` documents).
 */
export function useRegisterRuleEditorDocumentOpener(open: OpenRuleEditorDocument): void {
  const setOpener = useContext(RuleEditorDocumentIntentContext)?.setOpener;
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (setOpener === undefined) return;
    setOpener((target) => openRef.current(target));
    return () => setOpener(null);
  }, [setOpener]);
}

/** The dispatch, or null when no opener is registered (or the provider
 *  isn't mounted — e.g. the workbench) — gate the affordance on it. */
export function useOpenRuleEditorDocument(): OpenRuleEditorDocument | null {
  return useContext(RuleEditorDocumentIntentContext)?.opener ?? null;
}
