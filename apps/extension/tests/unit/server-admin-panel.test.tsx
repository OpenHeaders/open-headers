/**
 * Server admin dock panel — one nav row per administration domain, a
 * click opens that domain's tab; and the tool-window registry exposes
 * the window ONLY once the admin-status probe answers `admin`
 * (affordance honesty — the server re-gates every call regardless).
 */

import { availableToolWindows } from '@openheaders/ui/workbench/tool-windows';
import ServerAdminPanel from '@openheaders/ui/workbench/components/server-admin/ServerAdminPanel';
import { SERVER_ADMIN_SECTIONS } from '@openheaders/ui/workbench/components/server-admin/sections';
import { __resetServerAdminStatusForTests } from '@openheaders/ui/workbench/components/server-admin/use-server-admin-status';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Ant's responsive observer (List) probes matchMedia, which jsdom lacks.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => {}), broadcast: vi.fn(), presence: vi.fn() },
  };
});

const PANEL_INFO = { title: 'Server admin', summary: 'test' };

beforeEach(() => {
  __resetServerAdminStatusForTests();
  mockCall.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function flushProbe(): Promise<void> {
  // The status store settles on the microtask queue; one await drains it.
  await Promise.resolve();
  await Promise.resolve();
}

describe('ServerAdminPanel', () => {
  it('renders one row per administration domain and opens the clicked section', () => {
    mockCall.mockResolvedValue({ admin: true });
    const onOpenSection = vi.fn();
    render(<ServerAdminPanel info={PANEL_INFO} onClose={() => {}} onOpenSection={onOpenSection} />);
    for (const def of SERVER_ADMIN_SECTIONS) {
      expect(screen.getByTestId(`server-admin-panel-${def.id}`)).toBeTruthy();
    }
    fireEvent.click(screen.getByTestId('server-admin-panel-devices'));
    expect(onOpenSection).toHaveBeenCalledWith('devices');
    fireEvent.click(screen.getByTestId('server-admin-panel-users'));
    expect(onOpenSection).toHaveBeenCalledWith('users');
  });
});

describe('availableToolWindows server-admin gating', () => {
  it('exposes the window only once the probe answers admin', async () => {
    mockCall.mockResolvedValue({ admin: true });
    // First read fires the probe and still reports the pre-answer state.
    expect(availableToolWindows().some((def) => def.id === 'server-admin')).toBe(false);
    await flushProbe();
    expect(availableToolWindows().some((def) => def.id === 'server-admin')).toBe(true);
  });

  it('keeps the window absent for a non-admin answer and a rejecting host', async () => {
    mockCall.mockResolvedValue({ admin: false });
    availableToolWindows();
    await flushProbe();
    expect(availableToolWindows().some((def) => def.id === 'server-admin')).toBe(false);

    __resetServerAdminStatusForTests();
    mockCall.mockRejectedValue(new Error('no daemon surface'));
    availableToolWindows();
    await flushProbe();
    expect(availableToolWindows().some((def) => def.id === 'server-admin')).toBe(false);
  });
});
