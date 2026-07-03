// @vitest-environment jsdom
/**
 * TemplateInput chrome contract — `multiline resizable allowClear`
 * must render the always-visible-scrollbar surface (`--expanded`
 * class), the bottom-right resize grip, and the clear ✕ when a value
 * is present. The variable hover popover's value editor relies on this
 * exact prop combination to match the workbench form inputs.
 */

import TemplateInput from '@openheaders/ui/workbench/components/template-input/TemplateInput';
// Side-effect import — TemplateInput reads workbench settings via
// useSyncExternalStore.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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

afterEach(cleanup);

describe('TemplateInput — multiline resizable allowClear chrome', () => {
  it('renders the expanded surface, resize grip, and clear icon with a value', () => {
    const { container } = render(
      <TemplateInput value="Bearer {{env.TOKEN}}" onChange={vi.fn()} multiline resizable allowClear />,
    );
    expect(container.querySelector('.oh-template-input-editable--expanded')).not.toBeNull();
    expect(container.querySelector('.oh-template-input-resize-grip')).not.toBeNull();
    expect(container.querySelector('.oh-template-input-clear')).not.toBeNull();
  });

  it('hides the clear icon when the value is empty', () => {
    const { container } = render(<TemplateInput value="" onChange={vi.fn()} multiline resizable allowClear />);
    expect(container.querySelector('.oh-template-input-clear')).toBeNull();
  });

  it('clear icon empties the value and keeps focus in the field', () => {
    const onChange = vi.fn();
    const { container } = render(<TemplateInput value="abc" onChange={onChange} multiline resizable allowClear />);
    const clear = container.querySelector('.oh-template-input-clear');
    expect(clear).not.toBeNull();
    fireEvent.click(clear as Element);
    expect(onChange).toHaveBeenCalledWith('');
    expect(document.activeElement).toBe(container.querySelector('.oh-template-input-editable'));
  });
});
