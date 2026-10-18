// @vitest-environment jsdom
/**
 * The hover readout over a Monaco buffer — `useMonacoRefHover` opening
 * the shared variable popover for the `{{ref}}` under the pointer,
 * anchored on the span the decoration plane painted; and `findRefAt`,
 * its lookup from a line and a column.
 *
 * Contract: a move onto a painted ref opens the popover once with the
 * reference read from the buffer; a move within it never reopens; a
 * move off it schedules the host's grace close; leaving the editor
 * hands the host the element the pointer entered; the ref under the
 * caret (editing) opens nothing; an edit closes the popover at once.
 */

import { findRefAt } from '@openheaders/ui/workbench/components/template-input/monaco/monaco-ref-decorations';
import { useMonacoRefHover } from '@openheaders/ui/workbench/components/template-input/monaco/use-monaco-ref-hover';
import { act, cleanup, render } from '@testing-library/react';
import type * as monaco from 'monaco-editor';
import { useMemo, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const host = { open: vi.fn(), scheduleClose: vi.fn(), cancelClose: vi.fn(), closeNow: vi.fn() };

// The real host's api changes identity whenever its open state does
// (its `open` closes over the state) — the fake does the same, so a
// hook that keys an effect on the api loses its session on open.
vi.mock('@openheaders/ui/workbench/components/template-input/VariablePopoverHost', () => ({
  useVariablePopover: () => {
    const [version, setVersion] = useState(0);
    return useMemo(
      () => ({
        open: (...args: unknown[]) => {
          host.open(...args);
          setVersion((v) => v + 1);
        },
        scheduleClose: host.scheduleClose,
        cancelClose: host.cancelClose,
        closeNow: host.closeNow,
        version,
      }),
      [version],
    );
  },
  VariablePopoverProvider: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => {
  for (const fn of Object.values(host)) fn.mockClear();
});
afterEach(cleanup);

describe('findRefAt', () => {
  const line = '{ "a": "{{env.A}}", "b": "{{vault.B}}" }';

  it('returns the reference covering the column', () => {
    expect(findRefAt(line, 9)).toEqual({ inner: 'env.A', startColumn: 9, endColumn: 18 });
    expect(findRefAt(line, 17)).toEqual({ inner: 'env.A', startColumn: 9, endColumn: 18 });
    expect(findRefAt(line, 30)).toEqual({ inner: 'vault.B', startColumn: 27, endColumn: 38 });
  });

  it('returns null between and after references', () => {
    expect(findRefAt(line, 18)).toBeNull();
    expect(findRefAt(line, 3)).toBeNull();
    expect(findRefAt(line, 40)).toBeNull();
    expect(findRefAt('plain', 2)).toBeNull();
  });
});

type Listener<T> = (e: T) => void;

class Emitter<T> {
  private readonly listeners = new Set<Listener<T>>();
  readonly on = (listener: Listener<T>) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire(e: T): void {
    for (const listener of this.listeners) listener(e);
  }
}

interface FakeMouseEvent {
  target: { element: HTMLElement | null; position: { lineNumber: number; column: number } | null };
  event: { browserEvent: { relatedTarget: EventTarget | null } };
}

function span(editing = false): HTMLElement {
  const el = document.createElement('span');
  el.className = `mtk1 oh-monaco-ref oh-monaco-ref-${editing ? 'editing' : 'resolved'}`;
  return el;
}

function fakeEditor(line: string) {
  const move = new Emitter<FakeMouseEvent>();
  const leave = new Emitter<FakeMouseEvent>();
  const content = new Emitter<void>();
  const updateOptions = vi.fn();
  const api = {
    getModel: () => ({ getLineContent: () => line }),
    getRawOptions: () => ({ hover: { above: false } }),
    updateOptions,
    onMouseMove: move.on,
    onMouseLeave: leave.on,
    onDidChangeModelContent: content.on,
  };
  return {
    editor: api as unknown as monaco.editor.IStandaloneCodeEditor,
    updateOptions,
    moveOver(element: HTMLElement | null, column: number) {
      move.fire({
        target: { element, position: { lineNumber: 1, column } },
        event: { browserEvent: { relatedTarget: null } },
      });
    },
    leaveTo(relatedTarget: EventTarget | null) {
      leave.fire({ target: { element: null, position: null }, event: { browserEvent: { relatedTarget } } });
    },
    edit: () => content.fire(),
  };
}

function Harness({ editor }: { editor: monaco.editor.IStandaloneCodeEditor }) {
  useMonacoRefHover(editor, { enabled: true, context: { collectionId: 'col-1' } });
  return null;
}

const LINE = '{ "a": "{{env.A}}", "b": "{{vault.B}}" }';

describe('useMonacoRefHover', () => {
  it('opens the popover once for the reference under the pointer, anchored on its span', () => {
    const fake = fakeEditor(LINE);
    render(<Harness editor={fake.editor} />);
    const el = span();
    act(() => fake.moveOver(el, 12));
    act(() => fake.moveOver(el, 14));
    expect(host.open).toHaveBeenCalledTimes(1);
    expect(host.open).toHaveBeenCalledWith({ anchorEl: el, reference: 'env.A', collectionId: 'col-1' });
  });

  it('a move onto another reference opens that one', () => {
    const fake = fakeEditor(LINE);
    render(<Harness editor={fake.editor} />);
    act(() => fake.moveOver(span(), 12));
    act(() => fake.moveOver(span(), 30));
    expect(host.open).toHaveBeenCalledTimes(2);
    expect(host.open.mock.calls[1][0]).toMatchObject({ reference: 'vault.B' });
  });

  it('a move off the reference schedules the grace close', () => {
    const fake = fakeEditor(LINE);
    render(<Harness editor={fake.editor} />);
    act(() => fake.moveOver(span(), 12));
    act(() => fake.moveOver(document.createElement('span'), 3));
    expect(host.scheduleClose).toHaveBeenCalledTimes(1);
    act(() => fake.moveOver(document.createElement('span'), 4));
    expect(host.scheduleClose).toHaveBeenCalledTimes(1);
  });

  it('leaving the editor hands the host the element the pointer entered', () => {
    const fake = fakeEditor(LINE);
    render(<Harness editor={fake.editor} />);
    act(() => fake.moveOver(span(), 12));
    const popover = document.createElement('div');
    act(() => fake.leaveTo(popover));
    expect(host.scheduleClose).toHaveBeenCalledWith(popover);
  });

  it("pauses Monaco's own hover over a reference and restores the host's setting on leaving", () => {
    const fake = fakeEditor(LINE);
    render(<Harness editor={fake.editor} />);
    expect(fake.updateOptions).not.toHaveBeenCalled();
    act(() => fake.moveOver(span(), 12));
    act(() => fake.moveOver(span(), 14));
    expect(fake.updateOptions).toHaveBeenCalledTimes(1);
    expect(fake.updateOptions).toHaveBeenLastCalledWith({ hover: { enabled: false } });
    act(() => fake.moveOver(document.createElement('span'), 3));
    expect(fake.updateOptions).toHaveBeenCalledTimes(2);
    expect(fake.updateOptions).toHaveBeenLastCalledWith({ hover: { above: false } });
    act(() => fake.moveOver(document.createElement('span'), 4));
    expect(fake.updateOptions).toHaveBeenCalledTimes(2);
  });

  it('an edit while over a reference restores the native hover too', () => {
    const fake = fakeEditor(LINE);
    render(<Harness editor={fake.editor} />);
    act(() => fake.moveOver(span(), 12));
    act(() => fake.edit());
    expect(fake.updateOptions).toHaveBeenLastCalledWith({ hover: { above: false } });
  });

  it('the reference under the caret opens nothing', () => {
    const fake = fakeEditor(LINE);
    render(<Harness editor={fake.editor} />);
    act(() => fake.moveOver(span(true), 12));
    expect(host.open).not.toHaveBeenCalled();
  });

  it('an edit closes the popover at once', () => {
    const fake = fakeEditor(LINE);
    render(<Harness editor={fake.editor} />);
    act(() => fake.moveOver(span(), 12));
    act(() => fake.edit());
    expect(host.closeNow).toHaveBeenCalledTimes(1);
    act(() => fake.edit());
    expect(host.closeNow).toHaveBeenCalledTimes(1);
  });
});
