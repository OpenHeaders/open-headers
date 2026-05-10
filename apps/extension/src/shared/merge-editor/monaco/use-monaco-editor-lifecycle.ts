/**
 * Lifecycle hook for a single `IStandaloneCodeEditor` instance.
 *
 * Mirrors `RichDiffEditor`'s discipline (create-once, swap-models on
 * content change, dispose in the right order) but for a non-diff
 * editor. Used by the three panes of `MergePane` independently.
 */

import type * as monaco from 'monaco-editor';
import { editor as monacoEditor } from 'monaco-editor/esm/vs/editor/edcore.main';
import { type RefObject, useEffect, useRef } from 'react';

export interface MonacoEditorLifecycleArgs {
  containerRef: RefObject<HTMLElement | null>;
  value: string;
  language: string;
  readOnly: boolean;
  /** Pre-built editor options. Merged on top of the lifecycle defaults. */
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
}

export interface MonacoEditorHandle {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  model: monaco.editor.ITextModel | null;
}

export function useMonacoEditorLifecycle(args: MonacoEditorLifecycleArgs): RefObject<MonacoEditorHandle> {
  const { containerRef, value, language, readOnly, options } = args;
  const handleRef = useRef<MonacoEditorHandle>({ editor: null, model: null });

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const model = monacoEditor.createModel(value, language);
    const editor = monacoEditor.create(container, {
      model,
      readOnly,
      automaticLayout: true,
      minimap: { enabled: false },
      // Scroll past the last line so navigator-driven jumps (Cmd/
      // Ctrl+K N/P, ↑/↓ chord, "next conflict" toolbar buttons) can
      // land on a hunk near the EOF and still scroll it to the top
      // of the viewport — VS Code's merge editor convention. Without
      // this, the last few hunks stay near the bottom of the
      // viewport because the editor refuses to scroll past EOF, and
      // the navigator's "reveal at top" call no-ops.
      scrollBeyondLastLine: true,
      renderLineHighlight: 'gutter',
      lineNumbers: 'on',
      folding: false,
      fontSize: 12,
      ...options,
    });
    handleRef.current = { editor, model };

    return () => {
      editor.setModel(null);
      editor.dispose();
      model.dispose();
      handleRef.current = { editor: null, model: null };
    };
  }, []);

  // Sync value when the prop changes externally (e.g. file switch).
  // Skip when the user is the source of the change — the editor
  // already holds the right value.
  useEffect(() => {
    const { model } = handleRef.current;
    if (!model) return;
    if (model.getValue() === value) return;
    model.setValue(value);
  }, [value]);

  // Sync language when it changes (e.g. yaml -> json).
  useEffect(() => {
    const { model } = handleRef.current;
    if (!model) return;
    if (model.getLanguageId() === language) return;
    monacoEditor.setModelLanguage(model, language);
  }, [language]);

  // Sync readOnly when toggled.
  useEffect(() => {
    handleRef.current.editor?.updateOptions({ readOnly });
  }, [readOnly]);

  return handleRef;
}
