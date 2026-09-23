/**
 * The zero-grant banner — `OrgWorkspaceAccessNotice` over a joined Org
 * that granted nothing yet:
 *   - it names the Org and offers the server's own page (the backend
 *     record's address as an http origin, through `openExternalUrl`);
 *   - its close is per Org and survives a re-mount, and is forgotten
 *     the moment the Org grants a workspace — so a later revoke-to-zero
 *     is announced again;
 *   - an Org with a synced-down workspace draws no banner.
 */

import { refreshBackendsFromHostStorage } from '@openheaders/core/backends';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import type { ExtensionWorkspace, Org } from '@openheaders/core/types';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import OrgWorkspaceAccessNotice from '@openheaders/ui/workbench/components/workspace/OrgWorkspaceAccessNotice';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function makeWorkspace(id: string, orgId: string): ExtensionWorkspace {
  return {
    schemaVersion: 5,
    id,
    kind: 'personal',
    name: `Workspace ${id}`,
    orgId,
    sortIndex: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderNotice(workspaces: ExtensionWorkspace[]) {
  return render(
    <AntApp>
      <OrgWorkspaceAccessNotice workspaces={workspaces} activeWorkspaceId={null} onSwitchWorkspace={() => undefined} />
    </AntApp>,
  );
}

const BANNER = '[data-testid=org-zero-grant-notice]';

type OpenExternal = (url: string) => Promise<{ ok: boolean; error?: string }>;
let openExternal: ReturnType<typeof vi.fn<OpenExternal>>;
let teardown: () => void;

beforeEach(async () => {
  setCurrentHost('extension');
  window.localStorage.clear();
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

describe('OrgWorkspaceAccessNotice', () => {
  it('names the Org and opens the server page on its own address', async () => {
    renderNotice([]);
    await waitFor(() => {
      expect(document.querySelector(BANNER)).not.toBeNull();
    });
    expect(screen.getByText(/^Connected to Access Rig — no workspaces granted to you yet\./)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open Access Rig' }));

    expect(openExternal).toHaveBeenCalledWith('http://127.0.0.1:8137');
  });

  it('closes per Org, stays closed across a re-mount, and returns once the Org granted and revoked again', async () => {
    const first = renderNotice([]);
    await waitFor(() => {
      expect(document.querySelector(BANNER)).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => {
      expect(document.querySelector(BANNER)).toBeNull();
    });
    first.unmount();

    // Re-mounted, still dismissed.
    const second = renderNotice([]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.querySelector(BANNER)).toBeNull();

    // A grant arrives: nothing to say, and the dismissal is forgotten.
    second.rerender(
      <AntApp>
        <OrgWorkspaceAccessNotice
          workspaces={[makeWorkspace('ws-1', RIG.id)]}
          activeWorkspaceId={null}
          onSwitchWorkspace={() => undefined}
        />
      </AntApp>,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.querySelector(BANNER)).toBeNull();

    // Revoked back to zero: the banner speaks again.
    second.rerender(
      <AntApp>
        <OrgWorkspaceAccessNotice workspaces={[]} activeWorkspaceId={null} onSwitchWorkspace={() => undefined} />
      </AntApp>,
    );
    await waitFor(() => {
      expect(document.querySelector(BANNER)).not.toBeNull();
    });
  });

  it('draws nothing for an Org with a synced-down workspace', async () => {
    renderNotice([makeWorkspace('ws-1', RIG.id)]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.querySelector(BANNER)).toBeNull();
  });
});
