/**
 * useDismiss Escape ownership.
 *
 * The dismiss listener runs capture-phase on window, so it sees Escape
 * BEFORE antd's own handlers. An OPEN select inside the surface must
 * keep the key — antd closes just the dropdown — otherwise one press
 * tears down the whole popover with the menu still up. A closed select
 * (no `.ant-select-open` on the root) dismisses the surface as before.
 */

import { claimEscape, useDismiss } from '@openheaders/ui/shared/popover';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function Harness({ onEscape }: { onEscape: () => void }) {
  useDismiss({ active: true, onEscape });
  return (
    <div>
      <div className="ant-select ant-select-open">
        <input aria-label="open-select" />
      </div>
      <div className="ant-select">
        <input aria-label="closed-select" />
      </div>
      <input aria-label="plain-input" />
    </div>
  );
}

describe('useDismiss Escape', () => {
  it('stands down when Escape originates inside an open select', () => {
    const onEscape = vi.fn();
    const { getByLabelText } = render(<Harness onEscape={onEscape} />);
    fireEvent.keyDown(getByLabelText('open-select'), { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('dismisses on Escape from a closed select', () => {
    const onEscape = vi.fn();
    const { getByLabelText } = render(<Harness onEscape={onEscape} />);
    fireEvent.keyDown(getByLabelText('closed-select'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('dismisses on Escape from any other element', () => {
    const onEscape = vi.fn();
    const { getByLabelText } = render(<Harness onEscape={onEscape} />);
    fireEvent.keyDown(getByLabelText('plain-input'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('yields to a later escape claim (nested layer owns the key)', () => {
    const onEscape = vi.fn();
    const { getByLabelText } = render(<Harness onEscape={onEscape} />);
    const claim = claimEscape();
    fireEvent.keyDown(getByLabelText('plain-input'), { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
    claim.release();
    fireEvent.keyDown(getByLabelText('plain-input'), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
