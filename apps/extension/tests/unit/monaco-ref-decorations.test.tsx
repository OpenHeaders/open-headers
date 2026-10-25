// @vitest-environment jsdom
/**
 * `{{ref}}` decorations over a Monaco buffer — the pure walk
 * (`collectRefDecorations`) and the hook that paints it from a fake
 * editor's visible lines, caret and events.
 *
 * Contract: a closed reference wears resolved or unresolved from the
 * shared classifier; the one the caret sits inside wears editing, as
 * does the open `{{query` run; a classified reference also marks its
 * first and last character so a token-split run paints as one box;
 * only the lines in view are walked; the paint re-runs on edit,
 * scroll, layout and caret moves and clears on unmount.
 */

import { OH_API_REF_GRAMMAR } from '@openheaders/ui/workbench/components/script-editor/script-ref-grammar';
import {
  collectRefDecorations,
  refDecorationClass,
  toMonacoRefDecorations,
} from '@openheaders/ui/workbench/components/template-input/monaco/monaco-ref-decorations';
import { useMonacoRefDecorations } from '@openheaders/ui/workbench/components/template-input/monaco/use-monaco-ref-decorations';
// Side-effect import — the resolver readers ride workbench settings.
import '@openheaders/ui/workbench/settings/schema';
import { act, cleanup, render } from '@testing-library/react';
import type * as monaco from 'monaco-editor';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const classify = (inner: string) => (inner.startsWith('env.') ? 'resolved' : 'unresolved');

describe('collectRefDecorations', () => {
  it('classifies every closed reference on the visible lines', () => {
    const out = collectRefDecorations(
      [
        { lineNumber: 1, text: '{ "a": "{{env.A}}", "b": "{{vault.B}}" }' },
        { lineNumber: 2, text: 'plain' },
      ],
      null,
      classify,
    );
    expect(out).toEqual([
      { range: { startLineNumber: 1, startColumn: 9, endLineNumber: 1, endColumn: 18 }, state: 'resolved' },
      { range: { startLineNumber: 1, startColumn: 27, endLineNumber: 1, endColumn: 38 }, state: 'unresolved' },
    ]);
  });

  it('the reference the caret sits inside wears editing', () => {
    const out = collectRefDecorations(
      [{ lineNumber: 3, text: '{{env.A}} {{env.B}}' }],
      { lineNumber: 3, column: 5 },
      classify,
    );
    expect(out.map((d) => d.state)).toEqual(['editing', 'resolved']);
  });

  it('a caret on the braces themselves does not count as inside', () => {
    const out = collectRefDecorations([{ lineNumber: 1, text: '{{env.A}}' }], { lineNumber: 1, column: 1 }, classify);
    expect(out[0].state).toBe('resolved');
    const after = collectRefDecorations(
      [{ lineNumber: 1, text: '{{env.A}}' }],
      { lineNumber: 1, column: 10 },
      classify,
    );
    expect(after[0].state).toBe('resolved');
  });

  it('the open run being composed wears editing up to the caret', () => {
    const out = collectRefDecorations(
      [{ lineNumber: 1, text: '"x": {{env.A' }],
      { lineNumber: 1, column: 13 },
      classify,
    );
    expect(out).toEqual([
      { range: { startLineNumber: 1, startColumn: 6, endLineNumber: 1, endColumn: 13 }, state: 'editing' },
    ]);
  });

  it('an auto-closed run the caret sits in is one editing span, not two', () => {
    const out = collectRefDecorations([{ lineNumber: 1, text: '{{}}' }], { lineNumber: 1, column: 3 }, classify);
    expect(out).toHaveLength(1);
    expect(out[0].state).toBe('editing');
  });

  it('a caret on another line leaves the references classified', () => {
    const out = collectRefDecorations([{ lineNumber: 1, text: '{{env.A}}' }], { lineNumber: 2, column: 4 }, classify);
    expect(out[0].state).toBe('resolved');
  });
});

describe('refDecorationClass', () => {
  it('carries the shared class and the state', () => {
    expect(refDecorationClass('unresolved')).toBe('oh-monaco-ref oh-monaco-ref-unresolved');
  });
});

describe('toMonacoRefDecorations', () => {
  it('a classified reference wears its state over the range and marks its first and last character', () => {
    const range = { startLineNumber: 2, startColumn: 9, endLineNumber: 2, endColumn: 18 };
    expect(toMonacoRefDecorations([{ range, state: 'resolved' }])).toEqual([
      { range, options: { inlineClassName: 'oh-monaco-ref oh-monaco-ref-resolved' } },
      {
        range: { startLineNumber: 2, startColumn: 9, endLineNumber: 2, endColumn: 10 },
        options: { inlineClassName: 'oh-monaco-ref-start' },
      },
      {
        range: { startLineNumber: 2, startColumn: 17, endLineNumber: 2, endColumn: 18 },
        options: { inlineClassName: 'oh-monaco-ref-end' },
      },
    ]);
  });

  it('the editing state carries no edge marks', () => {
    const range = { startLineNumber: 1, startColumn: 6, endLineNumber: 1, endColumn: 13 };
    expect(toMonacoRefDecorations([{ range, state: 'editing' }])).toEqual([
      { range, options: { inlineClassName: 'oh-monaco-ref oh-monaco-ref-editing' } },
    ]);
  });
});

type Listener = () => void;

class Emitter {
  private readonly listeners = new Set<Listener>();
  readonly on = (listener: Listener) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire(): void {
    for (const listener of this.listeners) listener();
  }
}

interface SetDecoration {
  range: monaco.IRange;
  options: { inlineClassName: string };
}

function fakeEditor(lines: string[]) {
  let position = { lineNumber: 1, column: 1 };
  const cursor = new Emitter();
  const content = new Emitter();
  const scroll = new Emitter();
  const layout = new Emitter();
  const set = vi.fn<(decorations: SetDecoration[]) => void>();
  const clear = vi.fn();
  const api = {
    getModel: () => ({ getLineContent: (n: number) => lines[n - 1] }),
    getPosition: () => position,
    getVisibleRanges: () => [{ startLineNumber: 1, endLineNumber: lines.length }],
    createDecorationsCollection: () => ({ set, clear }),
    onDidChangeCursorPosition: cursor.on,
    onDidChangeModelContent: content.on,
    onDidScrollChange: scroll.on,
    onDidLayoutChange: layout.on,
  };
  return {
    editor: api as unknown as monaco.editor.IStandaloneCodeEditor,
    set,
    clear,
    last: () => set.mock.calls[set.mock.calls.length - 1][0],
    moveTo(lineNumber: number, column: number) {
      position = { lineNumber, column };
      cursor.fire();
    },
    edit(lineNumber: number, text: string) {
      lines[lineNumber - 1] = text;
      content.fire();
    },
    scroll: () => scroll.fire(),
  };
}

function Harness({ editor }: { editor: monaco.editor.IStandaloneCodeEditor }) {
  useMonacoRefDecorations(editor, { enabled: true });
  return null;
}

describe('useMonacoRefDecorations', () => {
  it('paints the visible references with the shared classifier at mount', () => {
    const fake = fakeEditor(['{ "id": "{{dynamic.uuid}}", "host": "{{env.NOPE}}" }']);
    render(<Harness editor={fake.editor} />);
    expect(fake.set).toHaveBeenCalledTimes(1);
    expect(fake.last().map((d) => d.options.inlineClassName)).toEqual([
      'oh-monaco-ref oh-monaco-ref-resolved',
      'oh-monaco-ref-start',
      'oh-monaco-ref-end',
      'oh-monaco-ref oh-monaco-ref-unresolved',
      'oh-monaco-ref-start',
      'oh-monaco-ref-end',
    ]);
  });

  it('repaints on caret moves so the reference under the caret wears editing', () => {
    const fake = fakeEditor(['"{{env.NOPE}}"']);
    render(<Harness editor={fake.editor} />);
    act(() => fake.moveTo(1, 5));
    expect(fake.last()[0].options.inlineClassName).toBe('oh-monaco-ref oh-monaco-ref-editing');
    act(() => fake.moveTo(1, 1));
    expect(fake.last()[0].options.inlineClassName).toBe('oh-monaco-ref oh-monaco-ref-unresolved');
  });

  it('repaints on edits and scrolls', () => {
    const fake = fakeEditor(['plain']);
    render(<Harness editor={fake.editor} />);
    expect(fake.last()).toEqual([]);
    act(() => fake.edit(1, 'x {{dynamic.timestamp}}'));
    expect(fake.last()).toHaveLength(3);
    const calls = fake.set.mock.calls.length;
    act(() => fake.scroll());
    expect(fake.set.mock.calls.length).toBe(calls + 1);
  });

  it('clears its decorations on unmount', () => {
    const fake = fakeEditor(['{{env.A}}']);
    const { unmount } = render(<Harness editor={fake.editor} />);
    unmount();
    expect(fake.clear).toHaveBeenCalled();
  });

  it('paints nothing while disabled', () => {
    const fake = fakeEditor(['{{env.A}}']);
    function Off({ editor }: { editor: monaco.editor.IStandaloneCodeEditor }) {
      useMonacoRefDecorations(editor, { enabled: false });
      return null;
    }
    render(<Off editor={fake.editor} />);
    expect(fake.set).not.toHaveBeenCalled();
  });
});

describe('collectRefDecorations under the script grammar', () => {
  it('dresses the lookup strings alone and leaves a bare {{ref}} in code unpainted', () => {
    const line = "const a = await oh.variables.get('env.A'); const b = '{{env.B}}'; await oh.vault.get('T');";
    const out = collectRefDecorations([{ lineNumber: 1, text: line }], null, classify, OH_API_REF_GRAMMAR);
    expect(out.map((d) => d.state)).toEqual(['resolved', 'unresolved']);
    expect(out[0].range.startColumn).toBe(line.indexOf("'") + 1);
  });

  it('the open string the caret composes wears editing from its quote', () => {
    const line = "oh.variables.get('')";
    const out = collectRefDecorations(
      [{ lineNumber: 1, text: line }],
      { lineNumber: 1, column: line.indexOf("'") + 2 },
      classify,
      OH_API_REF_GRAMMAR,
    );
    expect(out).toEqual([
      {
        range: {
          startLineNumber: 1,
          startColumn: line.indexOf("'") + 1,
          endLineNumber: 1,
          endColumn: line.indexOf("'") + 2,
        },
        state: 'editing',
      },
    ]);
  });
});
