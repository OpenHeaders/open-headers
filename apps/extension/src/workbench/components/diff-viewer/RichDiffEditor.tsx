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
  const [diffCount, setDiffCount] = useState<number | null>(null);

  const recountDifferences = useCallback((editor: monaco.editor.IStandaloneDiffEditor): void => {
    const changes = editor.getLineChanges();
    setDiffCount(changes ? changes.length : 0);
  }, []);

  const onMount = useCallback(
    (editor: monaco.editor.IStandaloneDiffEditor, _m: Monaco) => {
      editorRef.current = editor;
      const dispose = editor.onDidUpdateDiff(() => recountDifferences(editor));
      // Initial compute may have already fired before our subscription —
      // ask once explicitly.
      recountDifferences(editor);
      // Cache disposer on the instance so the next mount can clean up.
      (editor as unknown as { _ohDisposer?: monaco.IDisposable })._ohDisposer = dispose;
    },
    [recountDifferences],
  );

  // Live-apply option changes — `editor.updateOptions` is the supported
  // path for everything except `renderSideBySide`, which the React
  // wrapper sometimes drops; we force a remount via the `key` below
  // when the viewer mode flips so the user always sees the right layout.
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
          key={options.mode}
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
