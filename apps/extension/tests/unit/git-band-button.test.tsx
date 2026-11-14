/**
 * `ToolbarIconButton` — a pane band's button that is unavailable is
 * `aria-disabled`, never natively disabled: a press often makes its own
 * button unavailable, and a natively disabled button drops the focus it
 * holds to the page (the tool window then reads as unfocused). It keeps
 * its focus and takes no press.
 */

import ToolbarIconButton from '@openheaders/ui/workbench/components/panels/git/toolbar/ToolbarIconButton';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const button = (): HTMLButtonElement => screen.getByTestId('band-button') as HTMLButtonElement;

describe('ToolbarIconButton', () => {
  it('takes a press while available', () => {
    const onClick = vi.fn();
    render(<ToolbarIconButton icon={<i />} title="Refresh" onClick={onClick} testid="band-button" tooltip={false} />);
    expect(button().getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(button());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is aria-disabled when unavailable — never natively — and takes no press', () => {
    const onClick = vi.fn();
    render(
      <ToolbarIconButton
        icon={<i />}
        title="Cherry-Pick"
        onClick={onClick}
        disabled
        testid="band-button"
        tooltip={false}
      />,
    );
    expect(button().getAttribute('aria-disabled')).toBe('true');
    expect(button().disabled).toBe(false);
    fireEvent.click(button());
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps the focus it holds when its own press makes it unavailable', () => {
    const view = render(<ToolbarIconButton icon={<i />} title="Cherry-Pick" testid="band-button" tooltip={false} />);
    button().focus();
    expect(document.activeElement).toBe(button());
    view.rerender(<ToolbarIconButton icon={<i />} title="Cherry-Pick" disabled testid="band-button" tooltip={false} />);
    expect(document.activeElement).toBe(button());
  });
});
