/**
 * useSuggestionList — the headless half of the variable picker: the
 * ranked option list for an open `{{query`, the active row, the
 * per-workspace recents pinned on an empty query, the create offer
 * when nothing matches, and the Escape claim while the list is up.
 * Every host that renders a `SuggestionPopover` drives it — the
 * contentEditable line input and the Monaco body editors — so one
 * list means one order, one cap and one recents store across the
 * surfaces. The host owns the measure (where the braces are, what
 * follows them) and the insert; this hook never touches a DOM.
 */

import { filterSuggestions, type SuggestionContext, type VariableSuggestion } from '@openheaders/core/variables';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useWorkspaces } from '@openheaders/ui/shared/hooks/readers/useWorkspaces';
import { useVariableSuggestions } from '@openheaders/ui/shared/hooks/variables/useVariableSuggestions';
import { claimEscape } from '@openheaders/ui/shared/popover';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type CreateTarget, detectCreateTarget } from './create-target';
import { addRecent, listRecents, pruneRecents, type VariableRecents } from './recents';

const MAX_POPOVER_ROWS = 60;

export interface SuggestionListInputs {
  context: SuggestionContext;
  /** The host found an open brace run before the caret. */
  isOpen: boolean;
  /** The text between the opening braces and the caret. */
  query: string;
  /** True once the caret follows `{{` — a lone `{` never offers a
   *  create, since it may still be a literal brace. */
  measureDouble: boolean;
}

export interface SuggestionListApi {
  suggestions: VariableSuggestion[];
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  createTarget: CreateTarget | null;
  /** Record an inserted reference as the workspace's most recent. */
  recordRecent: (reference: string) => void;
}

export function useSuggestionList({ context, isOpen, query, measureDouble }: SuggestionListInputs): SuggestionListApi {
  const { suggestions: allSuggestions } = useVariableSuggestions(context);
  const { activeWorkspaceId } = useWorkspaces();
  const t = useT();
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<VariableRecents | null>(null);

  // While the list is open it owns Escape: the claim makes every
  // `useDismiss` surface beneath (the quick-editor popover, a variable
  // popover) stand down, so Esc closes the LIST first and the popover
  // only on the next press. The list's own Escape handling stays in the
  // host's keydown.
  useEffect(() => {
    if (!isOpen) return;
    const claim = claimEscape();
    return () => claim.release();
  }, [isOpen]);

  // Hydrate recents on workspace switch; prune against current suggestions.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const refs = new Set(allSuggestions.map((s) => s.reference));
      const next = await (refs.size > 0 ? pruneRecents(activeWorkspaceId, refs) : listRecents(activeWorkspaceId));
      if (!cancelled) setRecents(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, allSuggestions]);

  // Compute filtered+ordered options. Empty query → recents pinned.
  const suggestions = useMemo<VariableSuggestion[]>(() => {
    if (!isOpen) return [];
    const ranked = filterSuggestions(allSuggestions, query);
    if (query === '' && recents && recents.entries.length > 0) {
      const recencyIndex = new Map<string, number>();
      for (let i = 0; i < recents.entries.length; i++) {
        recencyIndex.set(recents.entries[i].reference, i);
      }
      const pinned: VariableSuggestion[] = [];
      const recent: VariableSuggestion[] = [];
      const rest: VariableSuggestion[] = [];
      for (const s of ranked) {
        // Pinned rows (the `dynamic.` scaffold) stay on top — recents
        // must not push the sticky entry point off the first row.
        if (s.pinned) pinned.push(s);
        else if (recencyIndex.has(s.reference)) recent.push(s);
        else rest.push(s);
      }
      recent.sort((a, b) => (recencyIndex.get(a.reference) ?? 0) - (recencyIndex.get(b.reference) ?? 0));
      return [...pinned, ...recent, ...rest].slice(0, MAX_POPOVER_ROWS);
    }
    return ranked.slice(0, MAX_POPOVER_ROWS);
  }, [isOpen, allSuggestions, query, recents]);

  // Clamp activeIndex when the suggestion list shrinks.
  useEffect(() => {
    if (suggestions.length === 0) return;
    setActiveIndex((prev) => (prev >= suggestions.length ? 0 : prev));
  }, [suggestions.length]);

  // When the caret sits in a scoped reference whose variable doesn't
  // exist yet (`{{vault.okay}}` with no `vault.okay` defined), offer
  // to create it in that scope instead of a dead-end "No matches".
  const createTarget = useMemo<CreateTarget | null>(() => {
    if (!measureDouble || suggestions.length > 0) return null;
    return detectCreateTarget(query, context.collectionId, t);
  }, [measureDouble, suggestions.length, query, context.collectionId, t]);

  const recordRecent = useCallback(
    (reference: string) => {
      void addRecent(activeWorkspaceId, reference)
        .then(() => listRecents(activeWorkspaceId))
        .then((updated) => setRecents(updated));
    },
    [activeWorkspaceId],
  );

  return { suggestions, activeIndex, setActiveIndex, createTarget, recordRecent };
}
