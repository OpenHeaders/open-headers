/**
 * useMonacoRefDecorations — paints every `{{ref}}` in view with the
 * line input's dress (resolved, unresolved, editing) as inline
 * decorations. Only the visible ranges are walked, re-derived on
 * edit, scroll, layout and caret moves, so a megabyte body never
 * carries a decoration per line; the classifier is the shared one,
 * so a variable created or removed elsewhere repaints the buffer.
 */

import type { SuggestionContext } from '@openheaders/core/variables';
import type * as monaco from 'monaco-editor';
import { useEffect } from 'react';
import { useAutoSuggestionContext } from '../SuggestionContextProvider';
import { useRefClassifier } from '../use-ref-classifier';
import { collectRefDecorations, refDecorationClass, type VisibleLine } from './monaco-ref-decorations';

export interface MonacoRefDecorationsOptions {
  enabled: boolean;
  /** Scope override; the nearest `SuggestionContextProvider` otherwise. */
  context?: SuggestionContext;
}

export function useMonacoRefDecorations(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  { enabled, context: contextOverride }: MonacoRefDecorationsOptions,
): void {
  const autoContext = useAutoSuggestionContext();
  const context = contextOverride ?? autoContext;
  const classify = useRefClassifier(context.collectionId);

  useEffect(() => {
    if (!editor || !enabled) return;
    const collection = editor.createDecorationsCollection();
    const paint = () => {
      const model = editor.getModel();
      if (!model) {
        collection.clear();
        return;
      }
      const lines: VisibleLine[] = [];
      for (const range of editor.getVisibleRanges()) {
        for (let lineNumber = range.startLineNumber; lineNumber <= range.endLineNumber; lineNumber++) {
          lines.push({ lineNumber, text: model.getLineContent(lineNumber) });
        }
      }
      collection.set(
        collectRefDecorations(lines, editor.getPosition(), classify).map((d) => ({
          range: d.range,
          options: { inlineClassName: refDecorationClass(d.state) },
        })),
      );
    };
    paint();
    const subscriptions = [
      editor.onDidChangeModelContent(paint),
      editor.onDidScrollChange(paint),
      editor.onDidLayoutChange(paint),
      editor.onDidChangeCursorPosition(paint),
    ];
    return () => {
      for (const subscription of subscriptions) subscription.dispose();
      collection.clear();
    };
  }, [editor, enabled, classify]);
}
