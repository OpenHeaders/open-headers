/**
 * Rich diff editor — Monaco's `DiffEditor` with an IDE-style toolbar
 * on top. Self-contained and reusable across the workbench (currently
 * used by the import-preview modal; future call sites can reuse it
 * for any target-vs-incoming compare).
 *
 * Controlled API: callers pass `options` + `onOptionsChange` to wire
 * persistence (typically `useSetting`). The `header` slot is for
 * out-of-toolbar content the consumer wants above the editor (entity
 * title, strategy controls, etc.) — kept above the toolbar so the
 * toolbar always lives directly on top of the diff itself, IDE-style.
 */

import { useTheme } from '@context/ThemeContext';
import { DiffEditor, type Monaco } from '@monaco-editor/react';
import { theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
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
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const diffSubRef = useRef<monaco.IDisposable | null>(null);
  const [diffCount, setDiffCount] = useState<number | null>(null);

  const recountDifferences = useCallback((editor: monaco.editor.IStandaloneDiffEditor): void => {
    const changes = editor.getLineChanges();
    setDiffCount(changes ? changes.length : 0);
  }, []);

  const onMount = useCallback(
    (editor: monaco.editor.IStandaloneDiffEditor, _m: Monaco) => {
      editorRef.current = editor;
      diffSubRef.current = editor.onDidUpdateDiff(() => recountDifferences(editor));
      // Initial compute may have fired before subscription — recount once.
      recountDifferences(editor);
    },
    [recountDifferences],
  );

  // Unmount cleanup. Two things matter here:
  //   1. Dispose our `onDidUpdateDiff` subscription before Monaco tears
  //      the editor down, otherwise the listener can fire against a
  //      half-disposed editor.
  //   2. Call `setModel(null)` on the editor BEFORE the
  //      `@monaco-editor/react` wrapper disposes the underlying
  //      original/modified `TextModel`s. Monaco asserts the widget
  //      releases the models before they dispose; without this we get
  //      `BugIndicatingError: TextModel got disposed before
  //      DiffEditorWidget model got reset` on every modal close. React
  //      runs effect cleanups in reverse registration order, so this
  //      effect's cleanup fires before the wrapper's — i.e. while the
  //      models are still alive.
  useEffect(() => {
    return () => {
      diffSubRef.current?.dispose();
      diffSubRef.current = null;
      try {
        editorRef.current?.setModel(null);
      } catch {
        // Editor may already be torn down in some unmount orderings;
        // swallow rather than mask the real React error.
      }
      editorRef.current = null;
    };
  }, []);

  // Live-apply every option through `updateOptions` — including
  // `renderSideBySide`, which Monaco honours dynamically. Avoid
  // remounting the `DiffEditor` on viewer-mode flips: the
  // `@monaco-editor/react` wrapper shares text models across instances,
  // so a same-frame unmount/mount disposes a model the new instance
  // already holds, surfacing the BugIndicatingError above.
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions(toMonacoDiffOptions(options));
    }
  }, [options]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {header ? <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>{header}</div> : null}
      <DiffEditorToolbar options={options} onChange={onOptionsChange} diffCount={diffCount} />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <DiffEditor
          original={original}
          modified={modified}
          language={language}
          theme={isDarkMode ? 'oh-dark' : 'oh-light'}
          onMount={onMount}
          options={toMonacoDiffOptions(options)}
        />
      </div>
    </div>
  );
};

export default RichDiffEditor;
