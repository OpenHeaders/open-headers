// @vitest-environment jsdom
/**
 * A file named outside a tree as the workbench names it. Pins the diff
 * and history dialogs' title (`NamedFileTitle`): an entity's one file by
 * the entity's name, a file of an entity that lists several by its name
 * and its part, a file of the user's own by its path — the path always
 * on the title's hover — and Jump to Source's notice when nothing
 * opened: the entity's name when a row gave one, the path otherwise.
 * And the lines a finished pass adds about the person's files
 * (`use-named-notices`): said once, after the surface handed them over,
 * with each file named the same way — by path where no namer is lent.
 */

import type { WorkspaceTreeEntityRefWire } from '@openheaders/core/bridge';
import type { TreeNode } from '@openheaders/core/types';
import type { ListedWorkspace } from '@openheaders/ui/shared/workspace-files';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall, workspace } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  workspace: { current: null as ListedWorkspace | null },
}));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => undefined), broadcast: vi.fn(), presence: vi.fn() },
  };
});

vi.mock('@openheaders/ui/workbench/components/panels/git/use-listed-workspace', () => ({
  useListedWorkspace: () => workspace.current,
}));

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import {
  committedLocalNotice,
  keptLocalNotice,
  leftOutNotice,
} from '@openheaders/ui/workbench/components/panels/git/kept-local';
import NamedFileTitle from '@openheaders/ui/workbench/components/panels/git/NamedFileTitle';
import { useJumpToSource } from '@openheaders/ui/workbench/components/panels/git/use-jump-to-source';
import { useNamedNotices } from '@openheaders/ui/workbench/components/panels/git/use-named-notices';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';

const CREATE = 'requests/orders-col00001/create-order-req00003';
const LIST = 'requests/orders-col00001/list-orders-req00004';
const NOTES = 'notes/orders.md';

const REQUESTS: TreeNode[] = [
  { type: 'request', uid: 'req00003', name: 'Create Order', path: CREATE, method: 'POST' },
  { type: 'request', uid: 'req00004', name: 'List Orders', path: LIST, method: 'GET' },
];

const WORKSPACE: ListedWorkspace = {
  ruleCollections: [],
  templateCollections: [],
  requestCollections: [{ uid: 'col00001', name: 'Orders', path: 'requests/orders-col00001', tree: REQUESTS }],
  specs: [],
  workflows: [],
  liveVariables: [],
  environments: [],
};

const CREATE_ORDER: WorkspaceTreeEntityRefWire = {
  kind: 'request',
  tree: null,
  uid: 'req00003',
  name: 'Create Order',
  method: 'POST',
};

beforeEach(() => {
  workspace.current = WORKSPACE;
  mockCall.mockReset();
});

afterEach(cleanup);

describe('NamedFileTitle', () => {
  it('names an entity’s one file by the entity, with the path on its hover', () => {
    render(<NamedFileTitle messageKey="workbench.gitLog.diff.title" path={`${LIST}/request.yaml`} />);
    const title = screen.getByText('Diff — List Orders');
    expect(title.getAttribute('title')).toBe(`${LIST}/request.yaml`);
  });

  it('names a file of an entity by its name and its part — the manifest is its details', () => {
    render(<NamedFileTitle messageKey="workbench.gitLog.fileHistory.title" path={`${CREATE}/body.json`} />);
    expect(screen.getByText('History: Create Order · Body')).toBeTruthy();
    cleanup();
    render(<NamedFileTitle messageKey="workbench.gitLog.diff.title" path={`${CREATE}/pre-request.js`} />);
    expect(document.body.textContent).toContain('Diff — Create Order · ');
    expect(document.body.textContent).not.toContain('requests/');
  });

  it('a file of the user’s own goes by its path', () => {
    render(<NamedFileTitle messageKey="workbench.gitLog.diff.title" path={NOTES} />);
    expect(screen.getByText(`Diff — ${NOTES}`)).toBeTruthy();
  });
});

describe('Jump to Source’s notice', () => {
  function Jumper({ path, entity }: { path: string | null; entity?: WorkspaceTreeEntityRefWire }) {
    const jump = useJumpToSource('ws00001');
    return (
      <button type="button" onClick={() => jump(path, entity)}>
        jump
      </button>
    );
  }

  it('names the entity when a row gave one and nothing could open it', async () => {
    render(
      <AntApp>
        <Jumper path={`${CREATE}/body.json`} entity={CREATE_ORDER} />
      </AntApp>,
    );
    fireEvent.click(screen.getByText('jump'));
    expect(await screen.findByText('No editor for Create Order')).toBeTruthy();
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('names the path of a file no entity owns', async () => {
    mockCall.mockResolvedValue({ ok: false, reason: 'not-an-entity' });
    render(
      <AntApp>
        <Jumper path={NOTES} />
      </AntApp>,
    );
    fireEvent.click(screen.getByText('jump'));
    expect(await screen.findByText(`No editor for ${NOTES}`)).toBeTruthy();
  });
});

describe('a finished pass’s notices', () => {
  const files: Translate = (key, vars) => `${key} ${String(vars?.files)}`;
  const PATHS = [`${CREATE}/body.json`, `${LIST}/request.yaml`, NOTES];

  it('name each file as the workbench names it, once, after the surface hands them over', async () => {
    const said: Array<string | null> = [];
    function Surface() {
      const { say, holder } = useNamedNotices();
      return (
        <>
          <button
            type="button"
            onClick={() =>
              say((nameOf) => {
                said.push(keptLocalNotice([NOTES], files, nameOf));
                said.push(committedLocalNotice(PATHS, files, nameOf));
                said.push(
                  leftOutNotice(
                    PATHS.map((path) => ({ path })),
                    files,
                    nameOf,
                  ),
                );
              })
            }
          >
            say
          </button>
          {holder}
        </>
      );
    }
    render(<Surface />);
    expect(said).toEqual([]);
    fireEvent.click(screen.getByText('say'));
    await waitFor(() => expect(said).toHaveLength(3));
    expect(said).toEqual([
      `workbench.gitLog.keptLocal ${NOTES}`,
      `workbench.gitLog.applyCommit.localFirst Create Order · Body, List Orders, ${NOTES}`,
      `workbench.gitLog.applyCommit.leftOut Create Order · Body, List Orders, ${NOTES}`,
    ]);
    // Said once: nothing waits, and a later render says nothing more.
    fireEvent.click(screen.getByText('say'));
    await waitFor(() => expect(said).toHaveLength(6));
  });

  it('go by path where no namer is lent', () => {
    expect(committedLocalNotice(PATHS, files)).toBe(`workbench.gitLog.applyCommit.localFirst ${PATHS.join(', ')}`);
    expect(keptLocalNotice([], files)).toBeNull();
  });
});
