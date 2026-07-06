/**
 * Markdown editing commands for a Monaco buffer. The formatting
 * toolbar buttons and the keyboard shortcuts (⌘B / ⌘I / ⌘K) both
 * funnel through these, so behavior is identical either way. Every
 * command goes through `executeEdits`, keeping each action a single
 * undo step.
 */

import type { Monaco } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';

export type MarkdownEditor = monaco.editor.ICodeEditor;

/** Wrap the selection in `marker` (e.g. `**`), or unwrap when the
 *  selection is already wrapped. Empty selection inserts a wrapped
 *  placeholder and selects it so the user types straight over it. */
export function toggleWrap(editor: MarkdownEditor, marker: string, placeholder: string): void {
  const model = editor.getModel();
  const sel = editor.getSelection();
  if (!model || !sel) return;
  const selected = model.getValueInRange(sel);
  if (selected.length >= marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
    editor.executeEdits('oh-markdown', [
      { range: sel, text: selected.slice(marker.length, selected.length - marker.length) },
    ]);
  } else {
    const content = selected || placeholder;
    editor.executeEdits('oh-markdown', [{ range: sel, text: `${marker}${content}${marker}` }]);
    selectInsertedRange(editor, sel, marker.length, content.length);
  }
  editor.focus();
}

/** Prefix every selected line, or strip the prefix when every line
 *  already carries it. `prefix` may be a function for ordered lists. */
export function toggleLinePrefix(editor: MarkdownEditor, prefix: string | ((index: number) => string)): void {
  const model = editor.getModel();
  const sel = editor.getSelection();
  if (!model || !sel) return;
  const lines: string[] = [];
  for (let l = sel.startLineNumber; l <= sel.endLineNumber; l++) lines.push(model.getLineContent(l));
  let next: string;
  if (typeof prefix === 'string' && lines.every((l) => l.startsWith(prefix))) {
    next = lines.map((l) => l.slice(prefix.length)).join('\n');
  } else {
    const makePrefix = typeof prefix === 'string' ? () => prefix : prefix;
    next = lines.map((l, i) => makePrefix(i) + l).join('\n');
  }
  editor.executeEdits('oh-markdown', [
    {
      range: {
        startLineNumber: sel.startLineNumber,
        startColumn: 1,
        endLineNumber: sel.endLineNumber,
        endColumn: model.getLineMaxColumn(sel.endLineNumber),
      },
      text: next,
    },
  ]);
  editor.focus();
}

/** Toggle a `## ` heading on the line the selection starts on; an
 *  existing heading of any level is stripped first. */
export function toggleHeading(editor: MarkdownEditor): void {
  const model = editor.getModel();
  const sel = editor.getSelection();
  if (!model || !sel) return;
  const line = sel.startLineNumber;
  const content = model.getLineContent(line);
  const stripped = content.replace(/^#{1,6}\s+/, '');
  const next = stripped === content ? `## ${content}` : stripped;
  editor.executeEdits('oh-markdown', [
    {
      range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: content.length + 1 },
      text: next,
    },
  ]);
  editor.focus();
}

/** Turn the selection into `[selection](url)` and select the `url`
 *  part so the user pastes the target immediately. */
export function insertLink(editor: MarkdownEditor): void {
  const model = editor.getModel();
  const sel = editor.getSelection();
  if (!model || !sel) return;
  const label = model.getValueInRange(sel) || 'link text';
  editor.executeEdits('oh-markdown', [{ range: sel, text: `[${label}](url)` }]);
  selectInsertedRange(editor, sel, label.length + 3, 3);
  editor.focus();
}

/** Wrap the selection in a fenced code block (or insert a fresh one)
 *  and select the content so it can be typed or pasted over. */
export function insertCodeBlock(editor: MarkdownEditor): void {
  const model = editor.getModel();
  const sel = editor.getSelection();
  if (!model || !sel) return;
  const content = model.getValueInRange(sel) || 'code';
  const lead = sel.startColumn > 1 ? '\n' : '';
  editor.executeEdits('oh-markdown', [{ range: sel, text: `${lead}\`\`\`\n${content}\n\`\`\`\n` }]);
  selectInsertedRange(editor, sel, lead.length + 4, content.length);
  editor.focus();
}

/** Insert an empty two-column GFM table at the cursor. */
export function insertTable(editor: MarkdownEditor): void {
  const sel = editor.getSelection();
  if (!sel) return;
  const lead = sel.startColumn > 1 ? '\n' : '';
  const table = `${lead}| Column | Column |\n| ------ | ------ |\n|        |        |\n`;
  editor.executeEdits('oh-markdown', [{ range: sel, text: table }]);
  editor.focus();
}

/** Register ⌘/Ctrl+B (bold), ⌘/Ctrl+I (italic), ⌘/Ctrl+K (link) on a
 *  markdown buffer — the shortcuts every modern editor ships. */
export function registerMarkdownShortcuts(editor: monaco.editor.IStandaloneCodeEditor, monacoApi: Monaco): void {
  const bind = (id: string, label: string, keybinding: number, run: (ed: MarkdownEditor) => void) => {
    editor.addAction({ id, label, keybindings: [keybinding], run });
  };
  bind('oh-markdown-bold', 'Bold', monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KeyB, (ed) =>
    toggleWrap(ed, '**', 'bold'),
  );
  bind('oh-markdown-italic', 'Italic', monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KeyI, (ed) =>
    toggleWrap(ed, '*', 'italic'),
  );
  bind('oh-markdown-link', 'Insert link', monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KeyK, (ed) => insertLink(ed));
}

/** Select `length` characters starting `offsetFromStart` after the
 *  original selection start — how commands hand the caret to the part
 *  the user should type over next. */
function selectInsertedRange(
  editor: MarkdownEditor,
  original: monaco.Selection,
  offsetFromStart: number,
  length: number,
): void {
  const model = editor.getModel();
  if (!model) return;
  const base =
    model.getOffsetAt({ lineNumber: original.startLineNumber, column: original.startColumn }) + offsetFromStart;
  const start = model.getPositionAt(base);
  const end = model.getPositionAt(base + length);
  editor.setSelection({
    selectionStartLineNumber: start.lineNumber,
    selectionStartColumn: start.column,
    positionLineNumber: end.lineNumber,
    positionColumn: end.column,
  });
}
