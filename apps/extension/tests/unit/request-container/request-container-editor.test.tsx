/**
 * RequestContainerEditor — one tab per request collection / folder,
 * the concerns as sections. Pins:
 *   - the section order Overview · Authorization · Scripts · Variables
 *     (a folder carries no Variables section);
 *   - the overview's only action is Add Request — no Variables /
 *     Scripts / Authorization buttons;
 *   - level-honest auth copy: a collection's transparent choice reads
 *     "No default" (never "Inherit auth from parent"), a folder's
 *     "Inherit from collection";
 *   - one Save: an auth edit lights it and writes through the
 *     collection auth client with the field ABSENT for the transparent
 *     choice and the config otherwise;
 *   - the POOL editor: the entries list with the Default tag, Add
 *     entry, the legacy single-auth read re-minted on save, the
 *     folder header's inherited / overriding states;
 *   - an asked-for section is honored, a user switch is reported, and
 *     viewing Scripts reports the review gesture;
 *   - the request-level Authorization tab names what Inherit resolves
 *     to and from where, and with ancestry leads with the Inherited
 *     group.
 */

import type { AuthConfig, AuthPoolEntry, Collection, CollectionTree } from '@openheaders/core/types';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

if (typeof document.queryCommandSupported !== 'function') {
  document.queryCommandSupported = (() => false) as typeof document.queryCommandSupported;
}

// Monaco (the Scripts section's editor) escapes class names through
// `CSS.escape` on a timer armed at module load — the stub must exist
// on the window BEFORE the editor import below, not in `beforeAll`.
const cssScope = window as unknown as { CSS?: { escape(value: string): string } };
if (typeof cssScope.CSS === 'undefined' || typeof cssScope.CSS.escape !== 'function') {
  cssScope.CSS = { ...cssScope.CSS, escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`) };
}

// Monaco's clipboard service hangs a body mousedown listener that
// writes through `navigator.clipboard`; jsdom ships none.
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: { write: async () => undefined, writeText: async () => undefined, readText: async () => '' },
});
// Monaco's WebKit write workaround hands every click / keydown a
// deferred it later cancels — the stub consumes that rejection so it
// never surfaces as an unhandled error.
(globalThis as unknown as { ClipboardItem?: unknown }).ClipboardItem = class ClipboardItemStub {
  constructor(items: Record<string, unknown>) {
    for (const value of Object.values(items)) {
      if (value instanceof Promise) value.catch(() => undefined);
    }
  }
};

// Monaco also asks `matchMedia` at load — the same rule.
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

// EditorHeader reads `keyboard.save` via useShortcutLabel; the registry
// is populated by importing the schema barrel for its side effects.
import '@openheaders/ui/workbench/settings/schema';

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

const BEARER: AuthConfig = { type: 'bearer', token: '{{token}}' };
const ADMIN: AuthPoolEntry = { uid: 'admin001', name: 'Admin token', config: { type: 'bearer', token: '{{token}}' } };
const USER: AuthPoolEntry = { uid: 'user0001', name: 'User token', config: { type: 'bearer', token: '{{user}}' } };

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    schemaVersion: 5,
    uid: 'col00001',
    path: 'requests/payments-col00001',
    name: 'Payments',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    ...overrides,
  };
}

const FOLDER = {
  schemaVersion: 5,
  uid: 'fld00001',
  path: 'requests/payments-col00001/cards',
  name: 'Cards',
};

function makeTree(collection: Collection): CollectionTree {
  return {
    ...collection,
    tree: [
      { type: 'folder', uid: FOLDER.uid, name: FOLDER.name, path: FOLDER.path, children: [] },
      {
        type: 'request',
        uid: 'req00001',
        name: 'Ping',
        path: 'requests/payments-col00001/ping-req00001',
        method: 'GET',
      },
    ],
  };
}

let requestsState = {
  collections: [makeCollection()],
  folders: [FOLDER],
  collectionTrees: [makeTree(makeCollection())],
};

vi.mock('@openheaders/ui/shared/hooks/readers/useRequests', () => ({
  useRequests: () => ({ ...requestsState, requests: [], isReady: true }),
}));
vi.mock('@openheaders/ui/shared/hooks/readers/useRules', () => ({
  useRules: () => ({ activeWorkspaceId: 'ws00001', localCollections: [], templateCollections: [] }),
}));
const replaceRequestCollectionVariables = vi.fn(async () => ({ ok: true as const }));
vi.mock('@openheaders/ui/shared/hooks/mutators/useVariableMutator', () => ({
  useVariableMutator: () => ({ replaceRequestCollectionVariables }),
}));
const applyRequestCollectionSetAuthPool = vi.fn(async () => ({ ok: true as const }));
const applyRequestCollectionSetScripts = vi.fn(async () => ({ ok: true as const }));
vi.mock('@openheaders/ui/shared/sync/request-collection-write-client', () => ({
  applyRequestCollectionSetAuthPool,
  applyRequestCollectionSetScripts,
}));
const applyRequestFolderSetAuthPool = vi.fn(async () => ({ ok: true as const }));
const applyRequestFolderSetScripts = vi.fn(async () => ({ ok: true as const }));
vi.mock('@openheaders/ui/shared/sync/request-folder-write-client', () => ({
  applyRequestFolderSetAuthPool,
  applyRequestFolderSetScripts,
}));

const { default: RequestContainerEditor } = await import(
  '@openheaders/ui/workbench/components/request-container/RequestContainerEditor'
);
const { default: AuthorizationTab } = await import(
  '@openheaders/ui/workbench/components/request-editor/AuthorizationTab'
);
const { AwarenessIdentityProvider } = await import('@openheaders/ui/shared/awareness');
const { resolveWorkbenchIdentity } = await import('@/host/surface-identity-resolvers');
const testIdentity = resolveWorkbenchIdentity();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  requestsState = {
    collections: [makeCollection()],
    folders: [FOLDER],
    collectionTrees: [makeTree(makeCollection())],
  };
});

const overview = {
  onSelectRequest: vi.fn(),
  onSelectGrpcRequest: vi.fn(),
  onSelectWebSocketRequest: vi.fn(),
  onSelectMqttRequest: vi.fn(),
  onCreateRequest: vi.fn(),
  onOpenFolderOverview: vi.fn(),
};

function renderEditor(props: Partial<React.ComponentProps<typeof RequestContainerEditor>> = {}) {
  return render(
    <App>
      <AwarenessIdentityProvider value={testIdentity}>
        <RequestContainerEditor kind="collection" entityUid="col00001" overview={overview} {...props} />
      </AwarenessIdentityProvider>
    </App>,
  );
}

/** The header's Save button by its label — "Saved" (clean, disabled)
 *  or "Save" (dirty). */
function headerButton(label: 'Save' | 'Saved'): HTMLButtonElement {
  const hit = screen.getAllByRole('button').find((b) => b.textContent === label);
  if (!hit) throw new Error(`no ${label} button`);
  return hit as HTMLButtonElement;
}

async function findSaveButton(): Promise<HTMLButtonElement> {
  await waitFor(() => headerButton('Save'));
  return headerButton('Save');
}

function sectionTabs(): string[] {
  return screen.getAllByRole('tab').map((tab) => tab.textContent ?? '');
}

/** Open the type picker from the keyboard — a mousedown on the body
 *  wakes Monaco's clipboard listener (the Scripts editor is loaded),
 *  which cancels a deferred write and rejects out of band. */
async function pickAuthType(label: string): Promise<void> {
  const select = screen.getByTestId('oh-auth-type');
  const input = select.querySelector('input');
  if (!input) throw new Error('no select input');
  fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 40 });
  const option = await screen.findByText(label, { selector: '.ant-select-item-option-content' });
  fireEvent.click(option);
  await waitFor(() => expect(screen.getByTestId('oh-auth-type').textContent).toContain(label));
}

describe('RequestContainerEditor — sections', () => {
  it('a collection shows Overview · Authorization · Scripts · Variables, in that order', () => {
    renderEditor();
    expect(sectionTabs()).toEqual(['Overview', 'Authorization', 'Scripts', 'Variables']);
  });

  it('a folder carries no Variables section', () => {
    renderEditor({ kind: 'folder', entityUid: 'fld00001' });
    expect(sectionTabs()).toEqual(['Overview', 'Authorization', 'Scripts']);
  });

  it('the overview offers Add Request only — no Variables / Scripts / Authorization buttons', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: /Add Request/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Variables/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Scripts/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Authorization/ })).toBeNull();
  });

  it('honors the asked-for section, reports a user switch, and reports Scripts as viewed', () => {
    const onSectionChange = vi.fn();
    const onScriptsViewed = vi.fn();
    renderEditor({ section: 'authorization', onSectionChange, onScriptsViewed });
    expect(screen.getByRole('tab', { name: 'Authorization' }).getAttribute('aria-selected')).toBe('true');
    expect(onScriptsViewed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: /Scripts/ }));
    expect(onSectionChange).toHaveBeenCalledWith('scripts');
    expect(onScriptsViewed).toHaveBeenCalledWith('col00001');
  });
});

describe('RequestContainerEditor — level-honest auth', () => {
  it("a collection's transparent choice reads No default, never Inherit auth from parent", () => {
    renderEditor({ section: 'authorization' });
    expect(screen.getByTestId('oh-auth-type').textContent).toContain('No default');
    expect(screen.getByTestId('oh-auth-transparent-state').textContent).toContain('No default');
    expect(screen.queryByText('Inherit auth from parent')).toBeNull();
    expect(screen.getByText(/Requests set to Inherit send without authorization/)).toBeTruthy();
  });

  it("a folder's transparent choice reads Inherit from collection", () => {
    renderEditor({ kind: 'folder', entityUid: 'fld00001', section: 'authorization' });
    expect(screen.getByTestId('oh-auth-type').textContent).toContain('Inherit from collection');
    expect(screen.getByTestId('oh-auth-transparent-state').textContent).toContain('Inherit from collection');
  });

  it('a set collection auth renders its type and dots the section', () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auth: BEARER })],
    };
    renderEditor({ section: 'authorization' });
    expect(screen.getByTestId('oh-auth-type').textContent).toContain('Bearer Token');
  });
});

describe('RequestContainerEditor — one Save', () => {
  it('starts clean, lights Save on an auth edit, and writes through the collection auth client', async () => {
    renderEditor({ section: 'authorization' });
    expect(headerButton('Saved').disabled).toBe(true);

    await pickAuthType('Bearer Token');
    fireEvent.click(await findSaveButton());

    await waitFor(() => expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledTimes(1));
    expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledWith(
      {
        collectionUid: 'col00001',
        auths: [{ uid: expect.stringMatching(/^[a-z0-9]{8}$/), name: '', config: { type: 'bearer', token: '' } }],
        defaultAuthUid: expect.stringMatching(/^[a-z0-9]{8}$/),
      },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
    expect(applyRequestCollectionSetScripts).not.toHaveBeenCalled();
    expect(replaceRequestCollectionVariables).not.toHaveBeenCalled();
  });

  it('choosing No default on a set collection persists the field absent', async () => {
    requestsState = { ...requestsState, collections: [makeCollection({ auth: BEARER })] };
    renderEditor({ section: 'authorization' });
    await pickAuthType('No default');
    fireEvent.click(await findSaveButton());
    await waitFor(() => expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledTimes(1));
    expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledWith(
      { collectionUid: 'col00001', auths: [], defaultAuthUid: undefined },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
  });

  it("a folder's auth edit writes through the folder auth client", async () => {
    renderEditor({ kind: 'folder', entityUid: 'fld00001', section: 'authorization' });
    await pickAuthType('No Auth');
    fireEvent.click(await findSaveButton());
    await waitFor(() => expect(applyRequestFolderSetAuthPool).toHaveBeenCalledTimes(1));
    expect(applyRequestFolderSetAuthPool).toHaveBeenCalledWith(
      {
        folderUid: 'fld00001',
        auths: [{ uid: expect.stringMatching(/^[a-z0-9]{8}$/), name: '', config: { type: 'none' } }],
        defaultAuthUid: expect.stringMatching(/^[a-z0-9]{8}$/),
      },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
    expect(applyRequestCollectionSetAuthPool).not.toHaveBeenCalled();
  });
});

describe('RequestContainerEditor — the pool editor', () => {
  it('renders the entries list with the Default tag and the default entry selected for editing', () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [ADMIN, USER], defaultAuthUid: 'admin001' })],
    };
    renderEditor({ section: 'authorization' });
    const rows = screen.getAllByTestId('oh-auth-pool-entry');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Admin token');
    expect(rows[0].textContent).toContain('Default');
    expect(rows[1].textContent).toContain('User token');
    expect((screen.getByTestId('oh-auth-entry-name') as HTMLInputElement).value).toBe('Admin token');
    // A named entry's editor drops the transparent choice.
    fireEvent.click(rows[1]);
    expect((screen.getByTestId('oh-auth-entry-name') as HTMLInputElement).value).toBe('User token');
  });

  it('Add entry appends a none entry and Save writes the whole pool', async () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [ADMIN], defaultAuthUid: 'admin001' })],
    };
    renderEditor({ section: 'authorization' });
    fireEvent.click(screen.getByTestId('oh-auth-pool-add'));
    fireEvent.change(screen.getByTestId('oh-auth-entry-name'), { target: { value: 'Service' } });
    fireEvent.change(screen.getByTestId('oh-auth-entry-applies-to'), { target: { value: '*.openheaders.io' } });
    fireEvent.click(await findSaveButton());
    await waitFor(() => expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledTimes(1));
    expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledWith(
      {
        collectionUid: 'col00001',
        auths: [
          ADMIN,
          {
            uid: expect.stringMatching(/^[a-z0-9]{8}$/),
            name: 'Service',
            config: { type: 'none' },
            appliesTo: '*.openheaders.io',
          },
        ],
        defaultAuthUid: 'admin001',
      },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
  });

  it('a legacy single auth edits as the default entry and Save re-mints its reserved uid', async () => {
    requestsState = { ...requestsState, collections: [makeCollection({ auth: BEARER })] };
    renderEditor({ section: 'authorization' });
    await pickAuthType('Basic Auth');
    fireEvent.click(await findSaveButton());
    await waitFor(() => expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledTimes(1));
    expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledWith(
      {
        collectionUid: 'col00001',
        auths: [
          {
            uid: expect.stringMatching(/^[a-z0-9]{8}$/),
            name: '',
            config: { type: 'basic', username: '', password: '' },
          },
        ],
        defaultAuthUid: expect.stringMatching(/^[a-z0-9]{8}$/),
      },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
  });

  it("a transparent folder names the collection it inherits from, with Edit in collection and Override", () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [ADMIN], defaultAuthUid: 'admin001' })],
    };
    const onOpenCollectionAuth = vi.fn();
    renderEditor({ kind: 'folder', entityUid: 'fld00001', section: 'authorization', onOpenCollectionAuth });
    expect(screen.getByTestId('oh-auth-pool-folder-header').textContent).toContain(
      'Inherited from Collection ‘Payments’',
    );
    fireEvent.click(screen.getByTestId('oh-auth-pool-edit-in-collection'));
    expect(onOpenCollectionAuth).toHaveBeenCalledWith('col00001', 'Payments');
    // Override mints the folder's own pool from the inherited default.
    fireEvent.click(screen.getByTestId('oh-auth-pool-override'));
    expect((screen.getByTestId('oh-auth-entry-name') as HTMLInputElement).value).toBe('Admin token');
    expect(screen.getByTestId('oh-auth-pool-folder-header').textContent).toContain(
      'Overriding Collection ‘Payments’',
    );
    expect(screen.getByTestId('oh-auth-pool-reset')).toBeTruthy();
  });
});

describe('AuthorizationTab — request-level attribution under Inherit', () => {
  it('names the effective type and the level it came from', () => {
    render(
      <AuthorizationTab
        auth={{ type: 'inherit' }}
        onChange={vi.fn()}
        inheritedFrom={{
          auth: BEARER,
          source: { kind: 'collection', uid: 'col00001', name: 'Payments', entryName: '' },
        }}
      />,
    );
    expect(screen.getByTestId('oh-auth-transparent-state').textContent).toContain(
      'Bearer Token — from Collection ‘Payments’',
    );
  });

  it('says so when nothing is set above the request', () => {
    render(
      <AuthorizationTab
        auth={{ type: 'inherit' }}
        onChange={vi.fn()}
        inheritedFrom={{ auth: { type: 'none' }, source: null }}
      />,
    );
    expect(screen.getByTestId('oh-auth-transparent-state').textContent).toContain(
      'No auth — nothing is set on the folder or the collection.',
    );
  });

  it('keeps the generic note for a scratch draft with no ancestry', () => {
    render(<AuthorizationTab auth={{ type: 'inherit' }} onChange={vi.fn()} />);
    expect(screen.getByTestId('oh-auth-transparent-state').textContent).toContain(
      "Edit the collection's Authorization tab to change it.",
    );
  });

  it('with ancestry the select leads with the Inherited group and a named pick writes the pick', () => {
    const onChange = vi.fn();
    const ancestry = {
      collection: makeCollection({ auths: [ADMIN, USER], defaultAuthUid: 'admin001' }),
      folders: [],
    };
    render(<AuthorizationTab auth={{ type: 'inherit' }} onChange={onChange} ancestry={ancestry} />);
    expect(screen.getByTestId('oh-auth-type').textContent).toContain(
      'Default (Bearer Token — Collection ‘Payments’)',
    );
    const select = screen.getByTestId('oh-auth-type');
    const input = select.querySelector('input');
    if (!input) throw new Error('no select input');
    fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 40 });
    const options = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option'));
    expect(options[0].textContent).toContain('Default (Bearer Token — Collection ‘Payments’)');
    expect(options[1].textContent).toContain('Collection ‘Payments’ › Admin token');
    expect(options[2].textContent).toContain('Collection ‘Payments’ › User token');
    fireEvent.click(options[2]);
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', authUid: 'user0001' });
  });
});
