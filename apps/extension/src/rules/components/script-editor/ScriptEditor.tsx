/**
 * ScriptEditor — Monaco-backed editor for `oh.*` pre-request +
 * post-response scripts (ARCHITECTURE §19). Monaco's TypeScript
 * language service gives completions, hovers, and deprecation tags
 * for the `oh.*` surface via the ambient `oh.d.ts` declaration fed
 * through the shared bootstrap.
 *
 * Bootstrap: Monaco ships locally via `monaco-editor` in package.json;
 * the shared `./monaco/bootstrap.ts` wires the React wrapper to the
 * bundled copy (no network fetches) and registers Vite-emitted local
 * Worker URLs for each language service.
 */

import { useTheme } from '@context/ThemeContext';
import Editor, { useMonaco } from '@monaco-editor/react';
import { theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useRef } from 'react';
import { useSettingValue } from '../../settings/hooks';
// Side-effect import: kicks Monaco's bootstrap at module load.
import '../monaco/bootstrap';

// ── Component ─────────────────────────────────────────────────────

interface ScriptEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  /** `'pre-request'` / `'post-response'` — surfaced as a subtle hint in
   *  the editor (no semantic effect; both share the same `oh.*` API). */
  kind: 'pre-request' | 'post-response';
  readOnly?: boolean;
  minHeight?: number;
}

const ScriptEditor: React.FC<ScriptEditorProps> = ({
  value = '',
  onChange,
  kind,
  readOnly = false,
  minHeight = 240,
}) => {
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const fontFamily = useSettingValue('editor.fontFamily');
  const fontSize = useSettingValue('editor.fontSize');
  const tabSize = useSettingValue('editor.tabSize');
  const insertSpaces = useSettingValue('editor.insertSpaces');
  const wordWrap = useSettingValue('editor.wordWrap');
  const lineNumbers = useSettingValue('editor.lineNumbers');
  const monacoInstance = useMonaco();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const options: monaco.editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    fontFamily,
    fontSize,
    lineNumbers: lineNumbers ? 'on' : 'off',
    tabSize,
    insertSpaces,
    wordWrap: wordWrap === 'off' ? 'off' : wordWrap === 'bounded' ? 'bounded' : 'on',
    automaticLayout: true,
    readOnly,
    scrollBeyondLastLine: false,
    padding: { top: 8, bottom: 8 },
  };

  return (
    <div
      className={`rules-script-editor rules-script-editor-${kind}`}
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
        minHeight,
      }}
    >
      <Editor
        height={minHeight}
        defaultLanguage="javascript"
        theme={isDarkMode ? 'vs-dark' : 'vs'}
        value={value}
        onMount={(ed) => {
          editorRef.current = ed;
        }}
        onChange={(next) => onChange?.(next ?? '')}
        options={options}
      />
      {!monacoInstance && (
        <div style={{ padding: 8, color: token.colorTextTertiary, fontSize: 12 }}>Loading editor…</div>
      )}
    </div>
  );
};

export default ScriptEditor;
