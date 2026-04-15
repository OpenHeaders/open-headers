/**
 * CodeEditor — CodeMirror 6 host, driven entirely by the editor.*
 * settings and the language registry.
 *
 * Language packs are loaded via `languages/registry.ts` with dynamic
 * imports, so each `@codemirror/lang-*` package lands in its own Vite
 * chunk and the main workspace bundle only pays for CodeMirror core
 * plus whatever language the first-opened tab asks for. The formatter
 * is similarly lazy via `languages/formatter.ts`.
 *
 * The Format affordance:
 *   - A top-right overlay button (visible on hover/focus) that calls
 *     `formatCode()` for the current language. Disabled when the
 *     editor is read-only or the language has no formatter.
 *   - Keymap binding: `Shift-Alt-f` runs the same command.
 *   - On parse failure, the error surfaces via antd `message.error`
 *     and the buffer is left untouched.
 *
 * Host callers stay unchanged: `language` is still a string prop.
 * Internally we route it through the registry.
 */

import { AlignLeftOutlined } from '@ant-design/icons';
import { indentUnit } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, highlightWhitespace } from '@codemirror/view';
import { useTheme } from '@context/ThemeContext';
import CodeMirror, { type BasicSetupOptions, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { Alert, Button, Tooltip, theme } from 'antd';
import { ShortcutHintTitle } from '@/components/ShortcutKbd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildChordsFromEvent, useShortcutLabel } from '../hooks/useWorkspaceShortcuts';
import { formatCode } from '../languages/formatter';
import { getLanguage, type LanguageId } from '../languages/registry';
import { useSettingValue } from '../settings/hooks';

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
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Inline formatter error banner — populated when a Format call fails
  // with a parse error, cleared the moment the user edits the buffer
  // or runs Format successfully. Kept out of the toast layer because
  // parser errors are multi-line with code snippets and the user
  // needs them visible while they fix the input.
  const [formatError, setFormatError] = useState<string | null>(null);

  const fontFamily = useSettingValue('editor.fontFamily');
  const fontSize = useSettingValue('editor.fontSize');
  const tabSize = useSettingValue('editor.tabSize');
  const insertSpaces = useSettingValue('editor.insertSpaces');
  const wordWrap = useSettingValue('editor.wordWrap');
  const wordWrapColumn = useSettingValue('editor.wordWrapColumn');
  const lineNumbers = useSettingValue('editor.lineNumbers');
  const renderWhitespace = useSettingValue('editor.renderWhitespace');
  const bracketPairColorization = useSettingValue('editor.bracketPairColorization');
  const formatCodeChord = useSettingValue('keyboard.formatCode');
  const formatShortcutLabel = useShortcutLabel('format-code');
  // Keep the chord in a ref so the DOM-level keydown handler always
  // reads the latest value without forcing the extensions array to
  // rebuild. Rebinding in Settings takes effect on the next keystroke.
  const formatCodeChordRef = useRef(formatCodeChord);
  formatCodeChordRef.current = formatCodeChord;

  // Dynamically load the language extension. Each CodeMirror
  // `@codemirror/lang-*` package is its own chunk; this hook only
  // pays the download cost the first time a given language is opened
  // in the current session.
  const [languageExtension, setLanguageExtension] = useState<Extension | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLanguageExtension(null);
    void getLanguage(language)
      .loadExtension()
      .then((ext) => {
        if (!cancelled) setLanguageExtension(ext);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const formattable = getLanguage(language).formatter !== undefined;

  // ── Format command (wired to both the button and the keymap) ──
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

  // Hold the latest runFormat in a ref so the DOM keydown handler
  // installed once as a CodeMirror extension doesn't need to rebuild
  // when `runFormat` identity changes.
  const runFormatRef = useRef(runFormat);
  runFormatRef.current = runFormat;

  // ── CodeMirror basic setup ────────────────────────────────────
  const basicSetup: BasicSetupOptions = useMemo(
    () => ({
      lineNumbers,
      highlightActiveLineGutter: lineNumbers,
      foldGutter: lineNumbers,
      bracketMatching: bracketPairColorization,
      closeBrackets: true,
      autocompletion: true,
      tabSize,
    }),
    [lineNumbers, bracketPairColorization, tabSize],
  );

  const extensions = useMemo<Extension[]>(() => {
    const list: Extension[] = [];
    if (languageExtension) list.push(languageExtension);

    list.push(indentUnit.of(insertSpaces ? ' '.repeat(tabSize) : '\t'));
    list.push(EditorState.tabSize.of(tabSize));

    if (wordWrap === 'on' || wordWrap === 'bounded') {
      list.push(EditorView.lineWrapping);
    }
    if (wordWrap === 'bounded') {
      list.push(
        EditorView.theme({
          '.cm-content': {
            maxWidth: `${wordWrapColumn}ch`,
          },
        }),
      );
    }

    if (renderWhitespace === 'all' || renderWhitespace === 'boundary') {
      list.push(highlightWhitespace());
    }

    if (isDarkMode) list.push(oneDark);

    // Format-code keymap — installed as a DOM-level keydown handler
    // on the editor container instead of CodeMirror's built-in
    // `keymap` facet. Rationale: on macOS, `Option+letter` combos
    // produce dead-key composition (`Option+Shift+F` → `Ï`), so
    // CodeMirror's `event.key` based matcher never sees the base
    // letter. `buildChordsFromEvent` is the shared helper that also
    // backs `useWorkspaceShortcuts` and normalizes the event via
    // `event.code`, which is layout-independent and immune to dead
    // keys.
    //
    // Both the chord and the command are read from refs so changing
    // either doesn't force the extensions array to rebuild — rebinding
    // in Settings takes effect on the next keystroke without thrashing
    // CodeMirror.
    list.push(
      EditorView.domEventHandlers({
        keydown: (event) => {
          const chord = formatCodeChordRef.current;
          if (!chord) return false;
          const eventChords = buildChordsFromEvent(event);
          if (!eventChords.includes(chord)) return false;
          event.preventDefault();
          event.stopPropagation();
          void runFormatRef.current();
          return true;
        },
      }),
    );

    list.push(
      EditorView.theme({
        '&': {
          fontFamily,
          fontSize: `${fontSize}px`,
        },
        '.cm-scroller': {
          fontFamily,
          minHeight: `${minHeight}px`,
        },
      }),
    );

    return list;
  }, [
    languageExtension,
    insertSpaces,
    tabSize,
    wordWrap,
    wordWrapColumn,
    renderWhitespace,
    isDarkMode,
    fontFamily,
    fontSize,
    minHeight,
  ]);

  const formatTooltip: React.ReactNode = readOnly
    ? 'Read-only'
    : !formattable
      ? `No formatter for ${getLanguage(language).label}`
      : <ShortcutHintTitle label={formatShortcutLabel}>Format</ShortcutHintTitle>;

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
      <CodeMirror
        ref={cmRef}
        value={value}
        onChange={(next) => {
          // Any user edit invalidates the displayed format error —
          // they're about to (or already have) fixed the input.
          if (formatError) setFormatError(null);
          onChange?.(next);
        }}
        readOnly={readOnly}
        placeholder={placeholder}
        basicSetup={basicSetup}
        extensions={extensions}
        theme={isDarkMode ? 'dark' : 'light'}
        minHeight={`${minHeight}px`}
      />
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
        <div
          className="rules-code-editor-format"
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            zIndex: 2,
          }}
        >
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
