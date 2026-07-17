// @vitest-environment jsdom
/**
 * FormatAwareBodyEditor — the workbench's format-aware wrapper over the
 * static-body CodeEditor. Pins the view/wire split:
 *   - a minified wire value opens as its formatted view with Formatted
 *     selected;
 *   - a formatted-view edit emits the minified wire text, and reverting
 *     the view to the formatted baseline re-emits the ORIGINAL bytes
 *     (the verbatim short-circuit);
 *   - Raw mode shows the wire text and passes edits through verbatim;
 *     toggling back to Formatted picks up Raw-mode edits;
 *   - a body that doesn't tokenize as JSON opens Raw with the Formatted
 *     option disabled;
 *   - an external value change reseeds the view; the echo of the
 *     wrapper's own emission does not.
 *
 * The shared Monaco CodeEditor is mocked to a plain <textarea> — the
 * wrapper's contract is the wire string in/out, not Monaco itself.
 */

import FormatAwareBodyEditor from '@openheaders/ui/workbench/components/rule-fields/FormatAwareBodyEditor';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (next: string) => void }) => (
    <textarea data-testid="code-editor" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

afterEach(cleanup);

const WIRE = '{"a":1,"b":[2,3]}';
const FORMATTED = '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}';

const editor = () => screen.getByTestId('code-editor') as HTMLTextAreaElement;

/** Feeds emissions back as the value prop — the host Form.Item's role. */
function Harness({ initial, onWire }: { initial: string; onWire: (wire: string) => void }) {
  const [wire, setWire] = useState(initial);
  return (
    <FormatAwareBodyEditor
      value={wire}
      onChange={(next) => {
        setWire(next);
        onWire(next);
      }}
    />
  );
}

describe('FormatAwareBodyEditor — formatted view', () => {
  it('opens a minified wire value as its formatted view with Formatted selected', () => {
    render(<FormatAwareBodyEditor value={WIRE} onChange={vi.fn()} />);
    expect(editor().value).toBe(FORMATTED);
    expect(screen.getByRole('radio', { name: 'Formatted' })).toHaveProperty('checked', true);
  });

  it('emits the minified wire text for a formatted-view edit', () => {
    const onWire = vi.fn();
    render(<Harness initial={WIRE} onWire={onWire} />);
    fireEvent.change(editor(), { target: { value: '{\n  "a": 9,\n  "b": [\n    2,\n    3\n  ]\n}' } });
    expect(onWire).toHaveBeenLastCalledWith('{"a":9,"b":[2,3]}');
    expect(editor().value).toBe('{\n  "a": 9,\n  "b": [\n    2,\n    3\n  ]\n}');
  });

  it('reverting the view to the formatted baseline re-emits the original bytes', () => {
    const onWire = vi.fn();
    render(<Harness initial={WIRE} onWire={onWire} />);
    fireEvent.change(editor(), { target: { value: '{\n  "a": 9\n}' } });
    fireEvent.change(editor(), { target: { value: FORMATTED } });
    expect(onWire).toHaveBeenLastCalledWith(WIRE);
  });
});

describe('FormatAwareBodyEditor — raw view', () => {
  it('shows the wire text in Raw mode and passes edits through verbatim', () => {
    const onWire = vi.fn();
    render(<Harness initial={WIRE} onWire={onWire} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Raw' }));
    expect(editor().value).toBe(WIRE);
    fireEvent.change(editor(), { target: { value: '{"a":1 }' } });
    expect(onWire).toHaveBeenLastCalledWith('{"a":1 }');
  });

  it('toggling back to Formatted picks up Raw-mode edits', () => {
    render(<Harness initial={WIRE} onWire={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Raw' }));
    fireEvent.change(editor(), { target: { value: '{"c":true}' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Formatted' }));
    expect(editor().value).toBe('{\n  "c": true\n}');
  });

  it('opens Raw with the Formatted option disabled for a non-JSON body', () => {
    render(<FormatAwareBodyEditor value="<html>not json</html>" onChange={vi.fn()} />);
    expect(editor().value).toBe('<html>not json</html>');
    expect(screen.getByRole('radio', { name: 'Raw' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Formatted' })).toHaveProperty('disabled', true);
  });
});

describe('FormatAwareBodyEditor — external value changes', () => {
  it('reseeds the view when the value changes externally', () => {
    const { rerender } = render(<FormatAwareBodyEditor value={WIRE} onChange={vi.fn()} />);
    rerender(<FormatAwareBodyEditor value='{"z":0}' onChange={vi.fn()} />);
    expect(editor().value).toBe('{\n  "z": 0\n}');
  });

  it('does not reformat under an in-progress edit when its own emission echoes back', () => {
    const onWire = vi.fn();
    render(<Harness initial={WIRE} onWire={onWire} />);
    const midEdit = '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ';
    fireEvent.change(editor(), { target: { value: midEdit } });
    // The unclosed buffer doesn't tokenize — the wire emission is the
    // text as typed (fail open) and the view must stay exactly as typed.
    expect(onWire).toHaveBeenLastCalledWith(midEdit);
    expect(editor().value).toBe(midEdit);
  });
});
