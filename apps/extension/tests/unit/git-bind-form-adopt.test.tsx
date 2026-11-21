// @vitest-environment jsdom
/**
 * The adopt's jump, over a mocked bridge: a folder opened as a new
 * workspace is SHOWN through the shell's switch and ACTIVE stays where
 * it was — the browser's rules move by the switcher's check alone.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: () => () => undefined, broadcast: vi.fn(), presence: vi.fn() },
  };
});

vi.mock('@openheaders/ui/shared/sync/when-workspace-listed', () => ({ whenWorkspaceListed: async () => true }));

import GitBindForm from '@openheaders/ui/workbench/components/git/GitBindForm';
import { localWorkspaceTreeTransport } from '@openheaders/ui/workbench/components/git/transport';
import { type SwitchWorkspace, SwitchWorkspaceProvider } from '@openheaders/ui/workbench/hooks/SwitchWorkspaceContext';

afterEach(() => {
  cleanup();
  mockCall.mockReset();
});

describe('GitBindForm — a folder opened as a new workspace', () => {
  it('shows the adopted workspace and never makes it active', async () => {
    mockCall.mockImplementation(async (verb: string) => {
      if (verb === 'oh.workspaceTree.bind') {
        return { ok: false, reason: 'identity-mismatch', treeWorkspaceUid: 'wsjohndoe', treeWorkspaceName: 'John Doe' };
      }
      if (verb === 'oh.workspaceTree.adopt') {
        return { ok: true, workspaceId: 'wsjohndoe', name: 'John Doe', sweep: null };
      }
      throw new Error('no answer');
    });
    const switchWorkspace = vi.fn<SwitchWorkspace>(async () => true);
    render(
      <SwitchWorkspaceProvider switchWorkspace={switchWorkspace}>
        <GitBindForm
          call={localWorkspaceTreeTransport}
          workspaceId="ws-shown"
          allowFolderPicker={false}
          onBound={() => undefined}
          onAdopted={() => undefined}
          testidPrefix="git-tool-bind"
        />
      </SwitchWorkspaceProvider>,
    );

    fireEvent.change(screen.getByTestId('git-tool-bind-path-input'), { target: { value: '/srv/john-doe' } });
    fireEvent.click(screen.getByTestId('git-tool-bind-bind-button'));
    fireEvent.click(await screen.findByTestId('git-tool-bind-adopt-button'));

    await waitFor(() => expect(switchWorkspace).toHaveBeenCalled());
    expect(switchWorkspace.mock.calls).toEqual([['wsjohndoe']]);
  });
});
