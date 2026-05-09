/**
 * CodeEditor — Monaco-backed editor host, driven by the `editor.*`
 * settings and the language registry.
 *
 * Formatting architecture: the Format button + Shift+Alt+F BOTH invoke
 * Monaco's `editor.action.formatDocument` action. Monaco dispatches to
 * whichever `DocumentFormattingEditProvider` owns the active model's
 * language — JSON / CSS / HTML are handled by Monaco's built-in LSP
 * workers (zero extra bundle), JS / XML are handled by the Prettier
 * provider we register in `monaco/formatters.ts`. The UI never
 * hard-codes "which formatter" — that decision is Monaco's.
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
import { getLanguage, type LanguageId, toMonacoLanguage } from '../languages/registry';
import { resolveFontFamily } from '../settings/schema/editor';
import { useSettingValue } from '../settings/hooks';
// Side-effect import: kicks the Monaco bootstrap (loader.config + worker
// wiring + TS language-service setup + Prettier provider registration)
// at module-load time so it wins the race against `<Editor>`'s own
// `loader.init`.
import './monaco/bootstrap';
import { useMonacoVariableCompletions } from './template-input';

/** Monaco language ids that have a registered formatter — either
 *  Monaco's built-in LSP (JSON / CSS / HTML) or our Prettier provider
 *  (JS / XML). `plaintext` + graphql fallbacks stay off. The set is
 *  source-of-truth constant: adding a language here requires adding a
 *  provider somewhere Monaco can see. */
const MONACO_FORMATTABLE_LANGUAGES = new Set(['javascript', 'json', 'css', 'html', 'xml']);

interface CodeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  language?: LanguageId;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
  /** When true, register the cross-scope `{{VAR}}` completion
   *  provider on mount (docs/VARIABLE_AUTOCOMPLETE_PLAN.md Phase D).
   *  Defaults to true for every host that doesn't opt out — callers
   *  that embed user scripts or SQL editors where `{{VAR}}` shouldn't
   *  expand can pass `variableAutoComplete={false}`. */
  variableAutoComplete?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value = '',
  onChange,
  language = 'javascript',
  placeholder,
  minHeight = 200,
  readOnly = false,
  variableAutoComplete = true,
}) => {
  const registerCompletions = useMonacoVariableCompletions();
  const { token } = theme.useToken();
  const { monacoTheme } = useTheme();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Inline formatter error banner — populated when a Format call fails
  // with a parse error, cleared the moment the user edits the buffer
  // or runs Format successfully.
  const [formatError, setFormatError] = useState<string | null>(null);

  const fontFamilyPreset = useSettingValue('editor.fontFamilyPreset');
  const fontFamily = resolveFontFamily(fontFamilyPreset);
  const fontSize = useSettingValue('editor.fontSize');
  const fontWeight = useSettingValue('editor.fontWeight');
  const fontLigatures = useSettingValue('editor.fontLigatures');
  const lineHeight = useSettingValue('editor.lineHeight');
  const tabSize = useSettingValue('editor.tabSize');
  const insertSpaces = useSettingValue('editor.insertSpaces');
  const wordWrap = useSettingValue('editor.wordWrap');
  const lineNumbers = useSettingValue('editor.lineNumbers');
  const renderWhitespace = useSettingValue('editor.renderWhitespace');
  const bracketPairColorization = useSettingValue('editor.bracketPairColorization');
  const formatShortcutLabel = useShortcutLabel('format-code');

  // Ask Monaco whether a `DocumentFormattingEditProvider` is registered
  // for the language — single source of truth for "is this buffer
  // formattable?". JSON / CSS / HTML have Monaco's built-ins; JS / XML
  // are registered by `registerPrettierFormatters`. Unregistered
  // languages (text, graphql) return false → button stays hidden.
  const formattable = MONACO_FORMATTABLE_LANGUAGES.has(toMonacoLanguage(language));

  const runFormat = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || readOnly || !formattable) return;
    const current = valueRef.current;
    // Empty/whitespace buffer — there's nothing to format. Clear any
    // prior error and no-op so a JSON.parse('') or Prettier invocation
    // doesn't throw "Unexpected end of input" in the user's face.
    if (current.trim().length === 0) {
      setFormatError(null);
      return;
    }
    try {
      const action = editor.getAction('editor.action.formatDocument');
      if (!action) {
        setFormatError(null);
        return;
      }
      await action.run();
      setFormatError(null);
    } catch (err) {
      setFormatError(err instanceof Error ? err.message : 'Format failed');
    }
  }, [readOnly, formattable]);

  const runFormatRef = useRef(runFormat);
  runFormatRef.current = runFormat;

  const options: monaco.editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    fontFamily,
    fontSize,
    fontWeight,
    fontLigatures,
    lineHeight,
    lineNumbers: lineNumbers ? 'on' : 'off',
    tabSize,
    insertSpaces,
    wordWrap: wordWrap === 'off' ? 'off' : wordWrap === 'bounded' ? 'bounded' : 'on',
    automaticLayout: true,
    readOnly,
    scrollBeyondLastLine: false,
    // Flush-to-top layout: line 1 butts up against the editor border
    // (matches other API clients' editors). Bottom padding is fine —
    // it's just breathing room at the scroll bottom.
    padding: { top: 0, bottom: 8 },
    // `'line'` paints only the line body (not the gutter number) —
    // matches the reference editors where the grey band begins after
    // the row number. The visible shade comes from our `oh-light` /
    // `oh-dark` theme overriding `editor.lineHighlightBackground`.
    renderLineHighlight: 'line',
    // Hide the band when the editor doesn't have focus — the line
    // highlight is a "you are editing here" cue, not a permanent
    // row marker.
    renderLineHighlightOnlyWhenFocus: true,
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
        theme={monacoTheme}
        value={value}
        onMount={(ed, monacoApi) => {
          editorRef.current = ed;
          // Shift+Alt+F is Monaco's default keybinding for
          // `editor.action.formatDocument`. Since both the Format
          // button and the shortcut go through the same action, no
          // custom keybinding registration is needed — Monaco dispatches
          // to the language's formatter provider on its own.
          if (variableAutoComplete) registerCompletions(monacoApi);
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
            top: 0,
            left: 52,
            // Match Monaco's default line-height so the hint sits on the
            // same vertical baseline as line 1's caret.
            lineHeight: '19px',
            maxWidth: 'calc(100% - 72px)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
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
