// @vitest-environment jsdom
/**
 * The Monaco host of the variable picker — `useMonacoVariableSuggest`
 * reading a fake editor's caret and buffer, `MonacoSuggestOverlay`
 * painting the line inputs' list over it. The fake stands in for the
 * editor's events, position and edits; no Monaco worker runs.
 *
 * Contract: the list opens on `{{` and never on a lone `{`; the
 * arrows move the row and Enter / Tab write one edit that replaces
 * the run; a scaffold pick reopens the list narrowed; Escape closes
 * the run until the query changes; blur closes; a key outside an open
 * list passes through to Monaco; Monaco's own widget is told to hide;
 * a run naming a variable that does not exist offers to create it,
 * and Enter hands it to the shared create popover pinned.
 */

import MonacoSuggestOverlay from '@openheaders/ui/workbench/components/template-input/monaco/MonacoSuggestOverlay';
import { useMonacoVariableSuggest } from '@openheaders/ui/workbench/components/template-input/monaco/use-monaco-variable-suggest';
// Side-effect import — the hook reads workbench settings via
// useSyncExternalStore.
import '@openheaders/ui/workbench/settings/schema';
import { act, cleanup, render, screen } from '@testing-library/react';
import type * as monaco from 'monaco-editor';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const popoverOpen = vi.fn();

vi.mock('@openheaders/ui/workbench/components/template-input/VariablePopoverHost', () => ({
  useVariablePopover: () => ({
    open: popoverOpen,
    scheduleClose: vi.fn(),
    cancelClose: vi.fn(),
    closeNow: vi.fn(),
  }),
  VariablePopoverProvider: ({ children }: { children: React.ReactNode }) => children,
}));

beforeEach(() => popoverOpen.mockClear());
afterEach(cleanup);

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

interface FakeKeyEvent {
  browserEvent: { key: string };
  preventDefault: ReturnType<typeof vi.fn>;
  stopPropagation: ReturnType<typeof vi.fn>;
}

interface FakeEdit {
  range: monaco.IRange;
  text: string;
}

function fakeEditor(initialLine: string) {
  let line = initialLine;
  let position = { lineNumber: 1, column: initialLine.length + 1 };
  const cursor = new Emitter<void>();
  const content = new Emitter<void>();
  const blur = new Emitter<void>();
  const scroll = new Emitter<void>();
  const layout = new Emitter<void>();
  const keydown = new Emitter<FakeKeyEvent>();
  const executeEdits = vi.fn((_source: string, edits: FakeEdit[]) => {
    const [edit] = edits;
    line = `${line.slice(0, edit.range.startColumn - 1)}${edit.text}${line.slice(edit.range.endColumn - 1)}`;
    content.fire();
    return true;
  });
  const setPosition = vi.fn((next: { lineNumber: number; column: number }) => {
    position = { ...next };
    cursor.fire();
  });
  const trigger = vi.fn();
  const api = {
    getModel: () => ({ getLineContent: () => line }),
    getPosition: () => position,
    getSelection: () => ({ isEmpty: () => true }),
    hasTextFocus: () => true,
    getScrolledVisiblePosition: () => ({ top: 40, left: 120, height: 18 }),
    getDomNode: () => document.createElement('div'),
    onDidChangeCursorPosition: cursor.on,
    onDidChangeModelContent: content.on,
    onDidBlurEditorWidget: blur.on,
    onDidScrollChange: scroll.on,
    onDidLayoutChange: layout.on,
    onKeyDown: keydown.on,
    executeEdits,
    setPosition,
    focus: vi.fn(),
    trigger,
  };
  return {
    editor: api as unknown as monaco.editor.IStandaloneCodeEditor,
    executeEdits,
    setPosition,
    trigger,
    line: () => line,
    type(text: string) {
      line = `${line.slice(0, position.column - 1)}${text}${line.slice(position.column - 1)}`;
      position = { lineNumber: 1, column: position.column + text.length };
      content.fire();
      cursor.fire();
    },
    nudge() {
      cursor.fire();
    },
    blur() {
      blur.fire();
    },
    key(key: string): FakeKeyEvent {
      const e: FakeKeyEvent = { browserEvent: { key }, preventDefault: vi.fn(), stopPropagation: vi.fn() };
      keydown.fire(e);
      return e;
    },
  };
}

function Harness({ editor }: { editor: monaco.editor.IStandaloneCodeEditor }) {
  const suggest = useMonacoVariableSuggest(editor, { enabled: true });
  return (
    <MonacoSuggestOverlay
      anchor={suggest.anchor}
      suggestions={suggest.suggestions}
      activeIndex={suggest.activeIndex}
      onActiveIndexChange={suggest.setActiveIndex}
      onSelect={suggest.select}
      createTarget={suggest.createTarget}
      onCreate={suggest.triggerCreate}
    />
  );
}

function mount(initialLine = '{"id": ') {
  const fake = fakeEditor(initialLine);
  render(<Harness editor={fake.editor} />);
  return fake;
}

const options = () => screen.getAllByRole('option');

describe('useMonacoVariableSuggest', () => {
  it("opens the list on `{{`, leads with the dynamic scaffold, and hides Monaco's widget", () => {
    const fake = mount();
    expect(screen.queryByRole('listbox')).toBeNull();
    act(() => fake.type('{{'));
    expect(screen.getByRole('listbox')).not.toBeNull();
    expect(options()[0].textContent).toContain('dynamic.');
    expect(fake.trigger).toHaveBeenCalledWith('oh.variableSuggest', 'hideSuggestWidget', null);
  });

  it('hangs the popover below the opening brace', () => {
    const fake = mount();
    act(() => fake.type('{{'));
    const anchor = document.body.querySelector<HTMLElement>('.oh-template-popover-anchor');
    expect(anchor?.style.left).toBe('120px');
    expect(anchor?.style.top).toBe('62px');
  });

  it('never opens on a lone `{`', () => {
    const fake = mount();
    act(() => fake.type('{'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('moves the active row with the arrows and writes the pick as one edit on Enter', () => {
    const fake = mount();
    act(() => fake.type('{{'));
    act(() => {
      fake.key('ArrowDown');
    });
    expect(options()[1].getAttribute('aria-selected')).toBe('true');
    act(() => {
      fake.key('ArrowUp');
    });
    expect(options()[0].getAttribute('aria-selected')).toBe('true');
    act(() => {
      fake.key('Enter');
    });
    expect(fake.executeEdits).toHaveBeenCalledWith('oh.variableSuggest', [
      { range: { startLineNumber: 1, startColumn: 8, endLineNumber: 1, endColumn: 10 }, text: '{{dynamic.}}' },
    ]);
    expect(fake.line()).toBe('{"id": {{dynamic.}}');
  });

  it('consumes the keys it handles', () => {
    const fake = mount();
    act(() => fake.type('{{'));
    let e: FakeKeyEvent | undefined;
    act(() => {
      e = fake.key('ArrowDown');
    });
    expect(e?.preventDefault).toHaveBeenCalled();
    expect(e?.stopPropagation).toHaveBeenCalled();
  });

  it('a scaffold pick lands the caret after the dot and reopens the list narrowed to the scope', () => {
    const fake = mount();
    act(() => fake.type('{{'));
    act(() => {
      fake.key('Tab');
    });
    expect(fake.setPosition).toHaveBeenCalledWith({ lineNumber: 1, column: 18 });
    expect(screen.getByRole('listbox')).not.toBeNull();
    for (const row of options()) expect(row.textContent).toContain('dynamic.');
  });

  it('Escape closes the run and it stays closed until the query changes', () => {
    const fake = mount();
    act(() => fake.type('{{'));
    let e: FakeKeyEvent | undefined;
    act(() => {
      e = fake.key('Escape');
    });
    expect(e?.preventDefault).toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
    act(() => fake.nudge());
    expect(screen.queryByRole('listbox')).toBeNull();
    act(() => fake.type('e'));
    expect(screen.getByRole('listbox')).not.toBeNull();
  });

  it('blur closes the list', () => {
    const fake = mount();
    act(() => fake.type('{{'));
    act(() => fake.blur());
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('offers to create a scoped reference nothing matches, and Enter opens the create popover pinned', () => {
    const fake = mount();
    act(() => fake.type('{{vault.okay'));
    expect(screen.getByText('No matches')).not.toBeNull();
    expect(screen.getByText('Create “okay” variable in Vault')).not.toBeNull();
    let e: FakeKeyEvent | undefined;
    act(() => {
      e = fake.key('Enter');
    });
    expect(e?.preventDefault).toHaveBeenCalled();
    expect(popoverOpen).toHaveBeenCalledTimes(1);
    const [state, opts] = popoverOpen.mock.calls[0];
    expect(state).toMatchObject({ reference: 'vault.okay', autoFocus: true });
    expect(state.anchorEl).toBeInstanceOf(HTMLElement);
    expect(opts).toMatchObject({ pinned: true });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('passes keys through while the list is closed', () => {
    const fake = mount();
    let e: FakeKeyEvent | undefined;
    act(() => {
      e = fake.key('Enter');
    });
    expect(e?.preventDefault).not.toHaveBeenCalled();
    expect(e?.stopPropagation).not.toHaveBeenCalled();
  });
});
