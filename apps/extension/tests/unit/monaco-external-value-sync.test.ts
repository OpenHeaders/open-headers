/**
 * external-value-sync — the host-driven buffer update that keeps the
 * caret where the user left it: the minimal differing span, offsets
 * carried across it, read-only buffers taking the plain setValue.
 */

import {
  applyExternalValue,
  type ExternalValueEditor,
  type ExternalValueMonaco,
  minimalTextEdit,
  shiftOffsetAcrossEdit,
} from '@openheaders/ui/workbench/components/monaco/external-value-sync';
import type * as monaco from 'monaco-editor';
import { describe, expect, it } from 'vitest';

describe('minimalTextEdit', () => {
  it('returns null for equal texts', () => {
    expect(minimalTextEdit('abc', 'abc')).toBeNull();
  });

  it('isolates an insertion in the middle', () => {
    expect(minimalTextEdit('line one\nline two', 'line one!\nline two')).toEqual({ start: 8, end: 8, text: '!' });
  });

  it('isolates a deletion and a replacement', () => {
    expect(minimalTextEdit('abcdef', 'abef')).toEqual({ start: 2, end: 4, text: '' });
    expect(minimalTextEdit('abcdef', 'abXYef')).toEqual({ start: 2, end: 4, text: 'XY' });
  });

  it('never lets the prefix and suffix overlap on repeated characters', () => {
    expect(minimalTextEdit('aaa', 'aaaa')).toEqual({ start: 3, end: 3, text: 'a' });
    expect(minimalTextEdit('aaaa', 'aa')).toEqual({ start: 2, end: 4, text: '' });
  });
});

describe('shiftOffsetAcrossEdit', () => {
  const edit = { start: 4, end: 6, text: 'XYZ' };

  it('keeps offsets before the span', () => {
    expect(shiftOffsetAcrossEdit(2, edit)).toBe(2);
    expect(shiftOffsetAcrossEdit(4, edit)).toBe(4);
  });

  it('shifts offsets past the span by its growth', () => {
    expect(shiftOffsetAcrossEdit(6, edit)).toBe(7);
    expect(shiftOffsetAcrossEdit(10, edit)).toBe(11);
  });

  it('keeps an offset inside the span at its relative place, clamped', () => {
    expect(shiftOffsetAcrossEdit(5, edit)).toBe(5);
    expect(shiftOffsetAcrossEdit(5, { start: 4, end: 9, text: '' })).toBe(4);
  });
});

// ── A line/column text model over a string ──────────────────────────

class FakeModel {
  constructor(public text: string) {}
  getValue(): string {
    return this.text;
  }
  getOffsetAt(position: monaco.IPosition): number {
    const lines = this.text.split('\n');
    let offset = 0;
    for (let line = 1; line < position.lineNumber; line++) offset += lines[line - 1].length + 1;
    return offset + position.column - 1;
  }
  getPositionAt(offset: number): monaco.IPosition {
    const head = this.text.slice(0, offset);
    const lines = head.split('\n');
    return { lineNumber: lines.length, column: lines[lines.length - 1].length + 1 };
  }
}

class FakeSelection {
  constructor(
    public selectionStartLineNumber: number,
    public selectionStartColumn: number,
    public positionLineNumber: number,
    public positionColumn: number,
  ) {}
}

interface FakeEditor {
  model: FakeModel;
  selections: FakeSelection[];
  edits: Array<{ source: string; range: monaco.IRange; text: string }>;
  setValueCalls: string[];
  undoStops: number;
}

function fakeEditor(text: string, selections: FakeSelection[]): FakeEditor & ExternalValueEditor {
  const model = new FakeModel(text);
  const editor: FakeEditor & ExternalValueEditor = {
    model,
    selections,
    edits: [],
    setValueCalls: [],
    undoStops: 0,
    getModel: () => model as unknown as monaco.editor.ITextModel,
    getSelections: () => editor.selections as unknown as monaco.Selection[],
    executeEdits: (
      source: string,
      edits: monaco.editor.IIdentifiedSingleEditOperation[],
      endCursorState?: monaco.editor.ICursorStateComputer | monaco.Selection[],
    ) => {
      for (const edit of edits) {
        const start = model.getOffsetAt({ lineNumber: edit.range.startLineNumber, column: edit.range.startColumn });
        const end = model.getOffsetAt({ lineNumber: edit.range.endLineNumber, column: edit.range.endColumn });
        editor.edits.push({ source, range: edit.range, text: edit.text ?? '' });
        model.text = model.text.slice(0, start) + (edit.text ?? '') + model.text.slice(end);
      }
      if (typeof endCursorState === 'function') {
        editor.selections = (endCursorState([]) ?? []) as unknown as FakeSelection[];
      }
      return true;
    },
    pushUndoStop: () => {
      editor.undoStops++;
      return true;
    },
    setValue: (value: string) => {
      editor.setValueCalls.push(value);
      model.text = value;
    },
  };
  return editor;
}

const monacoApi = { Selection: FakeSelection } as unknown as ExternalValueMonaco;

describe('applyExternalValue', () => {
  it('leaves an agreeing buffer alone', () => {
    const editor = fakeEditor('one\ntwo', [new FakeSelection(1, 2, 1, 2)]);
    expect(applyExternalValue(editor, monacoApi, 'one\ntwo', false)).toBe(false);
    expect(editor.edits).toHaveLength(0);
    expect(editor.undoStops).toBe(0);
  });

  it('replaces only the changed span and keeps a caret before it in place', () => {
    const editor = fakeEditor('one\ntwo\nthree', [new FakeSelection(1, 3, 1, 3)]);
    expect(applyExternalValue(editor, monacoApi, 'one\ntwo\nthree!', false)).toBe(true);
    expect(editor.model.text).toBe('one\ntwo\nthree!');
    expect(editor.edits).toEqual([
      {
        source: 'external-value-sync',
        range: { startLineNumber: 3, startColumn: 6, endLineNumber: 3, endColumn: 6 },
        text: '!',
      },
    ]);
    expect(editor.selections).toEqual([new FakeSelection(1, 3, 1, 3)]);
    expect(editor.undoStops).toBe(1);
  });

  it('carries a caret past the span by the span growth', () => {
    const editor = fakeEditor('ab\ncd', [new FakeSelection(2, 2, 2, 2)]);
    applyExternalValue(editor, monacoApi, 'aXYb\ncd', false);
    expect(editor.model.text).toBe('aXYb\ncd');
    expect(editor.selections).toEqual([new FakeSelection(2, 2, 2, 2)]);
    const second = fakeEditor('ab\ncd', [new FakeSelection(1, 2, 1, 3)]);
    applyExternalValue(second, monacoApi, 'XYab\ncd', false);
    expect(second.selections).toEqual([new FakeSelection(1, 4, 1, 5)]);
  });

  it('never parks the caret at the end of a longer buffer', () => {
    const editor = fakeEditor('line 1\nline 2\nline 3', [new FakeSelection(2, 4, 2, 4)]);
    applyExternalValue(editor, monacoApi, 'line 1\nline 2\nline 3\nline 4', false);
    expect(editor.selections).toEqual([new FakeSelection(2, 4, 2, 4)]);
  });

  it('takes the plain setValue for a read-only buffer', () => {
    const editor = fakeEditor('old', [new FakeSelection(1, 1, 1, 1)]);
    expect(applyExternalValue(editor, monacoApi, 'new', true)).toBe(true);
    expect(editor.setValueCalls).toEqual(['new']);
    expect(editor.edits).toHaveLength(0);
  });
});
