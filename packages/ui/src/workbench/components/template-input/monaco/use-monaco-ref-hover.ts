/**
 * useMonacoRefHover — a `{{ref}}` under the pointer opens the shared
 * variable popover (the readout, edit and create surface the line
 * input's spans open), anchored on the span the decoration plane
 * painted. Mirrors the line input: the ref under the caret (editing)
 * never opens one; leaving the span schedules the host's grace close;
 * leaving the editor hands the host the element the pointer entered,
 * so a move into the popover keeps it; an edit closes it at once —
 * Monaco re-renders the line's spans, which would leave the popover
 * anchored on a detached element.
 */

import type { SuggestionContext } from '@openheaders/core/variables';
import type * as monaco from 'monaco-editor';
import { useEffect } from 'react';
import { useAutoSuggestionContext } from '../SuggestionContextProvider';
import { useVariablePopover } from '../VariablePopoverHost';
import { findRefAt, MONACO_REF_CLASS, MONACO_REF_EDITING_CLASS } from './monaco-ref-decorations';

export interface MonacoRefHoverOptions {
  enabled: boolean;
  /** Scope override; the nearest `SuggestionContextProvider` otherwise. */
  context?: SuggestionContext;
}

export function useMonacoRefHover(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  { enabled, context: contextOverride }: MonacoRefHoverOptions,
): void {
  const autoContext = useAutoSuggestionContext();
  const context = contextOverride ?? autoContext;
  const collectionId = context.collectionId;
  const popoverHost = useVariablePopover();

  useEffect(() => {
    if (!editor || !enabled) return;
    // The ref the popover is open for, as `line:start` — a move within
    // the same ref never reopens, a move onto another one does.
    let hovered: string | null = null;
    const leave = (relatedTarget?: EventTarget | null) => {
      if (hovered === null) return;
      hovered = null;
      popoverHost.scheduleClose(relatedTarget);
    };
    const subscriptions = [
      editor.onMouseMove((e) => {
        const span = e.target.element?.closest<HTMLElement>(`.${MONACO_REF_CLASS}`) ?? null;
        const position = e.target.position;
        const model = editor.getModel();
        if (!span || !position || !model || span.classList.contains(MONACO_REF_EDITING_CLASS)) {
          leave();
          return;
        }
        const ref = findRefAt(model.getLineContent(position.lineNumber), position.column);
        if (!ref) {
          leave();
          return;
        }
        const key = `${position.lineNumber}:${ref.startColumn}`;
        if (key === hovered) return;
        hovered = key;
        popoverHost.open({ anchorEl: span, reference: ref.inner, collectionId });
      }),
      editor.onMouseLeave((e) => leave(e.event.browserEvent.relatedTarget)),
      editor.onDidChangeModelContent(() => {
        if (hovered === null) return;
        hovered = null;
        popoverHost.closeNow();
      }),
    ];
    return () => {
      for (const subscription of subscriptions) subscription.dispose();
    };
  }, [editor, enabled, popoverHost, collectionId]);
}
