/**
 * SuggestionPopover hover-vs-keyboard selection.
 *
 * Keyboard scrolling shifts rows under a stationary pointer, and the
 * browser fires mouseenter/mouseleave for that shift — if hover selection
 * listened to mouseenter, arrow-nav would keep snapping the active index
 * back to whatever row sits under the mouse. Hover selection must react
 * only to real pointer motion (mousemove).
 */

import type { VariableSuggestion } from '@openheaders/core/variables';
import SuggestionPopover from '@openheaders/ui/workbench/components/template-input/SuggestionPopover';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function makeSuggestion(overrides: Partial<VariableSuggestion> = {}): VariableSuggestion {
  return {
    reference: 'env.API_HOST',
    scope: 'env',
    name: 'API_HOST',
    preview: { kind: 'value', value: 'https://api.openheaders.io', masked: false },
    priority: 0,
    ...overrides,
  };
}

const SUGGESTIONS: VariableSuggestion[] = [
  makeSuggestion(),
  makeSuggestion({ reference: 'env.API_TOKEN', name: 'API_TOKEN' }),
  makeSuggestion({ reference: 'workspace.base_url', scope: 'workspace', name: 'base_url' }),
];

describe('SuggestionPopover hover selection', () => {
  it('ignores mouseenter (fired by scroll under a stationary pointer)', () => {
    const onActiveIndexChange = vi.fn();
    const { getAllByRole } = render(
      <SuggestionPopover
        suggestions={SUGGESTIONS}
        activeIndex={0}
        onActiveIndexChange={onActiveIndexChange}
        onSelect={() => {}}
      />,
    );
    fireEvent.mouseEnter(getAllByRole('option')[1]);
    expect(onActiveIndexChange).not.toHaveBeenCalled();
  });

  it('selects on mousemove (real pointer motion)', () => {
    const onActiveIndexChange = vi.fn();
    const { getAllByRole } = render(
      <SuggestionPopover
        suggestions={SUGGESTIONS}
        activeIndex={0}
        onActiveIndexChange={onActiveIndexChange}
        onSelect={() => {}}
      />,
    );
    fireEvent.mouseMove(getAllByRole('option')[1]);
    expect(onActiveIndexChange).toHaveBeenCalledWith(1);
  });

  it('mousemove over the already-active row is a no-op', () => {
    const onActiveIndexChange = vi.fn();
    const { getAllByRole } = render(
      <SuggestionPopover
        suggestions={SUGGESTIONS}
        activeIndex={1}
        onActiveIndexChange={onActiveIndexChange}
        onSelect={() => {}}
      />,
    );
    fireEvent.mouseMove(getAllByRole('option')[1]);
    expect(onActiveIndexChange).not.toHaveBeenCalled();
  });
});
