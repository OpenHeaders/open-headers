// @vitest-environment jsdom
/**
 * TemplateInput → variable-popover host close wiring.
 *
 * A TemplateInput tells the shared hover-popover host to close when its
 * value changes (the re-render detaches the popover's anchor span). That
 * close is for fields the popover was opened FROM — the popover's own
 * value editor (a TemplateInput INSIDE `[data-variable-popover-root]`)
 * must never close its host: the effect also runs on mount, which killed
 * the popover as it opened (visible only when the pointer rested — a
 * moving pointer's re-hover revived it, hence the intermittent repro).
 */

import TemplateInput from '@openheaders/ui/workbench/components/template-input/TemplateInput';
// Side-effect import — TemplateInput reads workbench settings via
// useSyncExternalStore.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const closeNow = vi.fn();

vi.mock('@openheaders/ui/workbench/components/template-input/VariablePopoverHost', () => ({
  useVariablePopover: () => ({
    open: vi.fn(),
    scheduleClose: vi.fn(),
    cancelClose: vi.fn(),
    closeNow,
  }),
  VariablePopoverProvider: ({ children }: { children: React.ReactNode }) => children,
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

beforeEach(() => closeNow.mockClear());
afterEach(cleanup);

describe('TemplateInput host-close wiring', () => {
  it('a field inside the variable popover never closes its own host', () => {
    const { rerender } = render(
      <div data-variable-popover-root="">
        <TemplateInput value="secret-1" onChange={vi.fn()} multiline disableSuggestions />
      </div>,
    );
    expect(closeNow).not.toHaveBeenCalled();
    // Typing in the value editor (external value swap) must not close either.
    rerender(
      <div data-variable-popover-root="">
        <TemplateInput value="secret-12" onChange={vi.fn()} multiline disableSuggestions />
      </div>,
    );
    expect(closeNow).not.toHaveBeenCalled();
  });

  it('a launching field still closes the host when its value changes', () => {
    const { rerender } = render(<TemplateInput value="Bearer {{env.TOKEN}}" onChange={vi.fn()} />);
    closeNow.mockClear();
    rerender(<TemplateInput value="Bearer {{env.TOKEN}}x" onChange={vi.fn()} />);
    expect(closeNow).toHaveBeenCalled();
  });
});
