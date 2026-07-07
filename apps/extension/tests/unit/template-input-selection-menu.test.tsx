// @vitest-environment jsdom
/**
 * Selection context menu contract — right-clicking a TemplateInput
 * with a text selection opens the custom menu (Set as variable,
 * clipboard trio, Encode/Decode); a collapsed caret falls through to
 * the native menu. Menu actions do flat string surgery on the
 * controlled value via the offsets captured at contextmenu time.
 */

import { getSelectionOffsets } from '@openheaders/ui/workbench/components/template-input/caret';
import TemplateInput from '@openheaders/ui/workbench/components/template-input/TemplateInput';
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const writeText = vi.fn(() => Promise.resolve());
const readText = vi.fn(() => Promise.resolve('pasted'));

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText, readText },
    configurable: true,
  });
  if (typeof window.matchMedia === 'undefined') {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
});

afterEach(() => {
  cleanup();
  writeText.mockClear();
  readText.mockClear();
});

function selectRange(root: HTMLElement, start: number, end: number): void {
  // The editable renders plain text as a single text node.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const node = walker.nextNode();
  if (!node) throw new Error('editable has no text node');
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function renderInput(value: string, onChange = vi.fn()) {
  const { container } = render(<TemplateInput value={value} onChange={onChange} />);
  const editable = container.querySelector('.oh-template-input-editable') as HTMLElement;
  return { editable, onChange };
}

describe('getSelectionOffsets', () => {
  it('maps a DOM range to flat char offsets and returns null outside the root', () => {
    const { editable } = renderInput('hello world');
    selectRange(editable, 6, 11);
    expect(getSelectionOffsets(editable)).toEqual({ start: 6, end: 11 });

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    try {
      expect(getSelectionOffsets(outside)).toBeNull();
    } finally {
      outside.remove();
    }
  });
});

describe('TemplateInput selection context menu', () => {
  it('opens the custom menu on right-click over a selection', () => {
    const { editable } = renderInput('hello world');
    selectRange(editable, 0, 5);
    fireEvent.contextMenu(editable, { clientX: 40, clientY: 40 });
    expect(screen.getByText('Set as variable')).toBeTruthy();
    expect(screen.getByText('Cut')).toBeTruthy();
    expect(screen.getByText('Copy')).toBeTruthy();
    expect(screen.getByText('Paste')).toBeTruthy();
    expect(screen.getByText('EncodeURIComponent')).toBeTruthy();
    expect(screen.getByText('DecodeURIComponent')).toBeTruthy();
  });

  it('does not open without a selection (native menu falls through)', () => {
    const { editable } = renderInput('hello world');
    window.getSelection()?.removeAllRanges();
    fireEvent.contextMenu(editable, { clientX: 40, clientY: 40 });
    expect(screen.queryByText('Set as variable')).toBeNull();
  });

  it('Copy writes the selection to the clipboard without changing the value', () => {
    const { editable, onChange } = renderInput('hello world');
    selectRange(editable, 6, 11);
    fireEvent.contextMenu(editable, { clientX: 40, clientY: 40 });
    fireEvent.click(screen.getByText('Copy'));
    expect(writeText).toHaveBeenCalledWith('world');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Cut copies then removes the selection from the value', () => {
    const { editable, onChange } = renderInput('hello world');
    selectRange(editable, 5, 11);
    fireEvent.contextMenu(editable, { clientX: 40, clientY: 40 });
    fireEvent.click(screen.getByText('Cut'));
    expect(writeText).toHaveBeenCalledWith(' world');
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('EncodeURIComponent replaces the selection in place', () => {
    const { editable, onChange } = renderInput('q=a b&c');
    selectRange(editable, 2, 5);
    fireEvent.contextMenu(editable, { clientX: 40, clientY: 40 });
    fireEvent.click(screen.getByText('EncodeURIComponent'));
    expect(onChange).toHaveBeenCalledWith('q=a%20b&c');
  });

  it('DecodeURIComponent keeps the text unchanged on malformed input', () => {
    const { editable, onChange } = renderInput('bad %E0%A4%A');
    selectRange(editable, 4, 12);
    fireEvent.contextMenu(editable, { clientX: 40, clientY: 40 });
    fireEvent.click(screen.getByText('DecodeURIComponent'));
    expect(onChange).toHaveBeenCalledWith('bad %E0%A4%A');
  });
});
