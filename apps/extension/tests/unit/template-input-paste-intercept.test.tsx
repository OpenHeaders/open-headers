// @vitest-environment jsdom
/**
 * TemplateInput `onPasteIntercept` contract — the caller gets first
 * claim on a paste's plain text: returning true consumes it (nothing
 * lands in the field, onChange never fires), returning false lets the
 * paste proceed normally. The URL bar relies on this to route a pasted
 * curl command into the import flow while plain URLs paste through.
 */

import TemplateInput from '@openheaders/ui/workbench/components/template-input/TemplateInput';
// Side-effect import — TemplateInput reads workbench settings via
// useSyncExternalStore.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function paste(target: Element, text: string): void {
  fireEvent.paste(target, { clipboardData: { getData: () => text } });
}

function focusWithCaret(editable: HTMLElement): void {
  editable.focus();
  const range = document.createRange();
  range.selectNodeContents(editable);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

describe('TemplateInput — onPasteIntercept', () => {
  it('consumes the paste when the interceptor returns true', () => {
    const onChange = vi.fn();
    const intercept = vi.fn(() => true);
    const { container } = render(<TemplateInput value="" onChange={onChange} onPasteIntercept={intercept} />);
    const editable = container.querySelector('.oh-template-input-editable') as HTMLElement;
    focusWithCaret(editable);
    paste(editable, "curl 'https://api.openheaders.io/v1/ping'");
    expect(intercept).toHaveBeenCalledWith("curl 'https://api.openheaders.io/v1/ping'");
    expect(onChange).not.toHaveBeenCalled();
    expect(editable.textContent).toBe('');
  });

  it('pastes normally when the interceptor returns false', () => {
    const onChange = vi.fn();
    const { container } = render(<TemplateInput value="" onChange={onChange} onPasteIntercept={() => false} />);
    const editable = container.querySelector('.oh-template-input-editable') as HTMLElement;
    focusWithCaret(editable);
    paste(editable, 'https://api.openheaders.io/v1/ping');
    expect(onChange).toHaveBeenCalledWith('https://api.openheaders.io/v1/ping');
  });

  it('pastes normally without an interceptor', () => {
    const onChange = vi.fn();
    const { container } = render(<TemplateInput value="" onChange={onChange} />);
    const editable = container.querySelector('.oh-template-input-editable') as HTMLElement;
    focusWithCaret(editable);
    paste(editable, 'plain text');
    expect(onChange).toHaveBeenCalledWith('plain text');
  });
});
