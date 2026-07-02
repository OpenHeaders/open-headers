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
 *   • Models are *swapped* (not mutated in place) when content changes.
 *     `setValue()` on a stable model retains Monaco's per-region
 *     "user expanded" cache, which carries over to unrelated content
 *     and prevents `hideUnchangedRegions` from collapsing on first
 *     paint after a row switch. New model identity ⇒ fresh state ⇒
 *     the option applies cleanly. Old models are disposed AFTER
 *     `setModel({newPair})` releases them from the widget.
 *   • A `loading` flag covers the window between content-swap and the
 *     `onDidUpdateDiff` callback. Monaco's default `advanced` diff
 *     algorithm is the best quality but runs async; rendering a
 *     skeleton over the editor during that window avoids the visible
 *     "content paints, decorations follow 100–200 ms later" flash.
 *   • Theme is global to Monaco; we apply via `editor.setTheme` on
 *     mount and on every dark-mode change.
 *   • `onDidUpdateDiff` subscription is held on a ref and disposed
 *     during unmount before the editor / models go away.
 */

import { useUiTheme } from '@openheaders/ui/context';
import { Skeleton, theme } from 'antd';
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
  /** Hide the built-in toolbar — for hosts that surface the option
   *  controls in their own chrome (e.g. the DevTools panel's bottom
   *  bar). Options stay controlled via `options`. */
  showToolbar?: boolean;
}

const RichDiffEditor: React.FC<Props> = ({
  original,
  modified,
  language = 'yaml',
  options,
  onOptionsChange,
  header,
  showToolbar = true,
}) => {
  const { token } = theme.useToken();
  const { isDarkMode, monacoTheme } = useUiTheme();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const originalModelRef = useRef<monaco.editor.ITextModel | null>(null);
  const modifiedModelRef = useRef<monaco.editor.ITextModel | null>(null);
  const diffSubRef = useRef<monaco.IDisposable | null>(null);

  const [diffCount, setDiffCount] = useState<number | null>(null);
  // True while a diff computation is in flight for the current pair.
  // Flipped to false the next time `onDidUpdateDiff` fires.
  const [loading, setLoading] = useState(true);

  // ── Mount: create editor + initial models, set up diff-count
  // subscription. Cleanup releases everything in the order Monaco
  // requires: setModel(null) → dispose editor → dispose models. ─────
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only — initial values seed the editor; subsequent prop changes flow through their own effects below.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    monacoEditor.setTheme(monacoTheme);

    const editor = monacoEditor.createDiffEditor(container, {
      automaticLayout: true,
      ...toMonacoDiffOptions(options),
    });
    editorRef.current = editor;

    diffSubRef.current = editor.onDidUpdateDiff(() => {
      const changes = editor.getLineChanges();
      setDiffCount(changes ? changes.length : 0);
      setLoading(false);
    });

    const orig = monacoEditor.createModel(original, language);
    const mod = monacoEditor.createModel(modified, language);
    editor.setModel({ original: orig, modified: mod });
    originalModelRef.current = orig;
    modifiedModelRef.current = mod;

    return () => {
      diffSubRef.current?.dispose();
      diffSubRef.current = null;
      // Order matters: release the models from the widget BEFORE
      // disposing them, otherwise Monaco's onWillDispose guard fires
      // (`TextModel got disposed before DiffEditorWidget model got reset`).
      editor.setModel(null);
      editor.dispose();
      originalModelRef.current?.dispose();
      modifiedModelRef.current?.dispose();
      editorRef.current = null;
      originalModelRef.current = null;
      modifiedModelRef.current = null;
    };
  }, []);

  // ── Prop sync: content. Swap models entirely on change so Monaco's
  // per-region expansion cache is reset and `hideUnchangedRegions`
  // applies cleanly to the new pair. The previous setValue-on-stable
  // -model approach kept the cache and left unchanged regions visible
  // until the user manually toggled the eye icon round-trip. ────────
  useEffect(() => {
    const editor = editorRef.current;
    const oldOrig = originalModelRef.current;
    const oldMod = modifiedModelRef.current;
    if (!editor || !oldOrig || !oldMod) return;
    if (oldOrig.getValue() === original && oldMod.getValue() === modified) return;

    setLoading(true);
    const newOrig = monacoEditor.createModel(original, language);
    const newMod = monacoEditor.createModel(modified, language);
    editor.setModel({ original: newOrig, modified: newMod });
    // The widget no longer holds the old models — safe to dispose.
    oldOrig.dispose();
    oldMod.dispose();
    originalModelRef.current = newOrig;
    modifiedModelRef.current = newMod;
  }, [original, modified, language]);

  // ── Prop sync: theme (global to Monaco). ──────────────────────────
  useEffect(() => {
    monacoEditor.setTheme(monacoTheme);
  }, [monacoTheme]);

  // ── Prop sync: editor options. ────────────────────────────────────
  useEffect(() => {
    editorRef.current?.updateOptions(toMonacoDiffOptions(options));
  }, [options]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {header ? <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>{header}</div> : null}
      {showToolbar && <DiffEditorToolbar options={options} onChange={onOptionsChange} diffCount={diffCount} />}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        {loading && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              padding: '14px 20px',
              background: token.colorBgContainer,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <Skeleton
              active
              paragraph={{
                rows: 14,
                width: [
                  '38%',
                  '62%',
                  '52%',
                  '74%',
                  '46%',
                  '70%',
                  '34%',
                  '58%',
                  '66%',
                  '42%',
                  '78%',
                  '50%',
                  '60%',
                  '44%',
                ],
              }}
              title={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default RichDiffEditor;
