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
  /**
   * One-line ghost hint shown when the editor is empty. We render it
   * as an overlay rather than seeding `value` so the draft stays
   * truly empty until the user types (no placeholder-as-source
   * pollution, no false positives on the dirty fingerprint).
   */
  placeholder?: string;
}

const ScriptEditor: React.FC<ScriptEditorProps> = ({
  value = '',
  onChange,
  kind,
  readOnly = false,
  minHeight = 240,
  placeholder,
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

  const showPlaceholder = !readOnly && placeholder && !value;

  return (
    <div
      className={`rules-script-editor rules-script-editor-${kind}`}
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
        minHeight,
        position: 'relative',
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
      {showPlaceholder && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 62,
            fontFamily,
            fontSize,
            color: token.colorTextTertiary,
            pointerEvents: 'none',
          }}
        >
          {placeholder}
        </div>
      )}
      {!monacoInstance && (
        <div style={{ padding: 8, color: token.colorTextTertiary, fontSize: 12 }}>Loading editor…</div>
      )}
    </div>
  );
};

export default ScriptEditor;
