/**
 * Suggestion/measure state machine for {@link TemplateInput} — popover
 * open/query/measure state, the filtered+recents-ordered option list,
 * caret-driven re-measure, insert/create actions, and the editable's
 * input/keyboard/paste/hover handlers. The shell keeps `classify`,
 * focus state, and the render; it consumes the machine only through
 * the returned state + handlers.
 */

import { filterSuggestions, type SuggestionContext, type VariableSuggestion } from '@openheaders/core/variables';
import { useVariableSuggestions } from '@openheaders/ui/shared/hooks/useVariableSuggestions';
import { useWorkspaces } from '@openheaders/ui/shared/hooks/useWorkspaces';
import type React from 'react';
import { type ClipboardEvent, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCaretOffset, setCaretOffset } from './caret';
import { type CreateTarget, detectCreateTarget } from './create-target';
import { type RefState, renderHighlightedHtml } from './highlight';
import { detectMeasure, findExistingCloseEnd, PREFIX, SPLIT } from './measure';
import { computePopoverCoords, type PopoverCoords } from './popover-coords';
import { addRecent, listRecents, pruneRecents, type VariableRecents } from './recents';
import { useVariablePopover } from './VariablePopoverHost';

const MAX_POPOVER_ROWS = 60;

interface TemplateSuggestionsInputs {
  editableRef: React.RefObject<HTMLDivElement | null>;
  value?: string;
  onChange?: (next: string) => void;
  onPressEnter?: () => void;
  multiline: boolean;
  effectiveContext: SuggestionContext;
  effectiveDisable: boolean;
  classify: (inner: string) => RefState;
}

export function useTemplateSuggestions({
  editableRef,
  value,
  onChange,
  onPressEnter,
  multiline,
  effectiveContext,
  effectiveDisable,
  classify,
}: TemplateSuggestionsInputs) {
  const { suggestions: allSuggestions } = useVariableSuggestions(effectiveContext);
  const { activeWorkspaceId } = useWorkspaces();

  // One-shot: set when a keyboard action opens the create popover, so
  // the Enter/Tab key's own keyup doesn't immediately re-open the
  // suggestion list (a mouse click has no such keyup, hence it works).
  const suppressReopenRef = useRef(false);
  // One-shot: set when `triggerCreate` opens the shared create popover.
  // `triggerCreate` sets `isOpen` false to dismiss the suggestion list,
  // which would otherwise fire the `[value, isOpen]` effect below and
  // `closeNow()` the popover we just opened (a mouse keeps it alive by
  // hovering; the keyboard path has nothing, so it'd vanish).
  const openingCreateRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [measureStart, setMeasureStart] = useState<number | null>(null);
  // True once the caret follows `{{` — a lone `{` keeps this false so
  // we can hide an empty list (probably a literal brace) while still
  // showing it the moment a match exists.
  const [measureDouble, setMeasureDouble] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<VariableRecents | null>(null);
  // Suggestion popover coords. Portal-rendered to `document.body` so the
  // popover floats above whatever container the editable lives in
  // (clipped panels, hover popovers, modals). Recomputed on open + on
  // scroll/resize from the editable's bounding rect.
  const [popoverCoords, setPopoverCoords] = useState<PopoverCoords | null>(null);
  // Shared hover-popover host — single instance per app root, owns
  // open-state + close-grace timer. We just emit hover events.
  const popoverHost = useVariablePopover();

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
      const recent: VariableSuggestion[] = [];
      const rest: VariableSuggestion[] = [];
      for (const s of ranked) {
        if (recencyIndex.has(s.reference)) recent.push(s);
        else rest.push(s);
      }
      recent.sort((a, b) => (recencyIndex.get(a.reference) ?? 0) - (recencyIndex.get(b.reference) ?? 0));
      return [...recent, ...rest].slice(0, MAX_POPOVER_ROWS);
    }
    return ranked.slice(0, MAX_POPOVER_ROWS);
  }, [isOpen, allSuggestions, query, recents]);

  // Clamp activeIndex when the suggestion list shrinks.
  useEffect(() => {
    if (suggestions.length === 0) return;
    setActiveIndex((prev) => (prev >= suggestions.length ? 0 : prev));
  }, [suggestions.length]);

  // Re-rendering innerHTML on every keystroke replaces span nodes —
  // a tracked anchor would point to a detached element. Tell the host
  // to close immediately whenever the value changes or the suggestion
  // dropdown takes over; the user can re-hover to reopen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on `value` / `isOpen`.
  useEffect(() => {
    // `triggerCreate` flips `isOpen` false to dismiss the suggestion
    // list while opening the create popover — don't close that popover.
    if (openingCreateRef.current) {
      openingCreateRef.current = false;
      return;
    }
    popoverHost.closeNow();
  }, [value, isOpen]);

  // Suggestion popover positioning — keep it pinned to the editable as the
  // user types / the page scrolls. Portal-mounted so it ignores the
  // editable's ancestor clipping (a clipped overflow on a hover popover /
  // Modal / panel container would otherwise crop the dropdown). Opens below
  // by default; flips above when the field sits low enough that the dropdown
  // can't fit below and there's more room above — so a field near a panel's
  // footer doesn't open the list straight into it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `update` reads `suggestions.length` only to size the fit threshold; keeping it out of deps means a filter change doesn't re-fire this (the open-time full-list size is the right, stable threshold). `update` itself re-reads the rect — and re-picks the side — live on scroll/resize.
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      const rect = editableRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPopoverCoords(computePopoverCoords(rect, suggestions.length, window.innerHeight));
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  const updateMeasure = useCallback(
    (text: string, caret: number) => {
      if (effectiveDisable) {
        setIsOpen(false);
        return;
      }
      const measure = detectMeasure(text, caret);
      if (!measure) {
        setIsOpen(false);
        return;
      }
      setMeasureStart((prev) => {
        if (prev !== measure.start) setActiveIndex(0);
        return measure.start;
      });
      setQuery(measure.query);
      setMeasureDouble(measure.double);
      setIsOpen(true);
    },
    [effectiveDisable],
  );

  const handleInput = useCallback(() => {
    const root = editableRef.current;
    if (!root) return;
    const caretPos = getCaretOffset(root);
    const text = root.textContent ?? '';
    // Strip `\n` injected by contentEditable when multiline is false.
    const sanitized = multiline ? text : text.replace(/\n/g, '');
    if (sanitized !== text) {
      const adj = Math.min(caretPos, sanitized.length);
      root.innerHTML = renderHighlightedHtml(sanitized, adj, classify);
      setCaretOffset(root, adj);
      onChange?.(sanitized);
      updateMeasure(sanitized, adj);
      return;
    }
    // Re-render highlights with caret-aware neutralising so the
    // active ref doesn't flicker mid-edit.
    const html = renderHighlightedHtml(text, caretPos, classify);
    if (root.innerHTML !== html) {
      root.innerHTML = html;
      setCaretOffset(root, caretPos);
    }
    onChange?.(text);
    updateMeasure(text, caretPos);
  }, [editableRef, multiline, onChange, classify, updateMeasure]);

  const handleKeyUpOrMouseUp = useCallback(() => {
    if (suppressReopenRef.current) {
      suppressReopenRef.current = false;
      return;
    }
    const root = editableRef.current;
    if (!root || document.activeElement !== root) return;
    const caretPos = getCaretOffset(root);
    const text = root.textContent ?? '';
    // Re-render with caret-aware state (caret may have moved out of
    // a ref — swap editing class → resolved/unresolved).
    const html = renderHighlightedHtml(text, caretPos, classify);
    if (root.innerHTML !== html) {
      root.innerHTML = html;
      setCaretOffset(root, caretPos);
    }
    updateMeasure(text, caretPos);
  }, [editableRef, classify, updateMeasure]);

  const insertReference = useCallback(
    (suggestion: VariableSuggestion) => {
      if (suggestion.disabled || measureStart === null) return;
      const root = editableRef.current;
      if (!root) return;
      const caret = getCaretOffset(root);
      const text = root.textContent ?? '';
      const before = text.slice(0, measureStart);
      // If the caret sits inside an already-complete ref (the open
      // `{{` is `measureStart` and a matching `}}` follows before any
      // new `{{`), consume that existing `}}` so we replace the ref
      // end-to-end instead of prepending and leaving stray braces.
      const consumeEnd = findExistingCloseEnd(text, caret);
      const after = text.slice(consumeEnd);
      const insert = `${PREFIX}${suggestion.reference}${SPLIT}`;
      const next = `${before}${insert}${after}`;
      // A namespace scaffold (`{{scope.}}`) lands the caret INSIDE,
      // right after the dot, and reopens the popover scoped to that
      // namespace so the user keeps typing the variable name. A real
      // reference lands the caret after `}}` and records a recent.
      const isScaffold = suggestion.preview.kind === 'namespace';
      const newCaret = isScaffold
        ? measureStart + PREFIX.length + suggestion.reference.length
        : measureStart + insert.length;
      root.innerHTML = renderHighlightedHtml(next, newCaret, classify);
      setCaretOffset(root, newCaret);
      onChange?.(next);
      if (isScaffold) {
        updateMeasure(next, newCaret);
        return;
      }
      setIsOpen(false);
      void addRecent(activeWorkspaceId, suggestion.reference)
        .then(() => listRecents(activeWorkspaceId))
        .then((updated) => setRecents(updated));
    },
    [editableRef, activeWorkspaceId, measureStart, onChange, classify, updateMeasure],
  );

  // When the caret sits in a scoped reference whose variable doesn't
  // exist yet (`{{vault.okay}}` with no `vault.okay` defined), offer
  // to create it in that scope instead of a dead-end "No matches".
  const createTarget = useMemo<CreateTarget | null>(() => {
    if (!measureDouble || suggestions.length > 0) return null;
    return detectCreateTarget(query, effectiveContext.collectionId);
  }, [measureDouble, suggestions.length, query, effectiveContext.collectionId]);

  // Called when the create popover closes (Escape / save / outside-click).
  // Drop the user back into the field exactly where they left off — focus,
  // restore the caret by offset (survives the save re-render), and
  // re-measure so the suggestion list reopens, now showing the just-created
  // match. Skip when focus has moved to an outside target (dismissed by
  // clicking elsewhere) so we don't yank it back. Runs after the popover's
  // close animation, outside any React commit, so the re-measure's state
  // updates apply cleanly.
  const restoreAfterCreate = useCallback(
    (caretOffset: number) => {
      const root = editableRef.current;
      if (!root) return;
      const active = document.activeElement;
      const focusMovedOutside =
        !!active && active !== document.body && active !== root && !active.closest('[data-variable-popover-root]');
      if (focusMovedOutside) return;
      root.focus();
      if (caretOffset >= 0) setCaretOffset(root, caretOffset);
      updateMeasure(root.textContent ?? '', caretOffset >= 0 ? caretOffset : getCaretOffset(root));
    },
    [editableRef, updateMeasure],
  );

  // Hand the reference to the shared create popover (the "Add to"
  // flow), anchored to its `{{ref}}` token when rendered. The popover
  // defaults "Add to" to the reference's own scope.
  const triggerCreate = useCallback(() => {
    const target = createTarget;
    if (!target) return;
    const root = editableRef.current;
    if (!root) return;
    let anchor: HTMLElement = root;
    for (const span of root.querySelectorAll<HTMLElement>('.oh-template-ref')) {
      if (span.getAttribute('data-ref') === target.reference) {
        anchor = span;
        break;
      }
    }
    // Remember the caret so we can drop the user back exactly where they
    // left off (inside the `{{ref}}` token) when the popover closes.
    const caretOffset = getCaretOffset(root);
    // Guard the `[value, isOpen]` effect from closing this open.
    openingCreateRef.current = true;
    setIsOpen(false);
    // Pinned: a deliberate create action, not a hover — stay open
    // until the user Escapes / clicks out / saves. Without this the
    // popover hover-dismisses immediately (no pointer sustains it).
    popoverHost.open(
      { anchorEl: anchor, reference: target.reference, collectionId: effectiveContext.collectionId, autoFocus: true },
      { pinned: true, onClose: () => restoreAfterCreate(caretOffset) },
    );
  }, [editableRef, createTarget, popoverHost, effectiveContext.collectionId, restoreAfterCreate]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (isOpen && suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex((prev) => (prev + 1) % suggestions.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          const suggestion = suggestions[activeIndex];
          if (suggestion && !suggestion.disabled) {
            e.preventDefault();
            e.stopPropagation();
            insertReference(suggestion);
            return;
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          // Suppress this Escape's keyup re-measure, which would otherwise
          // reopen the list it just closed (the caret is still in the ref).
          // Focus + caret stay put; typing or moving re-measures and reopens.
          suppressReopenRef.current = true;
          setIsOpen(false);
          return;
        }
      }
      // Empty list but the reference is creatable: Enter/Tab opens the
      // create flow; Escape dismisses.
      if (isOpen && suggestions.length === 0 && createTarget) {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          suppressReopenRef.current = true;
          triggerCreate();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          // Suppress this Escape's keyup re-measure, which would otherwise
          // reopen the list it just closed (the caret is still in the ref).
          // Focus + caret stay put; typing or moving re-measures and reopens.
          suppressReopenRef.current = true;
          setIsOpen(false);
          return;
        }
      }
      // Enter handling outside the popover: single-line swallows,
      // multiline leaves the browser to insert a `<br>`.
      if (e.key === 'Enter') {
        if (!multiline && !e.shiftKey) {
          e.preventDefault();
          onPressEnter?.();
        }
      }
    },
    [isOpen, suggestions, activeIndex, insertReference, multiline, onPressEnter, createTarget, triggerCreate],
  );

  // Hover-over-{{ref}} → ask the shared popover host to open. Delegated
  // from the editable; the caret-in-editing case keeps the span's class
  // as `editing` and we skip emitting hover for that one (mid-compose
  // would steal focus from the textarea).
  const handleEditableMouseOver = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const span = target.closest<HTMLElement>('.oh-template-ref');
      if (!span) return;
      if (span.classList.contains('oh-template-ref-editing')) return;
      const ref = span.getAttribute('data-ref') ?? '';
      if (!ref) return;
      popoverHost.open({ anchorEl: span, reference: ref, collectionId: effectiveContext.collectionId });
    },
    [popoverHost, effectiveContext.collectionId],
  );

  const handleEditableMouseOut = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const span = target.closest<HTMLElement>('.oh-template-ref');
      if (!span) return;
      const related = e.relatedTarget as Node | null;
      if (related && span.contains(related)) return;
      popoverHost.scheduleClose(e.relatedTarget);
    },
    [popoverHost],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const raw = e.clipboardData.getData('text/plain');
      const text = multiline ? raw : raw.replace(/\r?\n/g, ' ');
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      sel.deleteFromDocument();
      const node = document.createTextNode(text);
      sel.getRangeAt(0).insertNode(node);
      const range = document.createRange();
      range.setStartAfter(node);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      handleInput();
    },
    [multiline, handleInput],
  );

  const closeSuggestions = useCallback(() => setIsOpen(false), []);

  return {
    isOpen,
    suggestions,
    activeIndex,
    setActiveIndex,
    measureDouble,
    popoverCoords,
    createTarget,
    insertReference,
    triggerCreate,
    closeSuggestions,
    handleInput,
    handleKeyDown,
    handleKeyUpOrMouseUp,
    handlePaste,
    handleEditableMouseOver,
    handleEditableMouseOut,
  };
}
