// @vitest-environment jsdom
/**
 * The bind form's line for a folder that is not there, over a mocked
 * bridge: the host is asked once the typed path has stood still — once,
 * for the path that stands — and the line reads the path as the host
 * resolved it. A folder that stands, a host that does not answer and a
 * path typed since raise no line.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: () => () => undefined, broadcast: vi.fn(), presence: vi.fn() },
  };
});

import GitBindForm from '@openheaders/ui/workbench/components/git/GitBindForm';
import { localWorkspaceTreeTransport } from '@openheaders/ui/workbench/components/git/transport';
import { FOLDER_PROBE_SETTLE_MS } from '@openheaders/ui/workbench/components/git/use-folder-to-create';

type Probe = { present: false; missingFolder?: string } | { present: true; workspaceUid: string; name: string };

/** What the host answers a probe of each path; a path it holds no answer for fails. */
let folders: Record<string, Probe>;
/** Paths whose answer the host holds back, each with the call that lets it go. */
let held: Map<string, (probe: Probe) => void>;

const probed = (): string[] =>
  mockCall.mock.calls.filter(([type]) => type === 'oh.workspaceTree.probe').map(([, payload]) => payload.rootDir);

const type = (value: string): void => {
  fireEvent.change(screen.getByTestId('git-tool-bind-path-input'), { target: { value } });
};

const wait = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const settle = (): Promise<void> => wait(FOLDER_PROBE_SETTLE_MS);

const line = (): string | null => screen.queryByTestId('git-tool-bind-will-create')?.textContent ?? null;

beforeEach(() => {
  vi.useFakeTimers();
  folders = {};
  held = new Map();
  mockCall.mockReset();
  mockCall.mockImplementation(async (verb: string, payload: { rootDir: string }) => {
    if (verb === 'oh.workspaceTree.probe' && held.has(payload.rootDir)) {
      return new Promise<Probe>((letGo) => held.set(payload.rootDir, letGo));
    }
    const answer = verb === 'oh.workspaceTree.probe' ? folders[payload.rootDir] : undefined;
    if (answer === undefined) throw new Error('no answer');
    return answer;
  });
  render(
    <GitBindForm
      call={localWorkspaceTreeTransport}
      workspaceId="ws-john-doe"
      allowFolderPicker={false}
      onBound={() => undefined}
      onAdopted={() => undefined}
      testidPrefix="git-tool-bind"
    />,
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('GitBindForm — a folder that is not there', () => {
  it('says the folder will be created, with the path as the host resolves it', async () => {
    folders['/private/tmp/john-doe/ws'] = { present: false, missingFolder: 'C:\\private\\tmp\\john-doe\\ws' };
    type('  /private/tmp/john-doe/ws ');
    expect(line()).toBeNull();
    await settle();
    expect(line()).toBe('Folder will be created: C:\\private\\tmp\\john-doe\\ws');
  });

  it('asks the host once, for the path that stood still', async () => {
    folders['/srv/ws'] = { present: false, missingFolder: '/srv/ws' };
    type('/s');
    await wait(FOLDER_PROBE_SETTLE_MS - 1);
    type('/srv');
    await wait(FOLDER_PROBE_SETTLE_MS - 1);
    type('/srv/ws');
    await wait(FOLDER_PROBE_SETTLE_MS - 1);
    expect(probed()).toEqual([]);
    await wait(1);
    expect(probed()).toEqual(['/srv/ws']);
  });

  it('an answer that lands after a newer path was answered is not taken over it', async () => {
    folders['/srv/new'] = { present: false, missingFolder: '/srv/new' };
    held.set('/srv/slow', () => undefined);
    type('/srv/slow');
    await settle();
    type('/srv/new');
    await settle();
    expect(line()).toBe('Folder will be created: /srv/new');
    await act(async () => {
      held.get('/srv/slow')?.({ present: false, missingFolder: '/srv/slow' });
    });
    expect(line()).toBe('Folder will be created: /srv/new');
  });

  it('says nothing of a folder that stands, a folder that is a workspace, or a host that does not answer', async () => {
    folders['/srv/empty'] = { present: false };
    folders['/srv/team'] = { present: true, workspaceUid: 'wsaaaaaa', name: 'Team' };
    for (const path of ['/srv/empty', '/srv/team', '/srv/unanswered']) {
      type(path);
      await settle();
      expect(line()).toBeNull();
    }
    expect(probed()).toEqual(['/srv/empty', '/srv/team', '/srv/unanswered']);
  });

  it('the line of a path typed before is not said under the path typed now', async () => {
    folders['/srv/new'] = { present: false, missingFolder: '/srv/new' };
    folders['/srv'] = { present: false };
    type('/srv/new');
    await settle();
    expect(line()).toBe('Folder will be created: /srv/new');
    type('/srv');
    expect(line()).toBeNull();
    await settle();
    expect(line()).toBeNull();
    type('');
    await settle();
    expect(probed()).toEqual(['/srv/new', '/srv']);
  });
});
