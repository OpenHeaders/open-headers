// @vitest-environment jsdom
/**
 * ExecutionPlaceControl + executionPlaceCopy — the place button after
 * Save: a run glyph beside the place's mark, the standard hover line
 * (the button's accessible name), muted when nothing else is possible,
 * the warning tone when the desktop app is needed, and the popover:
 * the reason, the whole roster with disabled rows carrying their
 * reason and rung, a pick as a draft edit, Reset to automatic.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { subscribeSettingsReveal } from '@openheaders/ui/workbench/data/settings-reveal';
import ExecutionPlaceControl from '@openheaders/ui/workbench/execution-place/ExecutionPlaceControl';
import { executionPlaceCopy } from '@openheaders/ui/workbench/execution-place/execution-place-copy';
import type {
  ExecutionPlaceResolution,
  ExecutionPlaceRosterRow,
} from '@openheaders/ui/workbench/execution-place/resolve-execution-place';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const mirror = {
  liveActiveWorkspaceId: (): string | null => 'ws-1',
  liveWorkspaces: (): { id: string; orgId: string }[] => [{ id: 'ws-1', orgId: 'org-home' }],
  getMirror: (): unknown => ({}),
  subscribeMirror: (): (() => void) => () => {},
};

vi.mock('@openheaders/ui/context', () => ({
  getActiveExtensionWorkspaceSyncMirror: () => mirror,
}));

vi.mock('@openheaders/ui/context/mirrors/extension-workspace-sync-mirror', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@openheaders/ui/context/mirrors/extension-workspace-sync-mirror')>();
  return { ...actual, getActiveExtensionWorkspaceSyncMirror: () => mirror };
});

beforeAll(() => {
  setCurrentHost('extension');
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

afterEach(() => {
  unregisterCapability('companionReveal');
  unregisterCapability('desktopLaunch');
  cleanup();
});

function resolution(overrides: Partial<ExecutionPlaceResolution>): ExecutionPlaceResolution {
  return {
    place: 'here',
    placeName: null,
    state: 'ready',
    reason: { kind: 'runs-here' },
    cta: null,
    alternatives: [],
    ...overrides,
  };
}

const HERE: ExecutionPlaceRosterRow = { role: 'here', available: true, reason: null, cta: null };
const DESKTOP_UP: ExecutionPlaceRosterRow = { role: 'desktop-app', available: true, reason: null, cta: null };
const DESKTOP_MISSING: ExecutionPlaceRosterRow = {
  role: 'desktop-app',
  available: false,
  reason: 'desktop-not-installed',
  cta: 'download-desktop-app',
};
const SERVER_UP: ExecutionPlaceRosterRow = { role: 'workspace-server', available: true, reason: null, cta: null };
const NO_SERVER: ExecutionPlaceRosterRow = {
  role: 'workspace-server',
  available: false,
  reason: 'no-server',
  cta: null,
};
const SERVER_DOWN: ExecutionPlaceRosterRow = {
  role: 'workspace-server',
  available: false,
  reason: 'server-not-connected',
  cta: null,
};

const chip = (): HTMLElement => screen.getByTestId('execution-place-chip');

describe('ExecutionPlaceControl', () => {
  it('a send that runs here with nothing else possible renders muted, worded on hover, its reason on click', async () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({ reason: { kind: 'runs-here-browser' } })}
        roster={[HERE, DESKTOP_MISSING, NO_SERVER]}
        preference="auto"
      />,
    );
    expect(chip().getAttribute('aria-label')).toBe('Runs locally: in this browser extension');
    expect(chip().textContent).toBe('');
    expect(chip().getAttribute('data-place')).toBe('here');
    expect(chip().getAttribute('data-state')).toBe('ready');
    expect(chip().getAttribute('data-muted')).toBe('true');
    fireEvent.click(chip());
    expect(await screen.findByText('Runs in the extension, on this computer.')).toBeTruthy();
    // Read-only: no picker without an onPick.
    expect(screen.queryByTestId('execution-place-option')).toBeNull();
  });

  it('the roster lists every place — the unavailable rows disabled with their reason and rung', async () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({ reason: { kind: 'runs-here-browser' } })}
        roster={[HERE, DESKTOP_MISSING, NO_SERVER]}
        preference="auto"
        onPick={() => {}}
      />,
    );
    fireEvent.click(chip());
    const options = await screen.findAllByTestId('execution-place-option');
    expect(options.map((o) => o.getAttribute('data-role'))).toEqual(['here', 'desktop-app', 'workspace-server']);
    expect(options.map((o) => o.getAttribute('data-available'))).toEqual(['true', 'false', 'false']);
    expect(screen.getAllByTestId('execution-place-option-label').map((l) => l.textContent)).toEqual([
      'Browser extension',
      'Desktop app',
      'Server',
    ]);
    const reasons = screen.getAllByTestId('execution-place-option-reason');
    expect(reasons[0]?.textContent).toContain('Not installed');
    expect(reasons[0]?.querySelector('[data-testid="status-companion-download"]')).toBeTruthy();
    expect(reasons[1]?.textContent).toBe('Available in a server workspace');
    expect(screen.queryByTestId('execution-place-reset')).toBeNull();
  });

  it('a pick of an available row is a draft edit; a disabled row is not pickable', async () => {
    const onPick = vi.fn();
    render(
      <ExecutionPlaceControl
        resolution={resolution({ reason: { kind: 'runs-here-browser' }, alternatives: ['desktop-app'] })}
        roster={[HERE, DESKTOP_UP, SERVER_DOWN]}
        preference="auto"
        onPick={onPick}
      />,
    );
    expect(chip().getAttribute('data-muted')).toBe('false');
    fireEvent.click(chip());
    const options = await screen.findAllByTestId('execution-place-option');
    fireEvent.click(options[1] as HTMLElement);
    expect(onPick).toHaveBeenCalledWith('desktop-app');
    fireEvent.click(options[2] as HTMLElement);
    expect(onPick).toHaveBeenCalledTimes(1);
    // A server whose wire is down offers the Sync page — an in-page
    // reveal the shell opens Settings on.
    const revealed = vi.fn();
    const unsubscribe = subscribeSettingsReveal(revealed);
    fireEvent.click(screen.getByTestId('execution-place-open-sync'));
    unsubscribe();
    expect(revealed).toHaveBeenCalledWith({ categoryId: 'backendConnections' });
  });

  it('an explicit place shows the saved note and Reset to automatic clears it', async () => {
    const onPick = vi.fn();
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          place: 'workspace-server',
          placeName: 'Acme',
          reason: { kind: 'delegated', role: 'workspace-server', knobs: [] },
          alternatives: ['here', 'desktop-app'],
          serverName: 'Acme',
        })}
        roster={[HERE, DESKTOP_UP, SERVER_UP]}
        preference="workspace-server"
        onPick={onPick}
      />,
    );
    expect(chip().getAttribute('aria-label')).toBe('Runs remotely: on Acme');
    fireEvent.click(chip());
    expect(
      await screen.findByText(
        /Acme opens the connection on this request's behalf\. The resolved values, secrets included, travel to it\./,
      ),
    ).toBeTruthy();
    const options = screen.getAllByTestId('execution-place-option');
    expect((options[2] as HTMLInputElement).checked).toBe(true);
    expect(options[2]?.closest('label')?.textContent).toContain('Acme');
    fireEvent.click(screen.getByTestId('execution-place-reset'));
    expect(onPick).toHaveBeenCalledWith(null);
  });

  it('an mqtt(s) session with the desktop app connected needs the companion and offers to front it', async () => {
    const reveal = vi.fn(async () => ({ ok: true }));
    registerCapability('companionReveal', reveal);
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          place: 'desktop-app',
          state: 'needs-companion',
          reason: { kind: 'tcp-scheme' },
          cta: 'reveal-desktop-app',
        })}
        roster={[{ role: 'here', available: false, reason: 'kind-not-here', cta: null }, DESKTOP_MISSING, NO_SERVER]}
        preference="auto"
      />,
    );
    expect(chip().getAttribute('aria-label')).toBe('Cannot run here: needs the desktop app or a server');
    expect(chip().getAttribute('data-state')).toBe('needs-companion');
    fireEvent.click(chip());
    expect(await screen.findByText(/mqtt:\/\/ and mqtts:\/\/ open a raw TCP socket/)).toBeTruthy();
    const cta = await screen.findByTestId('execution-place-cta');
    fireEvent.click(cta.querySelector('button') as HTMLButtonElement);
    await waitFor(() => expect(reveal).toHaveBeenCalledWith('workbench'));
  });

  it('a page-realm session names the knobs the browser socket cannot apply', async () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({ reason: { kind: 'runs-here-page-realm', knobs: ['headers', 'sslVerify'] } })}
        roster={[HERE, DESKTOP_MISSING, NO_SERVER]}
        preference="auto"
      />,
    );
    fireEvent.click(chip());
    expect(
      await screen.findByText(
        'Running on the browser socket — custom handshake headers, disabled SSL verification do not apply on this host.',
      ),
    ).toBeTruthy();
  });

  it('an unsupported pick keeps its row selected and disabled so the user can pick back', async () => {
    const onPick = vi.fn();
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          place: 'workspace-server',
          state: 'unsupported',
          reason: { kind: 'preference-unavailable', preferred: 'workspace-server' },
          alternatives: ['here'],
        })}
        roster={[HERE, DESKTOP_MISSING, SERVER_DOWN]}
        preference="workspace-server"
        onPick={onPick}
      />,
    );
    expect(chip().getAttribute('aria-label')).toBe('Cannot run on the server yet');
    fireEvent.click(chip());
    const options = await screen.findAllByTestId('execution-place-option');
    expect((options[2] as HTMLInputElement).checked).toBe(true);
    fireEvent.click(options[0] as HTMLElement);
    expect(onPick).toHaveBeenCalledWith('here');
  });

  it("the web tab's session kinds read as not available on the serving place yet", () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          place: 'workspace-server',
          placeName: 'Acme',
          state: 'unsupported',
          reason: { kind: 'session-not-forwarded', name: 'Acme' },
        })}
        roster={[{ role: 'workspace-server', available: false, reason: 'not-forwarded', cta: null }]}
        preference="auto"
      />,
    );
    expect(chip().getAttribute('aria-label')).toBe('Not available on Acme yet');
    expect(chip().getAttribute('data-state')).toBe('unsupported');
  });

  it('a context send names the serving place', () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          place: 'workspace-server',
          placeName: '127.0.0.1:19337',
          reason: { kind: 'context-send', name: '127.0.0.1:19337' },
        })}
        roster={[SERVER_UP]}
        preference="auto"
      />,
    );
    expect(chip().getAttribute('aria-label')).toBe('Runs remotely: on 127.0.0.1:19337');
  });

  it('a controlled popover opens from outside — the disabled primary’s hint', async () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({ reason: { kind: 'runs-here-browser' } })}
        roster={[HERE, DESKTOP_MISSING, NO_SERVER]}
        preference="auto"
        onPick={() => {}}
        open
        onOpenChange={() => {}}
      />,
    );
    expect(await screen.findAllByTestId('execution-place-option')).toHaveLength(3);
  });
});

describe('executionPlaceCopy', () => {
  const t = (key: string, args?: Record<string, unknown>): string => (args ? `${key} ${JSON.stringify(args)}` : key);

  it('words a preference no leg can honour with the role name, never a backend id', () => {
    const copy = executionPlaceCopy(
      resolution({
        place: 'workspace-server',
        state: 'unsupported',
        reason: { kind: 'preference-unavailable', preferred: 'workspace-server' },
      }),
      t as never,
    );
    expect(copy.chip).toBe('shared.executionPlace.tip.cannotRunOn {"place":"shared.executionPlace.role.server"}');
    expect(copy.reason).toBe(
      'shared.executionPlace.reason.preferenceUnavailable {"place":"shared.executionPlace.role.server"}',
    );
    expect(copy.knobs).toBeNull();
  });

  it('a nameless serving place falls back to the role noun', () => {
    const copy = executionPlaceCopy(
      resolution({ place: 'workspace-server', reason: { kind: 'context-send', name: null } }),
      t as never,
    );
    expect(copy.chip).toBe('shared.executionPlace.tip.remoteServer {"place":"shared.executionPlace.role.server"}');
  });

  it('a delegated send to the desktop app reads local and names no transit', () => {
    const copy = executionPlaceCopy(
      resolution({ place: 'desktop-app', reason: { kind: 'delegated', role: 'desktop-app', knobs: [] } }),
      t as never,
    );
    expect(copy.chip).toBe('shared.executionPlace.tip.localDesktop');
    expect(copy.reason).toBe('shared.executionPlace.reason.delegatedDesktopApp');
  });

  it('the server invoke reads remote, resolved there', () => {
    const copy = executionPlaceCopy(
      resolution({ place: 'workspace-server', placeName: 'Acme', reason: { kind: 'server-invoke' } }),
      t as never,
    );
    expect(copy.chip).toBe('shared.executionPlace.tip.remoteServer {"place":"Acme"}');
    expect(copy.reason).toBe('shared.executionPlace.reason.serverInvoke {"place":"Acme"}');
    expect(copy.knobs).toBeNull();
  });

  it('the companion invoke reads as local, in the desktop app', () => {
    const copy = executionPlaceCopy(
      resolution({ place: 'desktop-app', reason: { kind: 'companion-invoke' } }),
      t as never,
    );
    expect(copy.chip).toBe('shared.executionPlace.tip.localDesktop');
    expect(copy.reason).toBe('shared.executionPlace.reason.companionInvoke');
  });
});
