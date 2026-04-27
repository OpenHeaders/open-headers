/**
 * Rich diff editor — Monaco's standalone `DiffEditor` mounted directly,
 * with an IDE-style toolbar on top. Self-contained and reusable across
 * the workbench (currently used by the import-preview modal; future
 * call sites can reuse it for any target-vs-incoming compare).
 *
 * Why not `@monaco-editor/react`'s `DiffEditor`? Its unmount path
 * disposes the `TextModel`s BEFORE the editor widget — Monaco asserts
 * exactly the opposite ordering and emits
 * `BugIndicatingError: TextModel got disposed before DiffEditorWidget
 * model got reset` on every close. We own the lifecycle here so the
 * dispose order is correct: `setModel(null)` → editor.dispose() → model
 * dispose. Same-shape API as the wrapper would have — controlled
 * `options` + `onOptionsChange` for persistence, optional `header` slot.
 *
 * Lifecycle invariants:
 *   • Editor is created exactly once (on container mount).
 *   • Two `TextModel`s are created up-front and held stable across
 *     prop changes; content updates flow through `model.setValue()`.
 *     This is faster than the wrapper's swap-on-prop-change path AND
 *     avoids a class of half-attached-model races.
 *   • Theme is global to Monaco; we apply via `editor.setTheme` on
 *     mount and on every dark-mode change.
 *   • `onDidUpdateDiff` subscription is held on a ref and disposed
 *     during unmount before the editor / models go away.
 */

import { useTheme } from '@context/ThemeContext';
import { theme } from 'antd';
import type * as monaco from 'monaco-editor';
import { editor as monacoEditor } from 'monaco-editor/esm/vs/editor/edcore.main';
import type React from 'react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import DiffEditorToolbar from './DiffEditorToolbar';
import { toMonacoDiffOptions } from './monaco-options';
import type { DiffViewerOptions } from './types';

interface Props {
  original: string;
  modified: string;
  language?: string;
  options: DiffViewerOptions;
  onOptionsChange: (next: DiffViewerOptions) => void;
  /** Optional header content rendered above the toolbar (e.g. entity
   *  title + strategy controls). The toolbar stays directly above the
   *  editor regardless. */
  header?: ReactNode;
}

const RichDiffEditor: React.FC<Props> = ({
  original,
  modified,
  language = 'yaml',
  options,
  onOptionsChange,
  header,
}) => {
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const originalModelRef = useRef<monaco.editor.ITextModel | null>(null);
  const modifiedModelRef = useRef<monaco.editor.ITextModel | null>(null);
  const diffSubRef = useRef<monaco.IDisposable | null>(null);

  const [diffCount, setDiffCount] = useState<number | null>(null);

  // ── Mount: create editor + models, set up diff-count subscription.
  // Cleanup releases everything in the order Monaco requires:
  // setModel(null) → dispose editor → dispose models. ────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only — initial values seed the editor; subsequent prop changes flow through their own effects below.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const theme = isDarkMode ? 'oh-dark' : 'oh-light';
    monacoEditor.setTheme(theme);

    const originalModel = monacoEditor.createModel(original, language);
    const modifiedModel = monacoEditor.createModel(modified, language);
    originalModelRef.current = originalModel;
    modifiedModelRef.current = modifiedModel;

    const editor = monacoEditor.createDiffEditor(container, {
      automaticLayout: true,
      ...toMonacoDiffOptions(options),
    });
    editor.setModel({ original: originalModel, modified: modifiedModel });
    editorRef.current = editor;

    diffSubRef.current = editor.onDidUpdateDiff(() => {
      const changes = editor.getLineChanges();
      setDiffCount(changes ? changes.length : 0);
    });
    // Diff may already be computed before subscription attaches.
    const initialChanges = editor.getLineChanges();
    setDiffCount(initialChanges ? initialChanges.length : 0);

    return () => {
      diffSubRef.current?.dispose();
      diffSubRef.current = null;
      // Order matters: release the models from the widget BEFORE
      // disposing them, otherwise Monaco's onWillDispose guard fires
      // (`TextModel got disposed before DiffEditorWidget model got reset`).
      editor.setModel(null);
      editor.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
      editorRef.current = null;
      originalModelRef.current = null;
      modifiedModelRef.current = null;
    };
  }, []);

  // ── Prop sync: content. Stable models, content via setValue. ──────
  useEffect(() => {
    const m = originalModelRef.current;
    if (m && m.getValue() !== original) m.setValue(original);
  }, [original]);

  useEffect(() => {
    const m = modifiedModelRef.current;
    if (m && m.getValue() !== modified) m.setValue(modified);
  }, [modified]);

  // ── Prop sync: language. ──────────────────────────────────────────
  useEffect(() => {
    if (originalModelRef.current) monacoEditor.setModelLanguage(originalModelRef.current, language);
    if (modifiedModelRef.current) monacoEditor.setModelLanguage(modifiedModelRef.current, language);
  }, [language]);

  // ── Prop sync: theme (global to Monaco). ──────────────────────────
  useEffect(() => {
    monacoEditor.setTheme(isDarkMode ? 'oh-dark' : 'oh-light');
  }, [isDarkMode]);

  // ── Prop sync: editor options. ────────────────────────────────────
  useEffect(() => {
    editorRef.current?.updateOptions(toMonacoDiffOptions(options));
  }, [options]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {header ? <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>{header}</div> : null}
      <DiffEditorToolbar options={options} onChange={onOptionsChange} diffCount={diffCount} />
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, position: 'relative' }} />
    </div>
  );
};

export default RichDiffEditor;
