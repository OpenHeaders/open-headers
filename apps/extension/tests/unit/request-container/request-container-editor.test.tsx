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
 *   - an asked-for section is honored, a user switch is reported, and
 *     viewing Scripts reports the review gesture;
 *   - the request-level Authorization tab names what Inherit resolves
 *     to and from where.
 */

import type { AuthConfig, Collection, CollectionTree } from '@openheaders/core/types';
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
const applyRequestCollectionSetAuth = vi.fn(async () => ({ ok: true as const }));
const applyRequestCollectionSetScripts = vi.fn(async () => ({ ok: true as const }));
vi.mock('@openheaders/ui/shared/sync/request-collection-write-client', () => ({
  applyRequestCollectionSetAuth,
  applyRequestCollectionSetScripts,
}));
const applyRequestFolderSetAuth = vi.fn(async () => ({ ok: true as const }));
const applyRequestFolderSetScripts = vi.fn(async () => ({ ok: true as const }));
vi.mock('@openheaders/ui/shared/sync/request-folder-write-client', () => ({
  applyRequestFolderSetAuth,
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

    await waitFor(() => expect(applyRequestCollectionSetAuth).toHaveBeenCalledTimes(1));
    expect(applyRequestCollectionSetAuth).toHaveBeenCalledWith(
      { collectionUid: 'col00001', auth: { type: 'bearer', token: '' } },
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
    await waitFor(() => expect(applyRequestCollectionSetAuth).toHaveBeenCalledTimes(1));
    expect(applyRequestCollectionSetAuth).toHaveBeenCalledWith(
      { collectionUid: 'col00001', auth: undefined },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
  });

  it("a folder's auth edit writes through the folder auth client", async () => {
    renderEditor({ kind: 'folder', entityUid: 'fld00001', section: 'authorization' });
    await pickAuthType('No Auth');
    fireEvent.click(await findSaveButton());
    await waitFor(() => expect(applyRequestFolderSetAuth).toHaveBeenCalledTimes(1));
    expect(applyRequestFolderSetAuth).toHaveBeenCalledWith(
      { folderUid: 'fld00001', auth: { type: 'none' } },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
    expect(applyRequestCollectionSetAuth).not.toHaveBeenCalled();
  });
});

describe('AuthorizationTab — request-level attribution under Inherit', () => {
  it('names the effective type and the level it came from', () => {
    render(
      <AuthorizationTab
        auth={{ type: 'inherit' }}
        onChange={vi.fn()}
        inheritedFrom={{ auth: BEARER, source: { kind: 'collection', name: 'Payments' } }}
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
});
