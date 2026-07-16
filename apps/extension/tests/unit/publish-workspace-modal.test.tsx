/**
 * PublishWorkspaceModal — the Publish target picker over the
 * Duplicate-into RPC (PUBLISH_TARGET_PICKER.md). Pins:
 *   - the submitted values (the `duplicateWorkspace` options payload):
 *     source name pre-filled, first healthy target pre-selected,
 *     secrets excluded by default;
 *   - one target keeps the one-click shape — no picker, the OK button
 *     names the Org;
 *   - unhealthy targets render disabled in the picker with the
 *     annotation wording, and a lone unhealthy target disables OK.
 */

import type { ExtensionWorkspace } from '@openheaders/core/types';
import type { PublishTarget } from '@openheaders/ui/shared/backend';
import PublishWorkspaceModal from '@openheaders/ui/workbench/components/workspace/PublishWorkspaceModal';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Ant's Select measures via rc-resize-observer; jsdom has neither
// ResizeObserver nor matchMedia.
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

afterEach(cleanup);

const SOURCE: ExtensionWorkspace = {
  schemaVersion: 5,
  id: 'ws-1',
  kind: 'personal',
  name: 'API sandbox',
  orgId: 'org-home',
  sortIndex: 0,
  createdAt: '2026-07-08T00:00:00.000Z',
  updatedAt: '2026-07-08T00:00:00.000Z',
};

function makeTarget(overrides: Partial<PublishTarget> = {}): PublishTarget {
  return {
    orgId: 'org-staging',
    orgName: 'Staging',
    healthy: true,
    annotation: { tone: 'quiet', kind: 'synced', backendLabel: 'Desktop app' },
    ...overrides,
  };
}

function renderModal(targets: PublishTarget[]): { onSubmit: ReturnType<typeof vi.fn> } {
  const onSubmit = vi.fn(async () => true);
  render(<PublishWorkspaceModal source={SOURCE} targets={targets} onCancel={() => undefined} onSubmit={onSubmit} />);
  return { onSubmit };
}

describe('PublishWorkspaceModal', () => {
  it('submits the duplicate options: pre-filled name, first healthy target, secrets off', async () => {
    const { onSubmit } = renderModal([
      makeTarget({
        orgId: 'org-down',
        orgName: 'Down',
        healthy: false,
        annotation: { tone: 'warning', kind: 'disconnected', backendLabel: 'Box' },
      }),
      makeTarget(),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'API sandbox',
        targetOrgId: 'org-staging',
        includeSecrets: false,
      });
    });
  });

  it('two or more targets render the picker with unhealthy options disabled', async () => {
    renderModal([
      makeTarget(),
      makeTarget({
        orgId: 'org-team',
        orgName: 'Team',
        healthy: false,
        annotation: { tone: 'warning', kind: 'repair', backendLabel: 'Work VM' },
      }),
    ]);

    fireEvent.mouseDown(screen.getByRole('combobox'));

    await waitFor(() => {
      const disabled = document.querySelectorAll('.ant-select-item-option-disabled');
      expect(disabled.length).toBe(1);
      expect(disabled[0]?.textContent).toContain('Team');
      expect(disabled[0]?.textContent).toContain('via Work VM — re-pair needed');
    });
  });

  it('a single target keeps the one-click shape — no picker, OK names the Org', async () => {
    const { onSubmit } = renderModal([makeTarget()]);

    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('via Desktop app')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Publish to Staging' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'API sandbox',
        targetOrgId: 'org-staging',
        includeSecrets: false,
      });
    });
  });

  it('a lone unhealthy target disables OK', () => {
    renderModal([
      makeTarget({ healthy: false, annotation: { tone: 'warning', kind: 'off', backendLabel: 'Desktop app' } }),
    ]);
    const ok = screen.getByRole('button', { name: 'Publish to Staging' }) as HTMLButtonElement;
    expect(ok.disabled).toBe(true);
  });

  it('opting into secrets rides the payload', async () => {
    const { onSubmit } = renderModal([makeTarget()]);

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish to Staging' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'API sandbox',
        targetOrgId: 'org-staging',
        includeSecrets: true,
      });
    });
  });
});
