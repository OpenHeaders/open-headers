/**
 * useMonacoVariableSuggest — the Monaco host of the variable picker.
 * It reads the editor's caret and buffer for the `{{query` run, owns
 * the open state, the anchor (the opening brace's viewport rect) and
 * the keys while the list is up, and writes a pick back as one edit.
 * It renders nothing: `MonacoSuggestOverlay` paints the list from
 * what it returns, and the list itself is the shared
 * `useSuggestionList` the line input drives.
 *
 * Keys ride the editor's own keydown: it fires from the text input
 * inside the container, and a stopped event never reaches the
 * keybinding service listening on the container, so Enter, Tab and
 * the arrows are ours while the list is open and Monaco's the rest of
 * the time. The standalone `addCommand` is not used — it hands a
 * global rule to the keybinding service and drops the disposable, so
 * every mount would leave a rule behind and the next editor's keys
 * would route to a dead one.
 */

import type { SuggestionContext, VariableSuggestion } from '@openheaders/core/variables';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSettingValue } from '../../../settings/hooks';
import type { CreateTarget } from '../create-target';
import { useAutoSuggestionContext } from '../SuggestionContextProvider';
import { useSuggestionList } from '../use-suggestion-list';
import { useVariablePopover } from '../VariablePopoverHost';
import { MONACO_REF_EDITING_CLASS } from './monaco-ref-decorations';
import { type MonacoRefGrammar, type OpenRun, TEMPLATE_REF_GRAMMAR } from './ref-grammar';

const EDIT_SOURCE = 'oh.variableSuggest';

interface Measure extends OpenRun {
  lineNumber: number;
}

/** Viewport rect of the opening `{{` — the popover hangs below it. */
export interface SuggestAnchor {
  left: number;
  top: number;
  height: number;
}

export interface MonacoVariableSuggestOptions {
  /** The host's own gate (`variableAutoComplete`); the autocomplete
   *  setting gates on top of it. */
  enabled: boolean;
  /** Scope override; the nearest `SuggestionContextProvider` otherwise. */
  context?: SuggestionContext;
  /** The run the list opens on and the edit a pick writes; the body
   *  editors' `{{ref}}` otherwise. */
  grammar?: MonacoRefGrammar;
}

export interface MonacoVariableSuggestApi {
  /** Null while the list is closed. */
  anchor: SuggestAnchor | null;
  suggestions: VariableSuggestion[];
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  select: (suggestion: VariableSuggestion) => void;
  /** The reference the empty list offers to create, if any. */
  createTarget: CreateTarget | null;
  /** Hand that reference to the shared create popover. */
  triggerCreate: () => void;
}

function sameRun(a: Measure | null, b: Measure): boolean {
  return a !== null && a.lineNumber === b.lineNumber && a.startColumn === b.startColumn;
}

function sameMeasure(a: Measure | null, b: Measure): boolean {
  return sameRun(a, b) && a?.query === b.query;
}

export function useMonacoVariableSuggest(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  { enabled, context: contextOverride, grammar = TEMPLATE_REF_GRAMMAR }: MonacoVariableSuggestOptions,
): MonacoVariableSuggestApi {
  const autoContext = useAutoSuggestionContext();
  const context = contextOverride ?? autoContext;
  const settingEnabled = useSettingValue('rulesEngine.variableAutocomplete');
  const active = enabled && settingEnabled;

  const [measure, setMeasure] = useState<Measure | null>(null);
  // The editor's events fire in bursts (a keystroke changes the
  // content, then the cursor) — the ref keeps each handler reading the
  // measure the previous one committed, not the last render's.
  const measureRef = useRef<Measure | null>(null);
  const [anchor, setAnchor] = useState<SuggestAnchor | null>(null);
  // The run Escape closed: it stays closed until the query changes or
  // the caret leaves it, so the key does not reopen the list it closed.
  const dismissedRef = useRef<Measure | null>(null);
  const isOpen = measure !== null;

  // A run may narrow the scopes it names (a vault lookup offers vault
  // entries alone); the grammar hands those as a constant, so the
  // list's context changes identity only when the run kind does.
  const allowed = measure?.allowed;
  const runContext = useMemo(() => (allowed ? { ...context, allowed } : context), [context, allowed]);

  const { suggestions, activeIndex, setActiveIndex, createTarget, recordRecent } = useSuggestionList({
    context: runContext,
    isOpen,
    query: measure?.query ?? '',
    measureDouble: true,
  });
  // The shared create popover — one instance per app root. Read through
  // a ref where an effect needs it: its api identity follows its open
  // state, so an effect keyed on it would re-fire on every open and close.
  const popoverHost = useVariablePopover();
  const popoverHostRef = useRef(popoverHost);
  popoverHostRef.current = popoverHost;

  const commit = useCallback((next: Measure | null) => {
    measureRef.current = next;
    setMeasure(next);
  }, []);

  const remeasure = useCallback(() => {
    if (!editor || !active) return;
    const model = editor.getModel();
    const position = editor.getPosition();
    const selection = editor.getSelection();
    if (!model || !position || !editor.hasTextFocus() || (selection !== null && !selection.isEmpty())) {
      commit(null);
      return;
    }
    const line = grammar.openRun(model.getLineContent(position.lineNumber), position.column);
    if (!line) {
      dismissedRef.current = null;
      commit(null);
      return;
    }
    const next: Measure = { lineNumber: position.lineNumber, ...line };
    if (sameMeasure(dismissedRef.current, next)) {
      commit(null);
      return;
    }
    dismissedRef.current = null;
    const previous = measureRef.current;
    if (sameMeasure(previous, next)) return;
    // A new run starts the list at its first row; typing on within
    // the same run keeps the user's place.
    if (!sameRun(previous, next)) setActiveIndex(0);
    commit(next);
  }, [editor, active, commit, setActiveIndex, grammar]);

  const reanchor = useCallback(
    (current: Measure | null) => {
      if (!editor || !current) {
        setAnchor(null);
        return;
      }
      const visible = editor.getScrolledVisiblePosition({
        lineNumber: current.lineNumber,
        column: current.startColumn,
      });
      const node = editor.getDomNode();
      if (!visible || !node) {
        setAnchor(null);
        return;
      }
      const rect = node.getBoundingClientRect();
      setAnchor({ left: rect.left + visible.left, top: rect.top + visible.top, height: visible.height });
    },
    [editor],
  );

  useEffect(() => {
    reanchor(measure);
  }, [measure, reanchor]);

  useEffect(() => {
    if (!editor || !active) {
      commit(null);
      return;
    }
    const follow = () => reanchor(measureRef.current);
    const subscriptions = [
      editor.onDidChangeCursorPosition(remeasure),
      editor.onDidChangeModelContent(remeasure),
      editor.onDidBlurEditorWidget(() => commit(null)),
      editor.onDidScrollChange(follow),
      editor.onDidLayoutChange(follow),
    ];
    return () => {
      for (const subscription of subscriptions) subscription.dispose();
    };
  }, [editor, active, commit, remeasure, reanchor]);

  // The page may scroll or resize under an open list — keep the
  // popover on the brace, as the line input does.
  useEffect(() => {
    if (!measure) return;
    const follow = () => reanchor(measureRef.current);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [measure, reanchor]);

  // The list takes over from a hover readout the way the line input's
  // does: a click into a reference lands the caret inside it, the run
  // opens, and the popover under it closes at once — a hover open is
  // not click-out dismissed until the first click inside it, so the
  // click in the buffer would otherwise leave it standing.
  useEffect(() => {
    if (!isOpen) return;
    popoverHostRef.current.closeNow();
  }, [isOpen]);

  // Monaco's own completions pause while the run is composed: the
  // language's quick suggestions and trigger characters are off until
  // the list closes, then restored to what the host configured. A hide
  // alone is not enough — the request a keystroke started answers
  // after it, from a worker, and the widget would surface under ours.
  // A layout effect, so the flip lands before the quick-suggest timer
  // that keystroke armed can fire.
  useLayoutEffect(() => {
    if (!editor || !isOpen) return;
    const raw = editor.getRawOptions();
    const previous = {
      quickSuggestions: raw.quickSuggestions,
      suggestOnTriggerCharacters: raw.suggestOnTriggerCharacters,
    };
    editor.updateOptions({ quickSuggestions: false, suggestOnTriggerCharacters: false });
    editor.trigger(EDIT_SOURCE, 'hideSuggestWidget', null);
    return () => editor.updateOptions(previous);
  }, [editor, isOpen]);

  const select = useCallback(
    (suggestion: VariableSuggestion) => {
      const current = measureRef.current;
      if (!editor || !current || suggestion.disabled) return;
      const model = editor.getModel();
      const position = editor.getPosition();
      if (!model || !position || position.lineNumber !== current.lineNumber) return;
      const edit = grammar.insert(
        model.getLineContent(current.lineNumber),
        current.lineNumber,
        current.startColumn,
        position.column,
        suggestion,
      );
      editor.executeEdits(EDIT_SOURCE, [{ range: edit.range, text: edit.text }]);
      editor.setPosition({ lineNumber: current.lineNumber, column: edit.caretColumn });
      editor.focus();
      // A scaffold leaves the caret inside the run and the cursor
      // event reopens the list narrowed; a reference is a real pick.
      if (!edit.scaffold) recordRecent(suggestion.reference);
    },
    [editor, recordRecent, grammar],
  );

  // When the create popover closes, drop the user back where they
  // were: focus, the caret inside the run, the list re-measured so it
  // reopens on the just-created match. Skipped when focus moved to an
  // outside target (dismissed by clicking elsewhere).
  const restoreAfterCreate = useCallback(
    (caret: monaco.IPosition) => {
      if (!editor) return;
      const activeEl = document.activeElement;
      const focusMovedOutside =
        !!activeEl &&
        activeEl !== document.body &&
        !editor.getDomNode()?.contains(activeEl) &&
        !activeEl.closest('[data-variable-popover-root]');
      if (focusMovedOutside) return;
      editor.focus();
      editor.setPosition(caret);
      remeasure();
    },
    [editor, remeasure],
  );

  // Hand the reference to the shared create popover (the "Add to"
  // flow), anchored on the composing run's painted span — the
  // decoration plane marks it `editing` — like the line input anchors
  // on its `{{ref}}` span; the editor itself before that span paints.
  const triggerCreate = useCallback(() => {
    const target = createTarget;
    const current = measureRef.current;
    if (!editor || !target || !current) return;
    const node = editor.getDomNode();
    const caret = editor.getPosition();
    if (!node || !caret) return;
    const anchorEl = node.querySelector<HTMLElement>(`.${MONACO_REF_EDITING_CLASS}`) ?? node;
    commit(null);
    popoverHost.open(
      { anchorEl, reference: target.reference, collectionId: context.collectionId, autoFocus: true },
      { pinned: true, onClose: () => restoreAfterCreate(caret) },
    );
  }, [editor, createTarget, commit, popoverHost, context.collectionId, restoreAfterCreate]);

  // The key handler is bound once per editor; it reads the live list
  // and actions through refs so a re-render never re-subscribes.
  const keyStateRef = useRef({ suggestions, activeIndex, select, createTarget, triggerCreate });
  keyStateRef.current = { suggestions, activeIndex, select, createTarget, triggerCreate };

  useEffect(() => {
    if (!editor) return;
    const subscription = editor.onKeyDown((e) => {
      const current = measureRef.current;
      if (!current) return;
      const {
        suggestions: rows,
        activeIndex: index,
        select: pick,
        createTarget: creatable,
        triggerCreate: create,
      } = keyStateRef.current;
      const key = e.browserEvent.key;
      const consume = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (key === 'Escape') {
        consume();
        dismissedRef.current = current;
        commit(null);
        return;
      }
      if (rows.length === 0) {
        // An empty list with a creatable reference: Enter / Tab open
        // the create flow instead of a dead end.
        if ((key === 'Enter' || key === 'Tab') && creatable) {
          consume();
          create();
        }
        return;
      }
      if (key === 'ArrowDown') {
        consume();
        setActiveIndex((prev) => (prev + 1) % rows.length);
        return;
      }
      if (key === 'ArrowUp') {
        consume();
        setActiveIndex((prev) => (prev - 1 + rows.length) % rows.length);
        return;
      }
      if (key === 'Enter' || key === 'Tab') {
        const row = rows[index];
        if (!row || row.disabled) return;
        consume();
        pick(row);
      }
    });
    return () => subscription.dispose();
  }, [editor, commit, setActiveIndex]);

  return {
    anchor: measure ? anchor : null,
    suggestions,
    activeIndex,
    setActiveIndex,
    select,
    createTarget,
    triggerCreate,
  };
}
