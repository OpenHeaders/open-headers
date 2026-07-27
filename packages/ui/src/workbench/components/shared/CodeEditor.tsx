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

import { useUiTheme } from '@openheaders/ui/context';
import Editor, { type Monaco } from '@monaco-editor/react';
import { Alert, theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type LanguageId, toMonacoLanguage } from '../../languages/registry';
import { resolveFontFamily } from '../../settings/schema/editor';
import { useSettingValue } from '../../settings/hooks';
// Side-effect import: kicks the Monaco bootstrap (loader.config + worker
// wiring + TS language-service setup + Prettier provider registration)
// at module-load time so it wins the race against `<Editor>`'s own
// `loader.init`.
import '../monaco/bootstrap';
import { ensureEditorKeybindingSync } from '../monaco/editor-keybindings';
import { useMonacoVariableCompletions } from '../template-input';
import { useMonacoJwtEdit } from '../value-editors';
import CodeEditorActions, { type CodeEditorActionsTarget, isFormattableLanguage } from './CodeEditorActions';

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
  /** When true, Monaco's link plane is on: web urls and provider links
   *  (e.g. the spec editor's `$ref` targets) render underlined with
   *  the "Follow link (cmd/ctrl+click)" affordance. Off by default —
   *  "Follow link" on urls in a request body/script adds nothing. */
  linkDetection?: boolean;
  /** Where the Find / Replace / Format cluster renders. `'corner'`
   *  (default) keeps the hover overlay inside the editor; `'external'`
   *  suppresses it — the host renders a `CodeEditorActions` in its own
   *  toolbar row, driven through `actionsRef`, so the buttons never
   *  cover the buffer's first lines. */
  actions?: 'corner' | 'external';
  /** Populated with the editor's imperative action surface — hand it
   *  to an externally-rendered `CodeEditorActions`. */
  actionsRef?: React.MutableRefObject<CodeEditorActionsTarget | null>;
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
  linkDetection = false,
  actions = 'corner',
  actionsRef,
}) => {
  const registerCompletions = useMonacoVariableCompletions();
  // Read-only buffers get the viewer wiring: "View JWT" hover link and a
  // no-write-back modal — same split as the panel's CodeViewer.
  const { attachJwtDetection, jwtModal } = useMonacoJwtEdit({ readOnly });
  const { token } = theme.useToken();
  const { monacoTheme } = useUiTheme();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  // Mounted-instance signal for effects that must attach editor
  // listeners — the ref alone can't re-run an effect at mount time.
  const [mountedEditor, setMountedEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);
  // Runtime monaco namespace, captured at mount — the module import is
  // type-only (the loader owns the runtime), but the EOL decorations
  // need its enums.
  const monacoApiRef = useRef<Monaco | null>(null);
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
  const renderLineEnds = useSettingValue('editor.renderLineEnds');
  const bracketPairColorization = useSettingValue('editor.bracketPairColorization');

  // EOL glyphs — a paint-only ¬ after each real line ending (Vim's
  // `listchars eol` convention; Monaco has no native equivalent). The
  // glyph rides an injected-text decoration: never part of the model,
  // never selectable, never copied. Only the VISIBLE ranges are
  // decorated, re-derived on scroll / edit / layout, so megabyte
  // read-only bodies never carry per-line decorations. The buffer's
  // final line ends without a newline, so it gets no glyph.
  useEffect(() => {
    const editor = mountedEditor;
    if (!editor || !renderLineEnds) return;
    const collection = editor.createDecorationsCollection();
    const cursorStops = monacoApiRef.current?.editor.InjectedTextCursorStops.None;
    const paint = () => {
      const model = editor.getModel();
      if (!model) {
        collection.clear();
        return;
      }
      const lastEol = model.getLineCount() - 1;
      const decorations: monaco.editor.IModelDeltaDecoration[] = [];
      for (const range of editor.getVisibleRanges()) {
        const last = Math.min(range.endLineNumber, lastEol);
        for (let line = range.startLineNumber; line <= last; line++) {
          const column = model.getLineMaxColumn(line);
          decorations.push({
            range: { startLineNumber: line, startColumn: column, endLineNumber: line, endColumn: column },
            // The range is collapsed (a caret position, not a span) —
            // without `showIfCollapsed` Monaco culls the decoration
            // and the injected glyph never paints. `cursorStops: None`
            // keeps the caret from treating the paint as a stop, so
            // arrowing across the line end feels glyph-free.
            options: {
              showIfCollapsed: true,
              after: {
                content: '¬',
                inlineClassName: 'oh-eol-glyph',
                ...(cursorStops !== undefined ? { cursorStops } : {}),
              },
            },
          });
        }
      }
      collection.set(decorations);
    };
    paint();
    const subscriptions = [
      editor.onDidScrollChange(paint),
      editor.onDidChangeModelContent(paint),
      editor.onDidLayoutChange(paint),
    ];
    return () => {
      for (const subscription of subscriptions) subscription.dispose();
      collection.clear();
    };
  }, [mountedEditor, renderLineEnds]);

  // Whether a `DocumentFormattingEditProvider` is registered for the
  // language — single source of truth for "is this buffer
  // formattable?". JSON / CSS / HTML have Monaco's built-ins; JS / XML
  // are registered by `registerPrettierFormatters`. Unregistered
  // languages (text, graphql) return false → button stays hidden.
  const formattable = isFormattableLanguage(language);

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

  // Imperative surface for the action cluster — the corner overlay and
  // any externally-rendered `CodeEditorActions` both drive the editor
  // through it. Refreshed every render (same pattern as `valueRef`).
  const actionsTargetRef = useRef<CodeEditorActionsTarget | null>(null);
  const actionsTarget: CodeEditorActionsTarget = {
    find: () => runEditorAction('actions.find'),
    replace: () => runEditorAction('editor.action.startFindReplaceAction'),
    format: () => void runFormatRef.current(),
  };
  actionsTargetRef.current = actionsTarget;
  if (actionsRef) actionsRef.current = actionsTarget;

  const options: monaco.editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    // Link plane off unless the host opts in (`linkDetection` — the
    // spec editor's `$ref` / url affordance). The JWT edit affordance
    // doesn't ride the link machinery (it's decoration-driven, see
    // value-editors), so it survives this being off.
    links: linkDetection,
    fontFamily,
    fontSize,
    fontLigatures,
    lineHeight,
    lineNumbers: lineNumbers ? 'on' : 'off',
    tabSize,
    insertSpaces,
    wordWrap: wordWrapOverride ?? (wordWrap === 'off' ? 'off' : wordWrap === 'bounded' ? 'bounded' : 'on'),
    // Soft-wrap legibility (the VS Code convention): a continuation
    // row indents one level PAST its logical line, so together with
    // its blank gutter number it reads as a wrap, never a new line.
    wrappingIndent: 'indent',
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
          monacoApiRef.current = monacoApi;
          setMountedEditor(ed);
          // Bind the configured find / replace / format chords from
          // the `keyboard.*` settings as page-global Monaco keybinding
          // rules (and keep them synced on rebind) — so Settings →
          // Keyboard rebinds change the actual key, not just the hint.
          ensureEditorKeybindingSync(monacoApi);
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
      {actions === 'corner' && (
        <div
          className="rules-code-editor-actions"
          style={{
            position: 'absolute',
            top: 6,
            right: 14,
            zIndex: 12,
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
          <CodeEditorActions target={actionsTargetRef} language={language} readOnly={readOnly} />
        </div>
      )}
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
