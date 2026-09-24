/**
 * The switcher over a joined Org that granted nothing yet —
 * `WorkspaceDropdownBody` grouped by Org:
 *   - the Org keeps its group: a plain header (no switch, nothing to
 *     land on), the fact under it, and the server's own page as the way
 *     on (the backend record's address as an http origin, through
 *     `openExternalUrl`, the dropdown closing with the click);
 *   - a search hides the empty group — it matches no workspace.
 */

import { refreshBackendsFromHostStorage } from '@openheaders/core/backends';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { describeOrg, getIdentitySnapshot, orgCatalogue } from '@openheaders/core/identity';
import type { ExtensionWorkspace, Org } from '@openheaders/core/types';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { WorkspaceDropdownBody } from '@openheaders/ui/shared/workspace-dropdown/WorkspaceDropdownBody';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installSyntheticIdentityForTests, TEST_BACKEND_ID } from './sync/_identity-test-setup';

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

const RIG: Org = { id: 'org-rig', name: 'Access Rig', hostKind: 'daemon', isPrivate: false };

function homeWorkspace(): ExtensionWorkspace {
  const snapshot = getIdentitySnapshot();
  return {
    schemaVersion: 5,
    id: 'ws-home',
    kind: 'personal',
    name: 'Workspace',
    orgId: snapshot?.user.homeOrgId ?? 'org-home',
    sortIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderBody(onClose = vi.fn()) {
  const snapshot = getIdentitySnapshot();
  render(
    <AntApp>
      <WorkspaceDropdownBody
        workspaces={[homeWorkspace()]}
        selectedId="ws-home"
        activeId="ws-home"
        mode="workbench"
        onSwitch={() => undefined}
        onPromoteActive={() => undefined}
        onExport={() => undefined}
        onImport={() => undefined}
        onOpenManager={() => undefined}
        onClose={onClose}
        orgGrouping={{ catalogue: orgCatalogue(snapshot), describe: (orgId) => describeOrg(snapshot, orgId) }}
      />
    </AntApp>,
  );
  return { onClose };
}

type OpenExternal = (url: string) => Promise<{ ok: boolean; error?: string }>;
let openExternal: ReturnType<typeof vi.fn<OpenExternal>>;
let teardown: () => void;

beforeEach(async () => {
  setCurrentHost('extension');
  teardown = await installSyntheticIdentityForTests([], [{ org: RIG, backendId: TEST_BACKEND_ID }]);
  await refreshBackendsFromHostStorage();
  openExternal = vi.fn<OpenExternal>(async () => ({ ok: true }));
  registerCapability('openExternalUrl', openExternal);
});

afterEach(() => {
  unregisterCapability('openExternalUrl');
  teardown();
  cleanup();
});

describe('WorkspaceDropdownBody over a zero-grant Org', () => {
  it('keeps the Org group with the fact and the way to the server page', () => {
    const { onClose } = renderBody();

    const row = screen.getByTestId(`workspace-dropdown-no-access-${RIG.id}`);
    expect(row.textContent).toContain('No workspaces — access not granted');
    // The header names the place and is not a switch: the one button
    // under this Org is the way to its page.
    expect(screen.getAllByRole('button', { name: /Access Rig/ })).toHaveLength(1);

    fireEvent.click(screen.getByTestId(`workspace-dropdown-open-place-${RIG.id}`));

    expect(openExternal).toHaveBeenCalledWith('http://127.0.0.1:8137');
    expect(onClose).toHaveBeenCalled();
  });

  it('a search hides the empty group', () => {
    renderBody();
    fireEvent.change(screen.getByPlaceholderText(/Search workspaces/), { target: { value: 'zzz' } });
    expect(screen.queryByTestId(`workspace-dropdown-no-access-${RIG.id}`)).toBeNull();
  });
});
