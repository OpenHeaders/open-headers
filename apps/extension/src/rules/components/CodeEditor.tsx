/**
 * CodeEditor — Monaco-backed editor host, driven by the `editor.*`
 * settings and the language registry.
 *
 * Monaco ships Linux-lite syntax highlighting + tokenization out of
 * the box for every language we care about (javascript / css / json /
 * html / xml / typescript). For formatting we wire Prettier in as a
 * `DocumentFormattingEditProvider` so `Shift-Alt-F` and the overlay
 * button both trigger the same pipeline.
 *
 * Host callers stay unchanged: `language` is still a string prop, same
 * `value` / `onChange` / `readOnly` / `placeholder` / `minHeight`.
 */

import { AlignLeftOutlined } from '@ant-design/icons';
import { useTheme } from '@context/ThemeContext';
import Editor from '@monaco-editor/react';
import { Alert, Button, Tooltip, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import { useShortcutLabel } from '../hooks/useWorkspaceShortcuts';
import { formatCode } from '../languages/formatter';
import { getLanguage, type LanguageId, toMonacoLanguage } from '../languages/registry';
import { useSettingValue } from '../settings/hooks';
// Side-effect import: kicks the Monaco bootstrap (loader.config + worker
// wiring + TS language-service setup) at module-load time so it wins
// the race against `<Editor>`'s own `loader.init`.
import './monaco/bootstrap';

interface CodeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  language?: LanguageId;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value = '',
  onChange,
  language = 'javascript',
  placeholder,
  minHeight = 200,
  readOnly = false,
}) => {
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Inline formatter error banner — populated when a Format call fails
  // with a parse error, cleared the moment the user edits the buffer
  // or runs Format successfully.
  const [formatError, setFormatError] = useState<string | null>(null);

  const fontFamily = useSettingValue('editor.fontFamily');
  const fontSize = useSettingValue('editor.fontSize');
  const tabSize = useSettingValue('editor.tabSize');
  const insertSpaces = useSettingValue('editor.insertSpaces');
  const wordWrap = useSettingValue('editor.wordWrap');
  const lineNumbers = useSettingValue('editor.lineNumbers');
  const renderWhitespace = useSettingValue('editor.renderWhitespace');
  const bracketPairColorization = useSettingValue('editor.bracketPairColorization');
  const formatShortcutLabel = useShortcutLabel('format-code');

  const formattable = getLanguage(language).formatter !== undefined;

  const runFormat = useCallback(async () => {
    if (readOnly || !formattable) return;
    const current = valueRef.current;
    const result = await formatCode(current, language);
    if (!result.ok) {
      setFormatError(result.error.message);
      return;
    }
    setFormatError(null);
    if (result.code !== current) {
      onChange?.(result.code);
    }
  }, [readOnly, formattable, language, onChange]);

  const runFormatRef = useRef(runFormat);
  runFormatRef.current = runFormat;

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
    bracketPairColorization: { enabled: bracketPairColorization },
    renderWhitespace: renderWhitespace === 'all' ? 'all' : renderWhitespace === 'boundary' ? 'boundary' : 'none',
    // Monaco's "fake" placeholder isn't native; we render our own overlay below.
  };

  const formatTooltip: React.ReactNode = readOnly ? (
    'Read-only'
  ) : !formattable ? (
    `No formatter for ${getLanguage(language).label}`
  ) : (
    <ShortcutHintTitle label={formatShortcutLabel}>Format</ShortcutHintTitle>
  );

  const showPlaceholder = !readOnly && placeholder && !value;

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
        position: 'relative',
      }}
      className="rules-code-editor"
    >
      <Editor
        height={minHeight}
        defaultLanguage={toMonacoLanguage(language)}
        language={toMonacoLanguage(language)}
        theme={isDarkMode ? 'vs-dark' : 'vs'}
        value={value}
        onMount={(ed, m) => {
          editorRef.current = ed;
          // Keybinding: Shift+Alt+F invokes the overlay format action
          // so the shortcut matches Monaco's own convention AND the
          // button both route through Prettier.
          ed.addAction({
            id: 'oh-format-code',
            label: 'Format (Prettier)',
            keybindings: [m.KeyMod.Shift | m.KeyMod.Alt | m.KeyCode.KeyF],
            contextMenuGroupId: '1_modification',
            run: () => {
              void runFormatRef.current();
            },
          });
        }}
        onChange={(next) => {
          if (formatError) setFormatError(null);
          onChange?.(next ?? '');
        }}
        options={options}
      />
      {showPlaceholder && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 52,
            color: token.colorTextTertiary,
            fontFamily,
            fontSize,
            pointerEvents: 'none',
          }}
        >
          {placeholder}
        </div>
      )}
      {formatError && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={() => setFormatError(null)}
          message="Cannot format — parse error"
          description={
            <pre
              style={{
                margin: 0,
                fontFamily,
                fontSize: Math.max(11, fontSize - 1),
                lineHeight: 1.45,
                whiteSpace: 'pre',
                overflowX: 'auto',
                color: 'inherit',
                background: 'transparent',
              }}
            >
              {formatError}
            </pre>
          }
          style={{
            borderRadius: 0,
            borderLeft: 0,
            borderRight: 0,
            borderBottom: 0,
          }}
        />
      )}
      {!readOnly && formattable && (
        <div className="rules-code-editor-format" style={{ position: 'absolute', top: 6, right: 14, zIndex: 2 }}>
          <Tooltip title={formatTooltip} placement="left">
            <Button
              size="small"
              type="text"
              icon={<AlignLeftOutlined />}
              onClick={() => void runFormat()}
              aria-label="Format code"
            />
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export default CodeEditor;
