/**
 * Popup header — the popup ⇄ side panel switch follows the host's
 * `surfaceSwitch` capability: a browser with no side panel shows no button
 * and registers no shortcut action.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import Header from '@openheaders/ui/popup/components/Header';
import { SurfaceProvider } from '@openheaders/ui/shared/surface';
import { cleanup, render, screen } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SWITCH_LABEL = 'Switch to side panel (stays open as you browse)';

const { setHeaderActions } = vi.hoisted(() => ({ setHeaderActions: vi.fn() }));

vi.mock('@openheaders/ui/popup/shortcuts/KeyboardNavContext', () => ({
  useKeyboardNav: () => ({ setHeaderActions }),
}));
vi.mock('@openheaders/ui/popup/shortcuts/popup-shortcuts', () => ({ usePopupShortcutLabel: () => '' }));
vi.mock('@openheaders/ui/popup/components/WorkspacePill', () => ({ default: () => null }));
vi.mock('@openheaders/ui/shared/notifications', () => ({ NotificationsIcon: () => null }));
vi.mock('@openheaders/ui/workbench/settings/hooks', () => ({
  useSetting: () => [false, vi.fn()],
  useSettingsReady: () => true,
}));

function renderHeader(): void {
  render(
    <SurfaceProvider mode="popup">
      <AntApp>
        <Header />
      </AntApp>
    </SurfaceProvider>,
  );
}

afterEach(() => {
  cleanup();
  unregisterCapability('surfaceSwitch');
  setHeaderActions.mockClear();
});

describe('popup Header — surface switch', () => {
  it('offers the switch and its shortcut action where the host has a side panel', () => {
    registerCapability('surfaceSwitch', () => true);
    renderHeader();
    expect(screen.getByLabelText(SWITCH_LABEL)).toBeTruthy();
    expect(setHeaderActions).toHaveBeenLastCalledWith({ onToggleSurface: expect.any(Function) });
  });

  it('shows no switch and registers no shortcut action where it has none', () => {
    renderHeader();
    expect(screen.queryByLabelText(SWITCH_LABEL)).toBeNull();
    expect(setHeaderActions).toHaveBeenLastCalledWith({});
  });
});
