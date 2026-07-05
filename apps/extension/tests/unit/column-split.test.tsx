// @vitest-environment jsdom
/**
 * useColumnSplit contract — one shared boundary between the name and
 * value columns of an action-row list. A grip drag converts pointer X
 * travel into a flex-grow ratio measured against the grabbed row's two
 * cells; min widths clamp both directions; reset restores 50/50; a row
 * without a value cell (Remove op) has no boundary to move.
 */

import type { ColumnSplit } from '@openheaders/ui/workbench/components/rule-fields/use-column-split';
import { useColumnSplit } from '@openheaders/ui/workbench/components/rule-fields/use-column-split';
import type { GripResizeXEvent } from '@openheaders/ui/workbench/components/template-input/types';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

let split: ColumnSplit;

function Harness({ withRight = true }: { withRight?: boolean }) {
  split = useColumnSplit({ minLeft: 140, minRight: 120 });
  return (
    <div {...split.rowProps}>
      <div data-testid="left" {...split.leftCellProps} />
      {withRight && (
        <div data-testid="right" {...split.rightCellProps}>
          <div data-testid="grip" />
        </div>
      )}
      {!withRight && <div data-testid="grip" />}
    </div>
  );
}

function setup(withRight = true) {
  const utils = render(<Harness withRight={withRight} />);
  const left = utils.getByTestId('left');
  const grip = utils.getByTestId('grip');
  // jsdom lays out nothing — pin the cell widths the drag measures.
  Object.defineProperty(left, 'offsetWidth', { value: 400, configurable: true });
  if (withRight) {
    Object.defineProperty(utils.getByTestId('right'), 'offsetWidth', { value: 400, configurable: true });
  }
  const fire = (phase: GripResizeXEvent['phase'], deltaX = 0) =>
    act(() => split.onResizeX({ phase, deltaX, gripEl: grip }));
  return { utils, fire };
}

const growOf = (el: HTMLElement) => Number.parseFloat(el.style.flex);

afterEach(cleanup);

describe('useColumnSplit', () => {
  it('defaults to a 50/50 split', () => {
    const { utils } = setup();
    expect(growOf(utils.getByTestId('left'))).toBe(50);
    expect(growOf(utils.getByTestId('right'))).toBe(50);
  });

  it('converts drag travel into proportional flex weights', () => {
    const { utils, fire } = setup();
    fire('start');
    fire('move', 100); // 400 + 100 of an 800px pair → 62.5%
    expect(growOf(utils.getByTestId('left'))).toBe(62.5);
    expect(growOf(utils.getByTestId('right'))).toBe(37.5);
  });

  it('clamps at minLeft so the name column cannot be crushed', () => {
    const { utils, fire } = setup();
    fire('start');
    fire('move', -1000); // floor: 140 of 800 → 17.5%
    expect(growOf(utils.getByTestId('left'))).toBe(17.5);
  });

  it('clamps at minRight so the value column cannot be crushed', () => {
    const { utils, fire } = setup();
    fire('start');
    fire('move', 1000); // ceiling: (800 - 120) of 800 → 85%
    expect(growOf(utils.getByTestId('left'))).toBe(85);
  });

  it('double-click reset restores the default split', () => {
    const { utils, fire } = setup();
    fire('start');
    fire('move', 100);
    fire('end');
    fire('reset');
    expect(growOf(utils.getByTestId('left'))).toBe(50);
    expect(growOf(utils.getByTestId('right'))).toBe(50);
  });

  it('ignores moves after end and moves without a start', () => {
    const { utils, fire } = setup();
    fire('move', 100);
    expect(growOf(utils.getByTestId('left'))).toBe(50);
    fire('start');
    fire('end');
    fire('move', 100);
    expect(growOf(utils.getByTestId('left'))).toBe(50);
  });

  it('a row without a value cell has no boundary to move', () => {
    const { utils, fire } = setup(false);
    fire('start');
    fire('move', 100);
    expect(growOf(utils.getByTestId('left'))).toBe(50);
  });
});
