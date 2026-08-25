/**
 * WorkspaceMembersModal affordances (the access-foundation plan §8 F4)
 * — an owner sees role selects + remove on exactly the rows the plane
 * can touch (manual editor/viewer rows of directory principals) and
 * the add picker; owner rows, the operator row, managed rows, and an
 * unknown future role all render as immutable verbatim tags (the
 * forward-tolerant decode law); a non-owner gets the read-only list.
 */

import type { WorkspaceMembersListResult } from '@openheaders/core/capabilities';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import WorkspaceMembersModal from '@openheaders/ui/workbench/components/workspace/WorkspaceMembersModal';
import { cleanup, render, screen } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const WORKSPACE = { id: 'ws-team', name: 'Team A', kind: 'team', orgId: 'org-1' } as unknown as ExtensionWorkspace;

const mockList = vi.fn<() => Promise<WorkspaceMembersListResult>>();
const mockGrant = vi.fn();
const mockRevoke = vi.fn();

function membersFixture(): WorkspaceMembersListResult {
  return {
    ok: true,
    callerRole: 'owner',
    members: [
      { userId: 'op-1', displayName: 'Operator', email: null, kind: 'user', role: 'owner', operator: true },
      { userId: 'u-owner', displayName: 'Alice', email: 'alice@openheaders.io', kind: 'user', role: 'owner' },
      { userId: 'u-editor', displayName: 'Bob', email: 'bob@openheaders.io', kind: 'user', role: 'editor' },
      { userId: 'svc-1', displayName: 'CI deployer', email: null, kind: 'service', role: 'viewer' },
      {
        userId: 'u-idp',
        displayName: 'Dana',
        email: 'dana@openheaders.io',
        kind: 'user',
        role: 'viewer',
        origin: 'idp',
      },
      // A newer server's role value — verbatim tag, never a control.
      { userId: 'u-future', displayName: 'John Doe', email: null, kind: 'user', role: 'auditor' },
    ],
    candidates: [{ userId: 'u-new', displayName: 'Carol', email: 'carol@openheaders.io', kind: 'user' }],
  };
}

beforeEach(() => {
  mockList.mockReset();
  mockGrant.mockReset();
  mockRevoke.mockReset();
  registerCapability('workspaceMembers', () => ({ list: mockList, grant: mockGrant, revoke: mockRevoke }));
});

afterEach(() => {
  cleanup();
  unregisterCapability('workspaceMembers');
  vi.restoreAllMocks();
});

describe('WorkspaceMembersModal', () => {
  it('an owner gets mutation affordances on exactly the touchable rows, plus the add picker', async () => {
    mockList.mockResolvedValue(membersFixture());
    render(
      <AntApp>
        <WorkspaceMembersModal workspace={WORKSPACE} onClose={() => undefined} />
      </AntApp>,
    );
    // Manual editor/viewer rows of directory principals are mutable —
    // the service account included (grantable is the F3 point).
    expect(await screen.findByTestId('workspace-members-role-u-editor')).toBeTruthy();
    expect(screen.getByTestId('workspace-members-role-svc-1')).toBeTruthy();
    expect(screen.getByTestId('workspace-members-remove-u-editor')).toBeTruthy();
    // Operator, owner, managed, and unknown-role rows are immutable.
    expect(screen.queryByTestId('workspace-members-role-op-1')).toBeNull();
    expect(screen.queryByTestId('workspace-members-role-u-owner')).toBeNull();
    expect(screen.queryByTestId('workspace-members-role-u-idp')).toBeNull();
    expect(screen.queryByTestId('workspace-members-role-u-future')).toBeNull();
    expect(screen.queryByTestId('workspace-members-remove-u-idp')).toBeNull();
    // The unknown role renders verbatim (forward-tolerant), the managed
    // row wears its tag, the operator row its label.
    expect(screen.getByText('auditor')).toBeTruthy();
    expect(screen.getByText('Managed')).toBeTruthy();
    expect(screen.getByText('Server operator')).toBeTruthy();
    expect(screen.getByText('Service')).toBeTruthy();
    // The add picker is present for the owner.
    expect(screen.getByTestId('workspace-members-add-select')).toBeTruthy();
    expect(screen.getByTestId('workspace-members-add-btn')).toBeTruthy();
  });

  it('a non-owner gets the read-only list — no controls, no picker, the honest hint', async () => {
    const fixture = membersFixture();
    mockList.mockResolvedValue({ ...fixture, callerRole: 'editor', candidates: undefined });
    render(
      <AntApp>
        <WorkspaceMembersModal workspace={WORKSPACE} onClose={() => undefined} />
      </AntApp>,
    );
    expect(await screen.findByTestId('workspace-members-row-u-editor')).toBeTruthy();
    expect(screen.queryByTestId('workspace-members-role-u-editor')).toBeNull();
    expect(screen.queryByTestId('workspace-members-remove-u-editor')).toBeNull();
    expect(screen.queryByTestId('workspace-members-add-select')).toBeNull();
    expect(screen.getByText('Only a workspace owner can change members.')).toBeTruthy();
  });

  it("a refused list renders the server's error verbatim", async () => {
    mockList.mockResolvedValue({ ok: false, reason: 'not-granted', error: 'you hold no grant on this workspace' });
    render(
      <AntApp>
        <WorkspaceMembersModal workspace={WORKSPACE} onClose={() => undefined} />
      </AntApp>,
    );
    expect(await screen.findByText('you hold no grant on this workspace')).toBeTruthy();
  });

  describe('visibility section (F5)', () => {
    const onVisibilityChange = vi.fn<(visibility: 'private' | 'internal') => Promise<boolean>>();

    it('renders nothing without the onVisibilityChange wiring', async () => {
      mockList.mockResolvedValue(membersFixture());
      render(
        <AntApp>
          <WorkspaceMembersModal workspace={WORKSPACE} onClose={() => undefined} />
        </AntApp>,
      );
      await screen.findByTestId('workspace-members-row-u-editor');
      expect(screen.queryByTestId('workspace-members-visibility')).toBeNull();
    });

    it('an owner gets the Private|Internal control with the matching hint', async () => {
      mockList.mockResolvedValue(membersFixture());
      render(
        <AntApp>
          <WorkspaceMembersModal
            workspace={{ ...WORKSPACE, visibility: 'internal' } as ExtensionWorkspace}
            onClose={() => undefined}
            onVisibilityChange={onVisibilityChange}
          />
        </AntApp>,
      );
      expect(await screen.findByTestId('workspace-members-visibility-segmented')).toBeTruthy();
      expect(
        screen.getByText('Every member of this server can view this workspace. Only members you add can edit.'),
      ).toBeTruthy();
    });

    it('a non-owner sees the current visibility as a static tag', async () => {
      mockList.mockResolvedValue({ ...membersFixture(), callerRole: 'editor', candidates: undefined });
      render(
        <AntApp>
          <WorkspaceMembersModal
            workspace={WORKSPACE}
            onClose={() => undefined}
            onVisibilityChange={onVisibilityChange}
          />
        </AntApp>,
      );
      await screen.findByTestId('workspace-members-row-u-editor');
      expect(screen.queryByTestId('workspace-members-visibility-segmented')).toBeNull();
      expect(screen.getByTestId('workspace-members-visibility-tag').textContent).toBe('Private');
      expect(screen.getByText('Only invited members can see this workspace.')).toBeTruthy();
    });

    it('an unknown visibility value renders verbatim as an immutable tag even for the owner', async () => {
      mockList.mockResolvedValue(membersFixture());
      render(
        <AntApp>
          <WorkspaceMembersModal
            workspace={{ ...WORKSPACE, visibility: 'public' } as ExtensionWorkspace}
            onClose={() => undefined}
            onVisibilityChange={onVisibilityChange}
          />
        </AntApp>,
      );
      await screen.findByTestId('workspace-members-row-u-editor');
      expect(screen.queryByTestId('workspace-members-visibility-segmented')).toBeNull();
      expect(screen.getByTestId('workspace-members-visibility-tag').textContent).toBe('public');
    });
  });
});
