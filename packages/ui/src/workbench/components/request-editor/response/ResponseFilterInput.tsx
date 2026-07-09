/**
 * ResponseFilterInput — single-line Monaco input for the body Filter
 * bar. Monaco (rather than a plain input) buys the same suggest widget
 * the script editors use: contextual path completions appear as a
 * proper IntelliSense list, triggered by separators and plain typing.
 *
 * The completion provider is registered per mount on a dedicated
 * language id and guarded by model identity, so multiple open request
 * editors never cross-feed suggestions.
 */

import { FilterOutlined } from '@ant-design/icons';
import Editor, { type Monaco } from '@monaco-editor/react';
import { useUiTheme } from '@openheaders/ui/context';
import { theme } from 'antd';
import type * as monaco from 'monaco-editor';
import type React from 'react';
import { useEffect, useRef } from 'react';
import '../../monaco/bootstrap';

const FILTER_LANGUAGE = 'oh-path-filter';

/** A suggestion ending in a separator descends further — accepting it
 *  re-opens the lookahead for the next level. */
const CONTINUES_PATH = /[/.[]$/;

/** The segment a suggestion appends — what the list shows as its label
 *  (the full path is the insert text, minus any trailing separator). */
function suggestionLabel(path: string): string {
  const p = path.replace(/[/.[]+$/, '');
  const cut = Math.max(p.lastIndexOf('.'), p.lastIndexOf('/'));
  const bracket = p.lastIndexOf('[');
  if (bracket > cut) return p.slice(bracket);
  return cut === -1 ? p : p.slice(cut + 1);
}

interface ResponseFilterInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  hasError: boolean;
  /** Contextual completions for the current query — full replacement
   *  strings (see `response-filter.ts`). */
  getSuggestions: (query: string) => string[];
}

const ResponseFilterInput: React.FC<ResponseFilterInputProps> = ({
  value,
  onChange,
  placeholder,
  hasError,
  getSuggestions,
}) => {
  const { token } = theme.useToken();
  const { monacoTheme } = useUiTheme();
  const suggestRef = useRef(getSuggestions);
  suggestRef.current = getSuggestions;
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const providerRef = useRef<monaco.IDisposable | null>(null);

  useEffect(() => () => providerRef.current?.dispose(), []);

  const options: monaco.editor.IStandaloneEditorConstructionOptions = {
    lineNumbers: 'off',
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 0,
    lineNumbersMinChars: 0,
    renderLineHighlight: 'none',
    scrollbar: { vertical: 'hidden', horizontal: 'hidden', handleMouseWheel: false, alwaysConsumeMouseWheel: false },
    overviewRulerLanes: 0,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    minimap: { enabled: false },
    wordWrap: 'off',
    scrollBeyondLastLine: false,
    scrollBeyondLastColumn: 2,
    contextmenu: false,
    fontSize: 12,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    matchBrackets: 'never',
    occurrencesHighlight: 'off',
    selectionHighlight: false,
    // The container is one line tall — the suggest widget must render
    // in a fixed overlay or it would clip at the input's edge.
    fixedOverflowWidgets: true,
    quickSuggestions: { other: true, comments: false, strings: true },
    suggestOnTriggerCharacters: true,
    wordBasedSuggestions: 'off',
    snippetSuggestions: 'none',
    acceptSuggestionOnEnter: 'on',
    placeholder,
  };

  const handleMount = (editor: monaco.editor.IStandaloneCodeEditor, monacoApi: Monaco) => {
    editorRef.current = editor;
    if (!monacoApi.languages.getLanguages().some((l: monaco.languages.ILanguageExtensionPoint) => l.id === FILTER_LANGUAGE)) {
      monacoApi.languages.register({ id: FILTER_LANGUAGE });
    }
    providerRef.current = monacoApi.languages.registerCompletionItemProvider(FILTER_LANGUAGE, {
      triggerCharacters: ['.', '[', '/', "'", '"'],
      provideCompletionItems: (model: monaco.editor.ITextModel) => {
        if (model !== editorRef.current?.getModel()) return { suggestions: [] };
        const query = model.getValue();
        const range = new monacoApi.Range(1, 1, 1, model.getLineMaxColumn(1));
        return {
          suggestions: suggestRef.current(query).map((path, i) => ({
            label: suggestionLabel(path),
            detail: path,
            kind: monacoApi.languages.CompletionItemKind.Field,
            insertText: path,
            // The insert replaces the whole line; matching against the
            // typed text keeps Monaco's word filter from hiding items.
            filterText: query,
            sortText: String(i).padStart(4, '0'),
            range,
            // Descending suggestions end in a separator — accepting one
            // immediately surfaces the next level's lookahead.
            command: CONTINUES_PATH.test(path)
              ? { id: 'editor.action.triggerSuggest', title: 'Continue path' }
              : undefined,
          })),
        };
      },
    });
    // One line only — swallow Enter outside the suggest widget.
    editor.addCommand(monacoApi.KeyCode.Enter, () => {}, '!suggestWidgetVisible');
    // The bar just opened (or was clicked) — surface the lookahead
    // immediately instead of waiting for a keystroke.
    editor.onDidFocusEditorText(() => {
      editor.trigger('oh-filter', 'editor.action.triggerSuggest', {});
    });
    editor.focus();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px',
        border: `1px solid ${hasError ? token.colorError : token.colorBorder}`,
        borderRadius: 6,
        background: token.colorBgContainer,
      }}
    >
      <FilterOutlined style={{ color: token.colorTextTertiary, fontSize: 12, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, height: 18 }}>
        <Editor
          height={18}
          language={FILTER_LANGUAGE}
          theme={monacoTheme}
          value={value}
          onChange={(next) => onChange((next ?? '').replace(/[\r\n]/g, ''))}
          onMount={handleMount}
          options={options}
        />
      </div>
    </div>
  );
};

export default ResponseFilterInput;
