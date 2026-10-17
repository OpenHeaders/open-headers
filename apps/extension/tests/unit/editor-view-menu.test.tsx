// @vitest-environment jsdom
/**
 * EditorViewMenu — the compose toolbars' Editor dropdown: the last row
 * jumps to Settings › Editor › Code Editor under a shell that provides
 * `openSettings`, closing the popover; without a shell the row is gone.
 */

import EditorViewMenu from '@openheaders/ui/workbench/components/shared/EditorViewMenu';
import { OpenSettingsProvider } from '@openheaders/ui/workbench/hooks/OpenSettingsContext';
// Registers the editor.* settings the menu's toggles read.
import '@openheaders/ui/workbench/settings/schema/editor';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// antd's Dropdown measures through rc-resize-observer — jsdom has none.
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

function menuItem(label: string): HTMLElement | undefined {
  return screen
    .queryAllByText(label, { selector: '.ant-dropdown-menu-item *' })
    .find((el) => !el.closest('.ant-dropdown')?.classList.contains('ant-dropdown-hidden'));
}

describe('EditorViewMenu — Settings jump', () => {
  it('opens Settings at the Code Editor category and closes the menu', async () => {
    const openSettings = vi.fn();
    render(
      <OpenSettingsProvider openSettings={openSettings}>
        <EditorViewMenu wrap onWrapChange={() => {}} data-testid="editor-menu" />
      </OpenSettingsProvider>,
    );
    fireEvent.click(screen.getByTestId('editor-menu'));
    const row = menuItem('Settings');
    expect(row).toBeTruthy();
    expect(row?.closest('.ant-dropdown-menu-item')?.querySelector('.anticon-select')).toBeTruthy();
    fireEvent.click(row as HTMLElement);
    expect(openSettings).toHaveBeenCalledWith({ categoryId: 'codeEditor' });
    // jsdom runs no animations, so the popover shows its leave motion
    // (or is already hidden) rather than vanishing — either proves the
    // jump closed it.
    await waitFor(() => expect(row?.closest('.ant-dropdown')?.className).toMatch(/ant-dropdown-hidden|-leave\b/));
  });

  it('shows no Settings row without a shell providing openSettings', () => {
    render(<EditorViewMenu wrap onWrapChange={() => {}} data-testid="editor-menu" />);
    fireEvent.click(screen.getByTestId('editor-menu'));
    expect(menuItem('Line numbers')).toBeTruthy();
    expect(menuItem('Settings')).toBeUndefined();
  });
});
