// @vitest-environment jsdom
/**
 * The popover a `:name` token in the URL bar opens on hover — the
 * twin of the variable popover for a request field: the pill names
 * the segment, the field holds the row's value, the tag says what the
 * send does with the row as the DRAFT stands, Save writes the value
 * back through the bar by name and closes the session.
 */

import PathParamHoverPopover from '@openheaders/ui/workbench/components/template-input/PathParamHoverPopover';
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

function mount(value: string) {
  const anchor = document.createElement('span');
  document.body.appendChild(anchor);
  const onSave = vi.fn();
  const onClose = vi.fn();
  const utils = render(
    <PathParamHoverPopover anchorEl={anchor} name="id" value={value} onSave={onSave} onClose={onClose} />,
  );
  return { ...utils, onSave, onClose };
}

const field = (container: HTMLElement) => container.querySelector<HTMLElement>('[contenteditable="true"]')!;
const saveButton = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Save'))!;

describe('PathParamHoverPopover', () => {
  it('names the segment by its colon and reads a blank row as sent-as-written', () => {
    const { container } = mount('');
    expect(container.querySelector('[data-testid="oh-path-param-popover-pill"]')?.textContent).toBe(':id');
    expect(container.querySelector('[data-testid="oh-path-param-popover-state"]')?.textContent).toBe(
      'No value — the segment goes on the wire as written',
    );
    expect(saveButton(container).disabled).toBe(true);
  });

  it('a filled row reads as the segment replacement; the tag follows the draft', () => {
    const { container } = mount('42');
    expect(field(container).textContent).toBe('42');
    expect(container.querySelector('[data-testid="oh-path-param-popover-state"]')?.textContent).toBe(
      'Replaces the :name segment on send',
    );
    const editable = field(container);
    editable.textContent = '';
    fireEvent.input(editable);
    expect(container.querySelector('[data-testid="oh-path-param-popover-state"]')?.textContent).toBe(
      'No value — the segment goes on the wire as written',
    );
  });

  it('an unresolved reference inside the value reads as sent-as-written', () => {
    const { container } = mount('{{nope}}');
    expect(container.querySelector('[data-testid="oh-path-param-popover-state"]')?.textContent).toBe(
      'A reference inside has no value — sent as written',
    );
  });

  it('Save writes the typed value by name and closes; nothing to save keeps it disabled', () => {
    const { container, onSave, onClose } = mount('');
    const editable = field(container);
    editable.textContent = '7';
    fireEvent.input(editable);
    const save = saveButton(container);
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledWith('id', '7');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
