import { isTextEntry, useDraftHistory } from '@openheaders/ui/workbench/components/live/use-draft-history';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Draft {
  name: string;
}

const START: Draft = { name: '' };

function mountField(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  const field = host.firstElementChild;
  if (!(field instanceof HTMLElement)) throw new Error('the field did not mount');
  return field;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-27T10:00:00Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('useDraftHistory — the user’s edits', () => {
  it('each edit made outside a field is an entry of its own, however fast', () => {
    const { result } = renderHook(() => useDraftHistory(() => START));

    act(() => result.current.edit({ name: 'a' }));
    act(() => result.current.edit({ name: 'b' }));
    expect(result.current.history.canUndo).toBe(true);
    expect(result.current.history.canRedo).toBe(false);

    act(() => result.current.history.undo());
    expect(result.current.draft).toEqual({ name: 'a' });
    act(() => result.current.history.undo());
    expect(result.current.draft).toBe(START);
    expect(result.current.history.canUndo).toBe(false);

    act(() => result.current.history.redo());
    act(() => result.current.history.redo());
    expect(result.current.draft).toEqual({ name: 'b' });
    expect(result.current.history.canRedo).toBe(false);
  });

  it('typing in one field is one entry until a pause', () => {
    const { result } = renderHook(() => useDraftHistory(() => START));
    mountField('<input type="text" />').focus();

    act(() => result.current.edit({ name: 'J' }));
    vi.advanceTimersByTime(200);
    act(() => result.current.edit({ name: 'Jo' }));
    vi.advanceTimersByTime(200);
    act(() => result.current.edit({ name: 'Joh' }));
    // A pause, then more typing: a second entry.
    vi.advanceTimersByTime(700);
    act(() => result.current.edit({ name: 'John' }));

    act(() => result.current.history.undo());
    expect(result.current.draft).toEqual({ name: 'Joh' });
    act(() => result.current.history.undo());
    expect(result.current.draft).toBe(START);
  });

  it('the pause counts from the last keystroke, not from the first', () => {
    const { result } = renderHook(() => useDraftHistory(() => START));
    mountField('<textarea></textarea>').focus();

    for (const name of ['J', 'Jo', 'Joh', 'John', 'John D']) {
      act(() => result.current.edit({ name }));
      vi.advanceTimersByTime(400);
    }

    act(() => result.current.history.undo());
    expect(result.current.draft).toBe(START);
  });

  it('typing in another field starts an entry', () => {
    const { result } = renderHook(() => useDraftHistory(() => START));
    const first = mountField('<input type="text" />');
    const second = mountField('<input type="text" />');

    first.focus();
    act(() => result.current.edit({ name: 'a' }));
    second.focus();
    act(() => result.current.edit({ name: 'ab' }));

    act(() => result.current.history.undo());
    expect(result.current.draft).toEqual({ name: 'a' });
  });

  it('typing after an undo starts an entry', () => {
    const { result } = renderHook(() => useDraftHistory(() => START));
    mountField('<input type="text" />').focus();

    act(() => result.current.edit({ name: 'a' }));
    act(() => result.current.edit({ name: 'ab' }));
    act(() => result.current.history.undo());
    act(() => result.current.edit({ name: 'x' }));
    act(() => result.current.edit({ name: 'xy' }));

    act(() => result.current.history.undo());
    expect(result.current.draft).toBe(START);
    expect(result.current.history.canUndo).toBe(false);
  });
});

describe('useDraftHistory — the draft replaced from outside', () => {
  it('empties the history', () => {
    const { result } = renderHook(() => useDraftHistory(() => START));
    act(() => result.current.edit({ name: 'a' }));
    act(() => result.current.edit({ name: 'b' }));
    act(() => result.current.history.undo());

    act(() => result.current.replace(() => ({ name: 'theirs' })));

    expect(result.current.draft).toEqual({ name: 'theirs' });
    expect(result.current.history.canUndo).toBe(false);
    expect(result.current.history.canRedo).toBe(false);
  });

  it('keeps the history when the draft comes back as it was', () => {
    const { result } = renderHook(() => useDraftHistory(() => START));
    act(() => result.current.edit({ name: 'a' }));

    act(() => result.current.replace((current) => current));

    expect(result.current.draft).toEqual({ name: 'a' });
    expect(result.current.history.canUndo).toBe(true);
  });
});

describe('isTextEntry', () => {
  it.each([
    ['a text input', '<input type="text" />', true],
    ['a number input', '<input type="number" />', true],
    ['a search input', '<input type="search" />', true],
    ['a text area', '<textarea></textarea>', true],
    ['a picker’s read-only input', '<input type="search" readonly />', false],
    ['a disabled input', '<input type="text" disabled />', false],
    ['a checkbox', '<input type="checkbox" />', false],
    ['a radio', '<input type="radio" />', false],
    ['a button', '<button type="button">Run</button>', false],
    ['a pane that takes focus', '<div tabindex="0"></div>', false],
  ])('%s', (_name, html, expected) => {
    expect(isTextEntry(mountField(html))).toBe(expected);
  });

  it('an element inside a code editor', () => {
    const editor = mountField('<div class="monaco-editor"><div class="native-edit-context"></div></div>');

    expect(isTextEntry(editor.firstElementChild)).toBe(true);
  });

  it('nothing focused', () => {
    expect(isTextEntry(null)).toBe(false);
  });
});
