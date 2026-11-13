// @vitest-environment jsdom
/**
 * GitLogTextField — the log's text-or-hash field applies on Enter, the
 * reference's reading: typing filters nothing, Enter hands over what is
 * typed, the field's × clears the filter at once, and the applied text
 * leads the field when it changes from outside (a reset, a tab's own
 * restore).
 */

import GitLogTextField from '@openheaders/ui/workbench/components/panels/git/toolbar/GitLogTextField';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function mount(applied: string) {
  const onApply = vi.fn();
  const view = (text: string) => (
    <GitLogTextField
      applied={text}
      onApply={onApply}
      regex={false}
      onToggleRegex={() => undefined}
      matchCase={false}
      onToggleMatchCase={() => undefined}
      invalid={false}
    />
  );
  const { container, rerender } = render(view(applied));
  const field = screen.getByRole<HTMLInputElement>('textbox');
  return { onApply, field, container, show: (text: string) => rerender(view(text)) };
}

describe('GitLogTextField', () => {
  it('filters nothing while typing and applies what is typed on Enter', () => {
    const { onApply, field } = mount('');
    fireEvent.change(field, { target: { value: 'or' } });
    fireEvent.change(field, { target: { value: 'order' } });
    expect(field.value).toBe('order');
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenLastCalledWith('order');
  });

  it('applies an emptied field only on Enter, and the × at once', () => {
    const { onApply, field, container } = mount('order');
    expect(field.value).toBe('order');
    fireEvent.change(field, { target: { value: '' } });
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });
    expect(onApply).toHaveBeenLastCalledWith('');

    fireEvent.change(field, { target: { value: 'again' } });
    const clear = container.querySelector('.ant-input-clear-icon');
    if (clear === null) throw new Error('no clear control');
    fireEvent.click(clear);
    expect(onApply).toHaveBeenCalledTimes(2);
    expect(onApply).toHaveBeenLastCalledWith('');
  });

  it('shows the applied text when it changes from outside, over what was typed', () => {
    const { onApply, field, show } = mount('order');
    fireEvent.change(field, { target: { value: 'half typed' } });
    show('');
    expect(field.value).toBe('');
    show('main');
    expect(field.value).toBe('main');
    expect(onApply).not.toHaveBeenCalled();
  });
});
