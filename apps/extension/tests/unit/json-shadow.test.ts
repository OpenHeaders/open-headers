/**
 * The JSON shadow — the mask that reads every `{{ref}}` as a value,
 * the incremental mirror that keeps the shadow the mask of the real
 * buffer after each content event, and the shadow's lifetime (created
 * from the real buffer's text, handed to the validator plane as the
 * stand-in, disposed with its lease).
 *
 * Contract: a mask keeps every length and every line break, so the
 * worker's positions map one to one; a reference inside a string
 * stays a string; the verbatim mirror plus the touched-line re-mask
 * equals the full mask after any edit the editor produces.
 */

import { attachJsonStandIn } from '@openheaders/ui/workbench/components/monaco/json-diagnostics';
import {
  createJsonShadow,
  JSON_SHADOW_SCHEME,
  type JsonShadowMonaco,
  type JsonShadowSource,
  jsonShadowUri,
  maskTemplateLine,
  maskTemplateText,
  remaskEdits,
  touchedLines,
} from '@openheaders/ui/workbench/components/template-input/monaco/json-shadow';
import type * as monaco from 'monaco-editor';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const leaseDispose = vi.fn();

vi.mock('@openheaders/ui/workbench/components/monaco/json-diagnostics', () => ({
  attachJsonStandIn: vi.fn(() => ({ dispose: leaseDispose })),
  JSON_LANGUAGE_ID: 'json',
}));

beforeEach(() => {
  vi.mocked(attachJsonStandIn).mockClear();
  leaseDispose.mockClear();
});

const LINE_BREAK = /\r\n|\r|\n/;

interface Edit {
  range: monaco.IRange;
  text: string;
}

/** A line buffer with Monaco's edit semantics: ranges in pre-edit
 *  coordinates, non-overlapping, line breaks in the text normalized to
 *  the buffer's EOL. */
class Buffer {
  lines: string[];
  constructor(
    text: string,
    public eol = '\n',
  ) {
    this.lines = text.split(LINE_BREAK);
  }
  getValue(): string {
    return this.lines.join(this.eol);
  }
  getLineCount(): number {
    return this.lines.length;
  }
  getLineContent(lineNumber: number): string {
    return this.lines[lineNumber - 1];
  }
  getLineMaxColumn(lineNumber: number): number {
    return this.lines[lineNumber - 1].length + 1;
  }
  applyEdits(edits: readonly Edit[]): void {
    const descending = [...edits].sort(
      (a, b) => b.range.startLineNumber - a.range.startLineNumber || b.range.startColumn - a.range.startColumn,
    );
    for (const { range, text } of descending) {
      const before = this.lines[range.startLineNumber - 1].slice(0, range.startColumn - 1);
      const after = this.lines[range.endLineNumber - 1].slice(range.endColumn - 1);
      this.lines.splice(
        range.startLineNumber - 1,
        range.endLineNumber - range.startLineNumber + 1,
        ...`${before}${text}${after}`.split(LINE_BREAK),
      );
    }
  }
}

function change(range: monaco.IRange, text: string): monaco.editor.IModelContentChange {
  return { range, text, rangeOffset: 0, rangeLength: 0 };
}

function range(startLine: number, startColumn: number, endLine = startLine, endColumn = startColumn): monaco.IRange {
  return { startLineNumber: startLine, startColumn, endLineNumber: endLine, endColumn };
}

/** Apply `changes` to the real buffer and mirror them into the shadow
 *  the way the shadow's content listener does. */
function mirror(real: Buffer, shadow: Buffer, changes: monaco.editor.IModelContentChange[]): void {
  real.applyEdits(changes);
  shadow.applyEdits(changes.map(({ range: r, text }) => ({ range: r, text })));
  shadow.applyEdits(remaskEdits(touchedLines(changes), real, shadow));
}

describe('maskTemplateLine', () => {
  it('replaces every reference form with a same-length run of 1 and leaves strings as strings', () => {
    const line = '{"a": {{env.x}}, "b": "{{x}}", "c": {{}}, "d": {{ spaced }}}';
    const masked = maskTemplateLine(line);
    expect(masked).toBe('{"a": 111111111, "b": "11111", "c": 1111, "d": 111111111111}');
    expect(masked.length).toBe(line.length);
  });

  it('masks adjacent references separately and leaves an unterminated run and a stray brace alone', () => {
    expect(maskTemplateLine('{{a}}{{b}}')).toBe('1111111111');
    expect(maskTemplateLine('"x": {{a')).toBe('"x": {{a');
    expect(maskTemplateLine('{{a}}}')).toBe('11111}');
  });

  it('counts tabs and astral characters as the buffer does — one 1 per UTF-16 unit', () => {
    expect(maskTemplateLine('{{a\tb}}')).toBe('1'.repeat('{{a\tb}}'.length));
    expect(maskTemplateLine('{{😀}}')).toBe('1'.repeat('{{😀}}'.length));
  });
});

describe('maskTemplateText', () => {
  it('keeps every line break as it was', () => {
    expect(maskTemplateText('{\r\n"a": {{x}}\r\n}')).toBe('{\r\n"a": 11111\r\n}');
    expect(maskTemplateText('{\n"a": {{x}}\n}')).toBe('{\n"a": 11111\n}');
    expect(maskTemplateText('{\r"a": {{x}}\r}')).toBe('{\r"a": 11111\r}');
  });

  it('never masks across a line break', () => {
    expect(maskTemplateText('{{a\nb}}')).toBe('{{a\nb}}');
  });
});

describe('touchedLines', () => {
  it('spans a change over the lines its text inserts', () => {
    expect(touchedLines([change(range(2, 3), 'x\ny\nz')])).toEqual([2, 3, 4]);
  });

  it('moves later changes by the line delta of the earlier ones, whatever the order given', () => {
    const changes = [change(range(3, 1), '}'), change(range(1, 2), 'a\nb')];
    expect(touchedLines(changes)).toEqual([1, 2, 4]);
    expect(touchedLines([...changes].reverse())).toEqual([1, 2, 4]);
  });

  it('collapses a deleted span onto its first line', () => {
    expect(touchedLines([change(range(2, 1, 3, 1), '')])).toEqual([2]);
  });
});

describe('the incremental mirror', () => {
  function shadowOf(real: Buffer): Buffer {
    return new Buffer(maskTemplateText(real.getValue()), real.eol);
  }

  it('masks a reference the moment its closing brace is typed and unmasks it when the brace goes', () => {
    const real = new Buffer('{\n  "a": {{x}\n}');
    const shadow = shadowOf(real);
    mirror(real, shadow, [change(range(2, 12), '}')]);
    expect(shadow.getValue()).toBe('{\n  "a": 11111\n}');
    expect(shadow.getValue()).toBe(maskTemplateText(real.getValue()));
    mirror(real, shadow, [change(range(2, 12, 2, 13), '')]);
    expect(shadow.getValue()).toBe('{\n  "a": {{x}\n}');
  });

  it('follows a multi-line paste holding references and strings', () => {
    const real = new Buffer('{\n  "a": 1\n}');
    const shadow = shadowOf(real);
    mirror(real, shadow, [change(range(2, 9), ',\n  "b": {{y}},\n  "c": "{{z}}"')]);
    expect(real.getValue()).toBe('{\n  "a": 1,\n  "b": {{y}},\n  "c": "{{z}}"\n}');
    expect(shadow.getValue()).toBe('{\n  "a": 1,\n  "b": 11111,\n  "c": "11111"\n}');
  });

  it('follows two cursors closing references on different lines', () => {
    const real = new Buffer('{\n  "a": {{x},\n  "b": {{y}\n}');
    const shadow = shadowOf(real);
    mirror(real, shadow, [change(range(3, 12), '}'), change(range(2, 12), '}')]);
    expect(shadow.getValue()).toBe('{\n  "a": 11111,\n  "b": 11111\n}');
  });

  it('follows a deleted line and a full replace', () => {
    const real = new Buffer('{\n  "a": {{x}},\n  "b": 2\n}');
    const shadow = shadowOf(real);
    mirror(real, shadow, [change(range(2, 1, 3, 1), '')]);
    expect(shadow.getValue()).toBe('{\n  "b": 2\n}');
    mirror(real, shadow, [change(range(1, 1, 3, 2), '["{{p}}", {{q}}]')]);
    expect(shadow.getValue()).toBe('["11111", 11111]');
  });

  it('keeps a CRLF buffer aligned', () => {
    const real = new Buffer('{\r\n  "a": 1\r\n}', '\r\n');
    const shadow = shadowOf(real);
    mirror(real, shadow, [change(range(2, 9), ',\r\n  "b": {{y}}')]);
    expect(shadow.getValue()).toBe('{\r\n  "a": 1,\r\n  "b": 11111\r\n}');
    expect(shadow.getLineCount()).toBe(real.getLineCount());
  });

  it('plans no edit for a touched line whose mask the shadow already holds', () => {
    const real = new Buffer('{\n  "a": 1\n}');
    const shadow = shadowOf(real);
    expect(remaskEdits([2], real, shadow)).toEqual([]);
  });
});

type Listener = (e: monaco.editor.IModelContentChangedEvent) => void;

function fakeUri(scheme: string, authority: string, path: string): monaco.Uri {
  return { scheme, authority, path, toString: () => `${scheme}://${authority}${path}` } as unknown as monaco.Uri;
}

function fakeMonaco() {
  const created: Array<{ value: string; language: string | undefined; uri: monaco.Uri | undefined; shadow: Buffer }> =
    [];
  const setEOL = vi.fn();
  const dispose = vi.fn();
  const api = {
    editor: {
      createModel: (value: string, language?: string, uri?: monaco.Uri) => {
        const shadow = new Buffer(value);
        created.push({ value, language, uri, shadow });
        return {
          uri,
          getLanguageId: () => language,
          getLineContent: (n: number) => shadow.getLineContent(n),
          getLineMaxColumn: (n: number) => shadow.getLineMaxColumn(n),
          getEOL: () => shadow.eol,
          setEOL,
          applyEdits: (edits: Edit[]) => shadow.applyEdits(edits),
          onDidChangeContent: () => ({ dispose: () => {} }),
          isDisposed: () => false,
          dispose,
        };
      },
      EndOfLineSequence: { LF: 0, CRLF: 1 },
    },
    Uri: { from: ({ scheme, path }: { scheme: string; path: string }) => fakeUri(scheme, '', path) },
  };
  return { api: api as unknown as JsonShadowMonaco, created, setEOL, dispose };
}

function fakeReal(text: string) {
  const buffer = new Buffer(text);
  const listeners = new Set<Listener>();
  const real = {
    uri: fakeUri('inmemory', 'model', '/3'),
    getValue: () => buffer.getValue(),
    getLanguageId: () => 'json',
    getLineContent: (n: number) => buffer.getLineContent(n),
    getLineMaxColumn: (n: number) => buffer.getLineMaxColumn(n),
    onDidChangeContent: (listener: Listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    isDisposed: () => false,
  };
  return {
    real: real as unknown as JsonShadowSource,
    edit(changes: monaco.editor.IModelContentChange[], eol = '\n') {
      buffer.applyEdits(changes);
      const event = {
        changes,
        eol,
        versionId: 2,
        isUndoing: false,
        isRedoing: false,
        isFlush: false,
        isEolChange: false,
      };
      for (const listener of listeners) listener(event as unknown as monaco.editor.IModelContentChangedEvent);
    },
    listenerCount: () => listeners.size,
  };
}

describe('jsonShadowUri', () => {
  it('derives one uri per real model under the shadow scheme', () => {
    const { api } = fakeMonaco();
    const uri = jsonShadowUri(api, fakeUri('inmemory', 'model', '/3'));
    expect(uri.scheme).toBe(JSON_SHADOW_SCHEME);
    expect(uri.path).toBe('/inmemory/model/3');
  });
});

describe('createJsonShadow', () => {
  it('creates a plaintext shadow of the masked text, attaches it as the stand-in, and mirrors edits', () => {
    const { api, created } = fakeMonaco();
    const { real, edit } = fakeReal('{\n  "a": {{x}\n}');
    createJsonShadow(api, real);
    expect(created).toHaveLength(1);
    expect(created[0].language).toBe('plaintext');
    expect(created[0].uri?.scheme).toBe(JSON_SHADOW_SCHEME);
    expect(created[0].value).toBe('{\n  "a": {{x}\n}');
    expect(vi.mocked(attachJsonStandIn)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(attachJsonStandIn).mock.calls[0][0]).toBe(real);
    edit([change(range(2, 12), '}')]);
    expect(created[0].shadow.getValue()).toBe('{\n  "a": 11111\n}');
  });

  it('follows the real buffer’s end-of-line change', () => {
    const { api, setEOL } = fakeMonaco();
    const { real, edit } = fakeReal('{\n}');
    createJsonShadow(api, real);
    edit([], '\r\n');
    expect(setEOL).toHaveBeenCalledWith(1);
  });

  it('disposes the listener, the lease and the shadow together', () => {
    const { api, dispose } = fakeMonaco();
    const { real, listenerCount } = fakeReal('{}');
    const shadow = createJsonShadow(api, real);
    expect(listenerCount()).toBe(1);
    shadow.dispose();
    expect(listenerCount()).toBe(0);
    expect(leaseDispose).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
