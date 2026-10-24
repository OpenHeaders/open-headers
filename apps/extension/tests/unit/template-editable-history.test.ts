/**
 * TemplateInput undo/redo history — `editable-history`.
 *
 * The contentEditable re-renders innerHTML on every keystroke, which
 * destroys the browser's native undo stack; the component keeps its
 * own. Pin the rules that make it feel native: typing bursts coalesce
 * into one entry, boundaries (paste / suggestion insert / newline /
 * external swap) stand alone, a new edit after undo kills the redo
 * tail, and caret-only movement never mints entries.
 */

import { createEditableHistory } from '@openheaders/ui/workbench/components/template-input/editable-history';
import { type RefState, renderHighlightedHtml } from '@openheaders/ui/workbench/components/template-input/highlight';
import { describe, expect, it } from 'vitest';

function makeClock(start = 1000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('createEditableHistory — coalescing', () => {
  it('folds a fast typing burst into one entry', () => {
    const clock = makeClock();
    const h = createEditableHistory('', clock.now);
    h.record('a', 1);
    clock.advance(100);
    h.record('ab', 2);
    clock.advance(100);
    h.record('abc', 3);
    expect(h.undo()).toEqual({ text: '', caret: 0 });
    expect(h.undo()).toBeNull();
  });

  it('a pause starts a new entry', () => {
    const clock = makeClock();
    const h = createEditableHistory('', clock.now);
    h.record('a', 1);
    clock.advance(100);
    h.record('ab', 2);
    clock.advance(600);
    h.record('abc', 3);
    expect(h.undo()).toEqual({ text: 'ab', caret: 2 });
    expect(h.undo()).toEqual({ text: '', caret: 0 });
  });

  it('boundaries never coalesce, before or after', () => {
    const clock = makeClock();
    const h = createEditableHistory('', clock.now);
    h.record('a', 1);
    clock.advance(50);
    h.record('a pasted', 8, { boundary: true });
    clock.advance(50);
    h.record('a pasted!', 9);
    expect(h.undo()).toEqual({ text: 'a pasted', caret: 8 });
    expect(h.undo()).toEqual({ text: 'a', caret: 1 });
    expect(h.undo()).toEqual({ text: '', caret: 0 });
  });

  it('caret-only movement refreshes the entry instead of minting one', () => {
    const clock = makeClock();
    const h = createEditableHistory('abc', clock.now);
    h.record('abc', 1);
    expect(h.undo()).toBeNull();
  });
});

describe('createEditableHistory — undo/redo walk', () => {
  it('redo replays what undo stepped back', () => {
    const clock = makeClock();
    const h = createEditableHistory('', clock.now);
    h.record('a', 1);
    clock.advance(600);
    h.record('ab', 2);
    expect(h.undo()).toEqual({ text: 'a', caret: 1 });
    expect(h.redo()).toEqual({ text: 'ab', caret: 2 });
    expect(h.redo()).toBeNull();
  });

  it('a new edit after undo drops the redo tail', () => {
    const clock = makeClock();
    const h = createEditableHistory('', clock.now);
    h.record('a', 1);
    clock.advance(600);
    h.record('ab', 2);
    h.undo();
    h.record('ax', 2);
    expect(h.redo()).toBeNull();
    expect(h.undo()).toEqual({ text: 'a', caret: 1 });
  });

  it('typing right after undo starts a fresh entry (no coalesce into the restored one)', () => {
    const clock = makeClock();
    const h = createEditableHistory('', clock.now);
    h.record('a', 1);
    clock.advance(100);
    h.record('ab', 2);
    h.undo(); // back to the 'a'…'ab' burst start? — burst coalesced, so back to ''
    clock.advance(50);
    h.record('x', 1);
    expect(h.undo()).toEqual({ text: '', caret: 0 });
  });
});

describe('renderHighlightedHtml — trailing newline sentinel', () => {
  it('appends a <br> so the trailing empty line renders', () => {
    const classify = () => 'resolved' as const;
    expect(renderHighlightedHtml('abc\n', null, classify)).toBe('abc\n<br>');
    expect(renderHighlightedHtml('abc\ndef', null, classify)).toBe('abc\ndef');
    expect(renderHighlightedHtml('abc', null, classify)).toBe('abc');
  });
});

describe('renderHighlightedHtml — path parameter tokens', () => {
  const classify = (inner: string): RefState => (inner === 'ok' ? 'resolved' : 'unresolved');
  const classifyPath = (name: string): RefState => (name === 'id' ? 'resolved' : 'unresolved');
  const ref = (state: string, inner: string) =>
    `<span class="oh-template-ref oh-template-ref-${state}" data-ref="${inner}">{{${inner}}}</span>`;
  const path = (state: string, name: string) =>
    `<span class="oh-template-ref oh-template-ref-${state}" data-path-param="${name}">:${name}</span>`;

  it('leaves `:name` as plain text without a path classifier', () => {
    expect(renderHighlightedHtml('{{ok}}/users/:id', null, classify)).toBe(`${ref('resolved', 'ok')}/users/:id`);
  });

  it('paints each `:name` token by its row state beside the refs, suffix and query left as text', () => {
    expect(renderHighlightedHtml('{{ok}}/u/:id/f/:name.json?x=:y', null, classify, classifyPath)).toBe(
      `${ref('resolved', 'ok')}/u/${path('resolved', 'id')}/f/${path('unresolved', 'name')}.json?x=:y`,
    );
    expect(renderHighlightedHtml('http://localhost:8080/:id{{ext}}', null, classify, classifyPath)).toBe(
      `http://localhost:8080/${path('resolved', 'id')}${ref('unresolved', 'ext')}`,
    );
  });

  it('a path token reads live while the caret is inside it; a ref goes neutral until its braces close', () => {
    const value = '/u/:id';
    expect(renderHighlightedHtml(value, 6, classify, classifyPath)).toBe(`/u/${path('resolved', 'id')}`);
    expect(renderHighlightedHtml(value, 4, classify, classifyPath)).toBe(`/u/${path('resolved', 'id')}`);
    expect(renderHighlightedHtml('/u/:i', 5, classify, classifyPath)).toBe(`/u/${path('unresolved', 'i')}`);
    expect(renderHighlightedHtml('/{{ok}}', 4, classify, classifyPath)).toBe(`/${ref('editing', 'ok')}`);
    expect(renderHighlightedHtml('/{{ok}}', 7, classify, classifyPath)).toBe(`/${ref('resolved', 'ok')}`);
  });
});
