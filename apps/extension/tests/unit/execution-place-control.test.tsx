// @vitest-environment jsdom
/**
 * ExecutionPlaceControl + executionPlaceCopy — the chip beside the
 * primary button: muted "Runs here" when nothing else is possible, the
 * honest state otherwise, the reason in the click-popover, the
 * companion ladder rung as its call to action.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import ExecutionPlaceControl from '@openheaders/ui/workbench/execution-place/ExecutionPlaceControl';
import { executionPlaceCopy } from '@openheaders/ui/workbench/execution-place/execution-place-copy';
import type { ExecutionPlaceResolution } from '@openheaders/ui/workbench/execution-place/resolve-execution-place';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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

describe('ExecutionPlaceControl', () => {
  it('a send that runs here with nothing else possible renders the muted chip and its reason on click', async () => {
    render(<ExecutionPlaceControl resolution={resolution({ reason: { kind: 'runs-here-browser' } })} />);
    const chip = screen.getByTestId('execution-place-chip');
    expect(chip.textContent).toBe('Runs here');
    expect(chip.getAttribute('data-place')).toBe('here');
    expect(chip.getAttribute('data-state')).toBe('ready');
    expect(chip.className).toContain('ant-tag-filled');
    fireEvent.click(chip);
    expect(await screen.findByText('Runs in the extension, on this computer.')).toBeTruthy();
    expect(screen.queryByTestId('execution-place-cta')).toBeNull();
  });

  it('a page-realm session names the knobs the browser socket cannot apply', async () => {
    render(
      <ExecutionPlaceControl
        resolution={resolution({ reason: { kind: 'runs-here-page-realm', knobs: ['headers', 'sslVerify'] } })}
      />,
    );
    fireEvent.click(screen.getByTestId('execution-place-chip'));
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
    const chip = screen.getByTestId('execution-place-chip');
    expect(chip.textContent).toBe('Needs the desktop app');
    expect(chip.getAttribute('data-state')).toBe('needs-companion');
    expect(chip.className).toContain('ant-tag-outlined');
    fireEvent.click(chip);
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
    fireEvent.click(screen.getByTestId('execution-place-chip'));
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
    const chip = screen.getByTestId('execution-place-chip');
    expect(chip.textContent).toBe('Not available on Acme yet');
    expect(chip.getAttribute('data-state')).toBe('unsupported');
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
    expect(screen.getByTestId('execution-place-chip').textContent).toBe('Runs on 127.0.0.1:19337');
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

  it('the companion invoke reads as running on the desktop app', () => {
    const copy = executionPlaceCopy(
      resolution({ place: 'desktop-app', reason: { kind: 'companion-invoke' } }),
      t as never,
    );
    expect(copy.chip).toBe('shared.executionPlace.chip.desktopApp');
    expect(copy.reason).toBe('shared.executionPlace.reason.companionInvoke');
  });
});
