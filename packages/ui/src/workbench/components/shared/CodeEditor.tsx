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

import { AlignLeftOutlined, SearchOutlined, SwapOutlined } from '@ant-design/icons';
import { useUiTheme } from '@openheaders/ui/context';
import Editor, { type Monaco } from '@monaco-editor/react';
import { Alert, Button, Tooltip, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { isMac } from '@openheaders/ui/shared/platform';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';
import { getLanguage, type LanguageId, toMonacoLanguage } from '../../languages/registry';
import { resolveFontFamily } from '../../settings/schema/editor';
import { useSettingValue } from '../../settings/hooks';
// Side-effect import: kicks the Monaco bootstrap (loader.config + worker
// wiring + TS language-service setup + Prettier provider registration)
// at module-load time so it wins the race against `<Editor>`'s own
// `loader.init`.
import '../monaco/bootstrap';
import { useMonacoVariableCompletions } from '../template-input';
import { useMonacoJwtEdit } from '../value-editors';

/** Monaco language ids that have a registered formatter — either
 *  Monaco's built-in LSP (JSON / CSS / HTML) or our Prettier provider
 *  (JS / XML). `plaintext` + graphql fallbacks stay off. The set is
 *  source-of-truth constant: adding a language here requires adding a
 *  provider somewhere Monaco can see. */
const MONACO_FORMATTABLE_LANGUAGES = new Set(['javascript', 'json', 'css', 'html', 'xml']);

// Monaco's own (fixed) keybindings for the find / replace widgets —
// shown as tooltip hints on the corner action buttons.
const FIND_SHORTCUT = isMac ? '⌘F' : 'Ctrl+F';
const REPLACE_SHORTCUT = isMac ? '⌥⌘F' : 'Ctrl+H';

interface CodeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  language?: LanguageId;
  placeholder?: string;
  minHeight?: number;
  readOnly?: boolean;
  /** Fill the parent's height instead of the fixed `minHeight` + manual
   *  resize grip — for panes that own their vertical space (e.g. the
   *  response body viewer). The parent must be a sized flex column. */
  fill?: boolean;
  /** When true, register the cross-scope `{{VAR}}` completion
   *  provider on mount.
   *  Defaults to true for every host that doesn't opt out — callers
   *  that embed user scripts or SQL editors where `{{VAR}}` shouldn't
   *  expand can pass `variableAutoComplete={false}`. */
  variableAutoComplete?: boolean;
  /** Hands the mounted Monaco instance to the host — for surfaces that
   *  add their own actions (e.g. the Docs tab's markdown toolbar +
   *  formatting shortcuts). */
  onEditorMount?: (editor: monaco.editor.IStandaloneCodeEditor, monacoApi: Monaco) => void;
  /** Per-pane wrap override — wins over the `editor.wordWrap` setting.
   *  For hosts with their own Wrap Lines toggle (e.g. the response
   *  body viewer); omit to follow the setting. */
  wordWrapOverride?: 'on' | 'off';
  /** When true, detected values inside the buffer get an editor
   *  affordance — JWTs become "Edit JWT" links (cmd/ctrl+click) that
   *  open the shared JWT modal and write the edited token back in
   *  place. Off by default; the raw request-body editor opts in. */
  valueDetection?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value = '',
  onChange,
  language = 'javascript',
  placeholder,
  minHeight = 200,
  readOnly = false,
  fill = false,
  variableAutoComplete = true,
  onEditorMount,
  wordWrapOverride,
  valueDetection = false,
}) => {
  const registerCompletions = useMonacoVariableCompletions();
  const { attachJwtDetection, jwtModal } = useMonacoJwtEdit();
  const { token } = theme.useToken();
  const { monacoTheme } = useUiTheme();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Inline formatter error banner — populated when a Format call fails
  // with a parse error, cleared the moment the user edits the buffer
  // or runs Format successfully.
  const [formatError, setFormatError] = useState<string | null>(null);

  // Manual height from the corner resize grip (same affordance as
  // TemplateInput's). Overrides `minHeight` once dragged; double-click
  // resets to the default. Monaco follows via `automaticLayout`.
  const [manualHeight, setManualHeight] = useState<number | null>(null);
  const gripDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const editorHeight = manualHeight ?? minHeight;
  const editorHeightRef = useRef(editorHeight);
  editorHeightRef.current = editorHeight;
  const handleGripPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    gripDragRef.current = { startY: e.clientY, startHeight: editorHeightRef.current };
  }, []);
  const handleGripPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = gripDragRef.current;
    if (!drag) return;
    setManualHeight(Math.max(80, drag.startHeight + (e.clientY - drag.startY)));
  }, []);
  const handleGripPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    gripDragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  const fontFamilyPreset = useSettingValue('editor.fontFamilyPreset');
  const fontFamily = resolveFontFamily(fontFamilyPreset);
  const fontSize = useSettingValue('editor.fontSize');
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

  // Focus first so the widget seeds from the current selection and Esc
  // returns focus to the buffer — same as invoking the keybinding.
  const runEditorAction = useCallback((id: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    void editor.getAction(id)?.run();
  }, []);

  const options: monaco.editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    // No web-url link detection — "Follow link" on urls in a request
    // body/script adds nothing. The JWT edit affordance doesn't ride
    // the link machinery (it's decoration-driven, see value-editors),
    // so it survives this being off.
    links: false,
    fontFamily,
    fontSize,
    fontLigatures,
    lineHeight,
    lineNumbers: lineNumbers ? 'on' : 'off',
    tabSize,
    insertSpaces,
    wordWrap: wordWrapOverride ?? (wordWrap === 'off' ? 'off' : wordWrap === 'bounded' ? 'bounded' : 'on'),
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
    // Keep the buffer still when the find widget opens — the default
    // inserts a view zone above line 1 (shifting all rows down) so the
    // widget doesn't cover the first lines; in these compact editors
    // the jump is worse than the momentary overlap.
    find: { addExtraSpaceOnTop: false },
    // Doc hovers open BELOW the hovered token. The default 'above'
    // clips at the editor's top border for the first lines — where the
    // hover target usually is in these short buffers.
    hover: { above: false },
    renderWhitespace: renderWhitespace === 'all' ? 'all' : renderWhitespace === 'boundary' ? 'boundary' : 'none',
    // Native ghost hint on an empty buffer — positioned by Monaco at the
    // true content origin so the caret sits at the text start, exactly
    // like an empty <input>. Multi-line wrapping is enabled in
    // `rules.less` (`.editorPlaceholder`); Monaco's default is one line.
    placeholder,
  };

  const formatTooltip: React.ReactNode = readOnly ? (
    'Read-only'
  ) : !formattable ? (
    `No formatter for ${getLanguage(language).label}`
  ) : (
    <ShortcutHintTitle label={formatShortcutLabel}>Format</ShortcutHintTitle>
  );

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
        position: 'relative',
        // Matches every theme's `editor.background`, so the grip strip
        // below the editor reads as part of the editor surface.
        background: token.colorBgContainer,
        ...(fill ? { height: '100%', display: 'flex', flexDirection: 'column' as const, minHeight: 0 } : {}),
      }}
      className="rules-code-editor"
    >
      <Editor
        height={fill ? '100%' : editorHeight}
        // `wrapperProps.style` REPLACES the library's computed wrapper
        // style (it spreads after), so the fill variant restates the
        // defaults (flex + relative) and adds flex sizing so the editor
        // stretches with the pane instead of the fixed height.
        wrapperProps={
          fill
            ? { style: { display: 'flex', position: 'relative', textAlign: 'initial', flex: 1, minHeight: 0 } }
            : undefined
        }
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
          if (valueDetection) attachJwtDetection(ed, monacoApi);
          onEditorMount?.(ed, monacoApi);
        }}
        onChange={(next) => {
          if (formatError) setFormatError(null);
          onChange?.(next ?? '');
        }}
        options={options}
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
                overflowX: 'auto', overscrollBehavior: 'none',
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
      {/* z-index 12: above Monaco's sticky-scroll rows (4) and scrollbar
          (11), below the find widget (35) so the opened widget covers
          the cluster that launched it. */}
      <div
        className="rules-code-editor-actions"
        style={{
          position: 'absolute',
          top: 6,
          right: 14,
          zIndex: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          // Elevated rounded rect (same chrome as the Scripts tab's
          // Packages/Snippets bar) — the icons floated transparent over
          // the buffer text and became unreadable on long first lines.
          padding: '2px 4px',
          background: token.colorBgElevated,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
          boxShadow: token.boxShadowTertiary,
        }}
      >
        <Tooltip title={<ShortcutHintTitle label={FIND_SHORTCUT}>Find</ShortcutHintTitle>} placement="top">
          <Button
            size="small"
            type="text"
            icon={<SearchOutlined />}
            onClick={() => runEditorAction('actions.find')}
            aria-label="Find"
          />
        </Tooltip>
        {!readOnly && (
          <Tooltip title={<ShortcutHintTitle label={REPLACE_SHORTCUT}>Replace</ShortcutHintTitle>} placement="top">
            <Button
              size="small"
              type="text"
              icon={<SwapOutlined />}
              onClick={() => runEditorAction('editor.action.startFindReplaceAction')}
              aria-label="Replace"
            />
          </Tooltip>
        )}
        {!readOnly && formattable && (
          <Tooltip title={formatTooltip} placement="top">
            <Button
              size="small"
              type="text"
              icon={<AlignLeftOutlined />}
              onClick={() => void runFormat()}
              aria-label="Format code"
            />
          </Tooltip>
        )}
      </div>
      {/* Grip strip — reserved row below the editor so Monaco's vertical
          scrollbar (which spans only the Editor element) ends above the
          grip instead of sharing its corner. Fill mode sizes from the
          pane, so there is nothing to drag. */}
      {!fill && (
        <div style={{ height: 12, position: 'relative' }} aria-hidden="true">
          <div
            className="rules-code-editor-resize-grip"
            onPointerDown={handleGripPointerDown}
            onPointerMove={handleGripPointerMove}
            onPointerUp={handleGripPointerUp}
            onDoubleClick={() => setManualHeight(null)}
          />
        </div>
      )}
      {jwtModal}
    </div>
  );
};

export default CodeEditor;
