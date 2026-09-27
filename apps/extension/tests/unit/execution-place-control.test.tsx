// @vitest-environment jsdom
/**
 * ExecutionPlaceControl + executionPlaceCopy — the place button after
 * Save: a run glyph beside the place's mark, the words on hover
 * (the button's accessible name), muted when nothing else is possible,
 * the warning tone when the desktop app is needed, the reason in the
 * click-popover, the companion ladder rung as its call to action.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import ExecutionPlaceControl from '@openheaders/ui/workbench/execution-place/ExecutionPlaceControl';
import { executionPlaceCopy } from '@openheaders/ui/workbench/execution-place/execution-place-copy';
import type { ExecutionPlaceResolution } from '@openheaders/ui/workbench/execution-place/resolve-execution-place';
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

const chip = (): HTMLElement => screen.getByTestId('execution-place-chip');

describe('ExecutionPlaceControl', () => {
  it('a send that runs here with nothing else possible renders muted, worded on hover, its reason on click', async () => {
    render(<ExecutionPlaceControl resolution={resolution({ reason: { kind: 'runs-here-browser' } })} />);
    expect(chip().getAttribute('aria-label')).toBe('Runs here');
    expect(chip().textContent).toBe('');
    expect(chip().getAttribute('data-place')).toBe('here');
    expect(chip().getAttribute('data-state')).toBe('ready');
    expect(chip().getAttribute('data-muted')).toBe('true');
    fireEvent.click(chip());
    expect(await screen.findByText('Runs in the extension, on this computer.')).toBeTruthy();
    expect(screen.queryByTestId('execution-place-cta')).toBeNull();
  });

  it('the mark names the place: a device mark here, the server mark for a nameless server', () => {
    const { unmount } = render(
      <ExecutionPlaceControl resolution={resolution({ reason: { kind: 'runs-here-browser' } })} />,
    );
    // jsdom's user agent is no browser with a distinct logo — the
    // generic host-kind glyph stands in; a real browser draws its own.
    expect(screen.getByTestId('execution-place-mark').getAttribute('data-mark')).toMatch(/^(browser|host-kind)$/);
    unmount();
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          place: 'workspace-server',
          placeName: 'Acme',
          reason: { kind: 'delegated', role: 'workspace-server', knobs: [] },
        })}
      />,
    );
    expect(screen.getByTestId('execution-place-mark').getAttribute('data-mark')).toBe('host-kind');
  });

  it('a page-realm session names the knobs the browser socket cannot apply', async () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({ reason: { kind: 'runs-here-page-realm', knobs: ['headers', 'sslVerify'] } })}
      />,
    );
    fireEvent.click(chip());
    expect(
      await screen.findByText(
        'Running on the browser socket — custom handshake headers, disabled SSL verification do not apply on this host.',
      ),
    ).toBeTruthy();
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
      />,
    );
    expect(chip().getAttribute('aria-label')).toBe('Needs the desktop app');
    expect(chip().getAttribute('data-state')).toBe('needs-companion');
    expect(chip().getAttribute('data-muted')).toBe('false');
    fireEvent.click(chip());
    expect(await screen.findByText(/mqtt:\/\/ and mqtts:\/\/ open a raw TCP socket/)).toBeTruthy();
    const cta = await screen.findByTestId('execution-place-cta');
    fireEvent.click(cta.querySelector('button') as HTMLButtonElement);
    await waitFor(() => expect(reveal).toHaveBeenCalledWith('workbench'));
  });

  it('a missing desktop app offers the download rung', async () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          place: 'desktop-app',
          state: 'needs-companion',
          reason: { kind: 'companion-required' },
          cta: 'download-desktop-app',
        })}
      />,
    );
    fireEvent.click(chip());
    const cta = await screen.findByTestId('execution-place-cta');
    expect(cta.textContent).toContain('Download');
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
      />,
    );
    expect(chip().getAttribute('aria-label')).toBe('Not available on Acme yet');
    expect(chip().getAttribute('data-state')).toBe('unsupported');
  });

  it('a send that runs here with other places on offer renders unmuted and opens the picker', async () => {
    const onPick = vi.fn();
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          reason: { kind: 'runs-here-browser' },
          alternatives: ['desktop-app', 'workspace-server'],
          serverName: 'Acme',
        })}
        onPick={onPick}
      />,
    );
    expect(chip().getAttribute('aria-label')).toBe('Runs here');
    expect(chip().getAttribute('data-muted')).toBe('false');
    fireEvent.click(chip());
    expect(await screen.findByText('Run on')).toBeTruthy();
    // The test id lands on the radio input; its label is the row's text.
    const options = screen.getAllByTestId('execution-place-option');
    expect(options.map((o) => o.getAttribute('data-role'))).toEqual(['here', 'desktop-app', 'workspace-server']);
    expect(options.map((o) => o.closest('label')?.textContent)).toEqual(['This device', 'The desktop app', 'Acme']);
    fireEvent.click(options[2]);
    expect(onPick).toHaveBeenCalledWith('workspace-server');
  });

  it('a delegated send names the place, the transit for a server, and keeps the picker with the other places', async () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          place: 'workspace-server',
          placeName: 'Acme',
          reason: { kind: 'delegated', role: 'workspace-server', knobs: [] },
          alternatives: ['here', 'desktop-app'],
          serverName: 'Acme',
        })}
        onPick={() => {}}
      />,
    );
    expect(chip().getAttribute('aria-label')).toBe('Runs on Acme');
    fireEvent.click(chip());
    expect(
      await screen.findByText(
        /Acme opens the connection on this request's behalf\. The resolved values, secrets included, travel to it\./,
      ),
    ).toBeTruthy();
    const options = screen.getAllByTestId('execution-place-option');
    expect(options.map((o) => o.getAttribute('data-role'))).toEqual(['workspace-server', 'here', 'desktop-app']);
  });

  it('a delegated send names the cookie jar the place cannot apply', async () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          place: 'desktop-app',
          reason: { kind: 'delegated', role: 'desktop-app', knobs: ['cookieJar'] },
          alternatives: ['here'],
        })}
      />,
    );
    fireEvent.click(chip());
    expect(await screen.findByText('Not applied on the desktop app: the cookie jar.')).toBeTruthy();
  });

  it('no picker without an onPick, nor with nothing else to choose', () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({ reason: { kind: 'runs-here-browser' }, alternatives: ['desktop-app'] })}
      />,
    );
    fireEvent.click(chip());
    expect(screen.queryByTestId('execution-place-option')).toBeNull();
  });

  it('an unsupported pick keeps the possible places on offer so the user can pick back', async () => {
    const onPick = vi.fn();
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          place: 'workspace-server',
          state: 'unsupported',
          reason: { kind: 'preference-unavailable', preferred: 'workspace-server' },
          alternatives: ['here'],
        })}
        onPick={onPick}
      />,
    );
    fireEvent.click(chip());
    const options = await screen.findAllByTestId('execution-place-option');
    expect(options.map((o) => o.getAttribute('data-role'))).toEqual(['here']);
    fireEvent.click(options[0]);
    expect(onPick).toHaveBeenCalledWith('here');
  });

  it('a context send names the serving place', () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({
          place: 'workspace-server',
          placeName: '127.0.0.1:19337',
          reason: { kind: 'context-send', name: '127.0.0.1:19337' },
        })}
      />,
    );
    expect(chip().getAttribute('aria-label')).toBe('Runs on 127.0.0.1:19337');
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
    expect(copy.chip).toBe('shared.executionPlace.chip.cannotRunOn {"place":"shared.executionPlace.role.server"}');
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
    expect(copy.chip).toBe('shared.executionPlace.chip.server {"place":"shared.executionPlace.role.server"}');
  });

  it('a delegated send to the desktop app names no transit — loopback carries nothing new', () => {
    const copy = executionPlaceCopy(
      resolution({ place: 'desktop-app', reason: { kind: 'delegated', role: 'desktop-app', knobs: [] } }),
      t as never,
    );
    expect(copy.chip).toBe('shared.executionPlace.chip.desktopApp');
    expect(copy.reason).toBe('shared.executionPlace.reason.delegatedDesktopApp');
  });

  it('the server invoke reads as running on the server, resolved there', () => {
    const copy = executionPlaceCopy(
      resolution({ place: 'workspace-server', placeName: 'Acme', reason: { kind: 'server-invoke' } }),
      t as never,
    );
    expect(copy.chip).toBe('shared.executionPlace.chip.server {"place":"Acme"}');
    expect(copy.reason).toBe('shared.executionPlace.reason.serverInvoke {"place":"Acme"}');
    expect(copy.knobs).toBeNull();
  });

  it('the companion invoke reads as running on the desktop app', () => {
    const copy = executionPlaceCopy(
      resolution({ place: 'desktop-app', reason: { kind: 'companion-invoke' } }),
      t as never,
    );
    expect(copy.chip).toBe('shared.executionPlace.chip.desktopApp');
    expect(copy.reason).toBe('shared.executionPlace.reason.companionInvoke');
  });
});
