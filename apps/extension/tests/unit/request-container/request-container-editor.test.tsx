/**
 * RequestContainerEditor — one tab per request collection / folder,
 * the concerns as sections. Pins:
 *   - the section order Overview · Authorization · Scripts · Variables
 *     (a folder carries no Variables section);
 *   - the overview's only action is Add Request — no Variables /
 *     Scripts / Authorization buttons;
 *   - the empty state: the type card grid on a transparent container,
 *     a card minting the default entry, one Save writing it through
 *     the level's auth client;
 *   - the POOL editor: the entries list with the Default tag, the `+`
 *     type dropdown, the Auth type row re-seeding + relabelling, ⋯
 *     rename / make default / delete, the legacy single-auth read
 *     re-minted on save;
 *   - a folder inheriting: the NEAREST ancestor pool read-only with
 *     the Inherited tag and the Edit-in opener, Change minting the
 *     folder's own pool, Reset returning to inherited;
 *   - an asked-for section is honored, a user switch is reported, and
 *     viewing Scripts reports the review gesture;
 *   - the Settings section: the four kind sub-tabs over the request
 *     rows (no managed sheet, no script-mode, no trusted-roots row, no
 *     request-only rows), a shared knob edited on one sub-tab reading
 *     on the others, Save handing the write client the changed knobs
 *     alone (a cleared knob as an unset), the rail dot on the per-knob
 *     flags, a folder's rows showing the collection's values as
 *     placeholders with the inherited line and the Edit-in opener;
 *   - the request-level Authorization tab's Inherit pane names the
 *     resolved entry with the Inherited tag, the Edit-in opener and
 *     the inert form, and with ancestry the select lists the entries
 *     by name (the default tagged) over the own types.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { scriptSlotPath } from '@openheaders/core/scripts';
import type { AuthConfig, AuthPoolEntry, Collection, CollectionTree } from '@openheaders/core/types';
import type { OAuthBundlesContextValue } from '@openheaders/ui/context';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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

const FOLDER: {
  schemaVersion: number;
  uid: string;
  path: string;
  name: string;
  auths?: AuthPoolEntry[];
  defaultAuthUid?: string;
} = {
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
// The Scripts section's Monaco CodeEditor as a textarea (the sibling
// specs' idiom) — the rail and the draft's write path are the contract
// here, not Monaco, whose language workers do not run under jsdom.
vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (next: string) => void }) => (
    <textarea data-testid="code-editor" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));
const replaceRequestCollectionVariables = vi.fn(async () => ({ ok: true as const }));
vi.mock('@openheaders/ui/shared/hooks/mutators/useVariableMutator', () => ({
  useVariableMutator: () => ({ replaceRequestCollectionVariables }),
}));
const applyRequestCollectionSetAuthPool = vi.fn(async () => ({ ok: true as const }));
const applyRequestCollectionSetScripts = vi.fn(async () => ({ ok: true as const }));
const applyRequestCollectionSetSettings = vi.fn(async () => ({ ok: true as const }));
vi.mock('@openheaders/ui/shared/sync/request-collection-write-client', () => ({
  applyRequestCollectionSetAuthPool,
  applyRequestCollectionSetScripts,
  applyRequestCollectionSetSettings,
}));
const applyRequestFolderSetAuthPool = vi.fn(async () => ({ ok: true as const }));
const applyRequestFolderSetScripts = vi.fn(async () => ({ ok: true as const }));
const applyRequestFolderSetSettings = vi.fn(async () => ({ ok: true as const }));
vi.mock('@openheaders/ui/shared/sync/request-folder-write-client', () => ({
  applyRequestFolderSetAuthPool,
  applyRequestFolderSetScripts,
  applyRequestFolderSetSettings,
}));

const { default: RequestContainerEditor } = await import(
  '@openheaders/ui/workbench/components/request-container/RequestContainerEditor'
);
const { default: AuthorizationTab } = await import(
  '@openheaders/ui/workbench/components/request-editor/AuthorizationTab'
);
const { AwarenessIdentityProvider } = await import('@openheaders/ui/shared/awareness');
const { OAuthBundlesContext } = await import('@openheaders/ui/context');
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
  onSelectGraphqlRequest: vi.fn(),
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

describe('RequestContainerEditor — sections', () => {
  it('a collection shows Overview · Authorization · Scripts · Settings · Variables, in that order', () => {
    renderEditor();
    expect(sectionTabs()).toEqual(['Overview', 'Authorization', 'Scripts', 'Settings', 'Variables']);
  });

  it('a folder carries no Variables section', () => {
    renderEditor({ kind: 'folder', entityUid: 'fld00001' });
    expect(sectionTabs()).toEqual(['Overview', 'Authorization', 'Scripts', 'Settings']);
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

  // The section wrapper — the padded box under the tab strip. 100% tall
  // AND padded, it must be border-box, or it runs 48px past its clipped
  // parent and the pane's bottom edge is cut off.
  const sectionOf = (node: HTMLElement): HTMLElement | null => {
    let el: HTMLElement | null = node.parentElement;
    while (el && el.style.padding !== '24px') el = el.parentElement;
    return el;
  };

  it('the Scripts section is a border-box pane; the four-group rail scrolls on its own, the editor keeps the pane', () => {
    renderEditor({ section: 'scripts' });
    const rail = screen.getByTestId('oh-script-rail');
    expect(screen.getAllByTestId('oh-script-rail-group')).toHaveLength(4);
    expect(rail.style.overflowY).toBe('auto');
    const section = sectionOf(rail);
    expect(section?.style.boxSizing).toBe('border-box');
    expect(section?.style.overflow).toBe('');
  });

  it('an edited session slot dots its own rail row and rides Save alone — the untouched slots never write', async () => {
    renderEditor({ section: 'scripts' });
    expect(screen.queryByTestId('oh-script-unsaved-dot')).toBeNull();
    const rows = screen.getAllByTestId('oh-script-rail-row');
    const publishRow = rows.find((row) => row.firstChild?.textContent === 'Before publish');
    if (publishRow === undefined) throw new Error('no Before publish row');
    fireEvent.click(publishRow);
    fireEvent.change(screen.getByTestId('code-editor'), { target: { value: 'oh.setTopic("sensors/1/temp")' } });
    const dots = screen.getAllByTestId('oh-script-unsaved-dot');
    expect(dots).toHaveLength(1);
    expect(publishRow.querySelector('[data-testid="oh-script-unsaved-dot"]')).not.toBeNull();

    fireEvent.click(await findSaveButton());
    await waitFor(() => expect(applyRequestCollectionSetScripts).toHaveBeenCalledTimes(1));
    expect(applyRequestCollectionSetScripts).toHaveBeenCalledWith(
      {
        collectionUid: 'col00001',
        updates: [{ path: scriptSlotPath('mqtt-before-publish'), value: 'oh.setTopic("sensors/1/temp")' }],
      },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
  });

  it('the Authorization section is the same border-box pane; the empty grid scrolls itself', () => {
    renderEditor({ section: 'authorization' });
    const empty = screen.getByTestId('oh-auth-pool-empty');
    expect(empty.style.overflowY).toBe('auto');
    const section = sectionOf(empty);
    expect(section?.style.boxSizing).toBe('border-box');
    expect(section?.style.overflow).toBe('');
  });

  it('an own pool fills the pane, the entries rail and the entry body each scrolling on their own', () => {
    renderEditor({ section: 'authorization' });
    fireEvent.click(
      screen.getAllByTestId('oh-auth-type-card').find((c) => c.getAttribute('data-type') === 'jwt') as HTMLElement,
    );
    const pool = screen.getByTestId('oh-auth-pool');
    expect(pool.style.flexGrow).toBe('1');
    expect(pool.style.minHeight).toBe('0px');
    expect(screen.getByTestId('oh-auth-pool-rail').style.overflowY).toBe('auto');
    expect(screen.getByTestId('oh-auth-pool-body').style.overflowY).toBe('auto');
  });
});

/** Open a type select from the keyboard and pick `label`. */
async function pickSelectOption(testId: string, label: string): Promise<void> {
  const select = screen.getByTestId(testId);
  const input = select.querySelector('input');
  if (!input) throw new Error('no select input');
  fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 40 });
  const option = await screen.findByText(label, {
    selector: '.ant-select-item-option-content *, .ant-select-item-option-content',
  });
  fireEvent.click(option);
  await waitFor(() => expect(screen.getByTestId(testId).textContent).toContain(label));
}

/** Open a dropdown trigger and click the menu item labelled `label` —
 *  antd keeps closed overlays mounted (a just-unmounted trigger's
 *  overlay lingers through its leave motion too), so the LAST open
 *  dropdown's item — the one just opened — is the one to click. */
async function pickMenuItem(trigger: HTMLElement, label: string): Promise<void> {
  fireEvent.click(trigger);
  const item = await waitFor(() => {
    const open = screen
      .getAllByText(label, { selector: '.ant-dropdown-menu-item *' })
      .filter((el) => !el.closest('.ant-dropdown')?.classList.contains('ant-dropdown-hidden'));
    if (open.length === 0) throw new Error(`no open menu item ${label}`);
    return open[open.length - 1];
  });
  fireEvent.click(item);
}

function entryRows(): HTMLElement[] {
  return screen.getAllByTestId('oh-auth-pool-entry');
}

describe('RequestContainerEditor — the Settings section', () => {
  // The node runtime: the TLS & trust group (SSL certificate
  // verification — one row per kind, each kind's own value) renders
  // on every sub-tab.
  beforeEach(() => {
    registerCapability('requestRuntime', () => 'node');
  });
  afterEach(() => {
    unregisterCapability('requestRuntime');
  });

  const kindTabs = (): string[] =>
    within(screen.getByTestId('oh-container-settings-kinds'))
      .getAllByRole('tab')
      .map((tab) => tab.textContent ?? '');
  const sslSwitch = (prefix: string): HTMLElement => screen.getByTestId(`${prefix}-ssl-verify`);
  const timeoutKnob = (): HTMLInputElement =>
    screen.getByRole('combobox', { name: 'Request timeout' }) as HTMLInputElement;
  const settingsRailTab = (): HTMLElement => screen.getByRole('tab', { name: /Settings/ });
  // The picked sub-tab is session memory (a reading preference that
  // survives the section's remount) — every leg opens on HTTP itself.
  const renderSettings = (props: Partial<React.ComponentProps<typeof RequestContainerEditor>> = {}) => {
    const rendered = renderEditor({ section: 'settings', ...props });
    fireEvent.click(screen.getByRole('tab', { name: 'HTTP · GraphQL' }));
    return rendered;
  };

  it('carries the four kind sub-tabs, HTTP first, over the request rows — no managed sheet, no script-mode row, no trusted-roots row', () => {
    renderSettings();
    // The HTTP sub-tab names its GraphQL flavor — a GraphQL request reads
    // the `http` slice (the wire-family law), never a fifth slice.
    expect(kindTabs()).toEqual(['HTTP · GraphQL', 'WebSocket', 'MQTT', 'gRPC']);
    expect(timeoutKnob()).toBeTruthy();
    expect(sslSwitch('request')).toBeTruthy();
    expect(screen.queryByTestId('oh-managed-scripts-row')).toBeNull();
    expect(screen.queryByTestId('oh-script-mode-select')).toBeNull();
    expect(screen.queryByTestId('request-trusted-roots')).toBeNull();
    expect(screen.queryByTestId('oh-cookie-jar-row')).toBeNull();
  });

  it('the session sub-tabs leave the request-only rows out and show every flavor’s rows', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('tab', { name: 'WebSocket' }));
    expect(screen.queryByTestId('websocket-subprotocols')).toBeNull();
    expect(screen.queryByTestId('websocket-namespace')).toBeNull();
    expect(screen.getByTestId('websocket-handshake-path')).toBeTruthy();
    expect(screen.getByTestId('websocket-heartbeat-message')).toBeTruthy();
    expect(screen.queryByTestId('websocket-trusted-roots')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'MQTT' }));
    expect(screen.queryByTestId('mqtt-client-id')).toBeNull();
    expect(screen.getByTestId('mqtt-session-expiry').hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByRole('tab', { name: 'gRPC' }));
    expect(screen.queryByTestId('grpc-authority')).toBeNull();
    expect(screen.queryByTestId('grpc-send-invalid-message')).toBeNull();
    expect(screen.queryByTestId('grpc-managed-compression')).toBeNull();
    expect(headerButton('Saved').disabled).toBe(true);
  });

  it('a knob edited on one sub-tab is that kind’s alone; the sub-tab and rail dots follow the per-knob flags', () => {
    renderSettings();
    expect(screen.queryByTestId('oh-section-unsaved')).toBeNull();
    expect(sslSwitch('request').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sslSwitch('request'));
    expect(sslSwitch('request').getAttribute('aria-checked')).toBe('false');
    // The rail's Settings tab counts the one set knob, unsaved; the
    // HTTP sub-tab dots unsaved — and no other kind's: the HTTP
    // slice's verification is HTTP's alone (the per-kind law).
    expect(within(settingsRailTab()).getByTestId('oh-section-count-unsaved').textContent).toBe('1');
    expect(
      within(screen.getByTestId('oh-container-settings-kind-http')).getByTestId('oh-section-unsaved'),
    ).toBeTruthy();
    for (const kind of ['websocket', 'mqtt', 'grpc']) {
      expect(
        within(screen.getByTestId(`oh-container-settings-kind-${kind}`)).queryByTestId('oh-section-unsaved'),
      ).toBeNull();
    }
    fireEvent.click(screen.getByRole('tab', { name: 'WebSocket' }));
    expect(sslSwitch('websocket').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'MQTT' }));
    expect(sslSwitch('mqtt').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('tab', { name: 'gRPC' }));
    expect(sslSwitch('grpc').getAttribute('aria-checked')).toBe('true');
    // Back on HTTP the row's reset clears the knob — nothing unsaved.
    fireEvent.click(screen.getByRole('tab', { name: 'HTTP · GraphQL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset SSL certificate verification to default' }));
    expect(screen.queryByTestId('oh-section-unsaved')).toBeNull();
    expect(headerButton('Saved').disabled).toBe(true);
  });

  it('Save hands the write client the changed knobs alone — a cleared knob rides as an unset', async () => {
    requestsState = {
      ...requestsState,
      collections: [
        makeCollection({
          settings: {
            http: { timeoutMs: 30_000, sslVerification: false, maxRedirects: 5 },
            grpc: { timeoutMs: 2_000 },
          },
        }),
      ],
    };
    renderSettings();
    expect(within(settingsRailTab()).queryByTestId('oh-section-count-unsaved')).toBeNull();
    expect(timeoutKnob().value).toBe('30 s');
    fireEvent.click(sslSwitch('request'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset Request timeout to default' }));
    // Three knobs still set across two kinds (the cleared timeout
    // left the count), two of them unsaved.
    expect(within(settingsRailTab()).getByTestId('oh-section-count-unsaved').textContent).toBe('3');

    fireEvent.click(await findSaveButton());
    await waitFor(() => expect(applyRequestCollectionSetSettings).toHaveBeenCalledTimes(1));
    expect(applyRequestCollectionSetSettings).toHaveBeenCalledWith(
      {
        collectionUid: 'col00001',
        updates: [
          { kind: 'http', key: 'sslVerification', value: true },
          { kind: 'http', key: 'timeoutMs', value: undefined },
        ],
      },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
    expect(applyRequestCollectionSetAuthPool).not.toHaveBeenCalled();
    expect(applyRequestCollectionSetScripts).not.toHaveBeenCalled();
  });

  it('a folder shows the collection’s values of the kind as placeholders with the inherited line; Edit in parent opens the source; its own value overrides with the line and writes through the folder client', async () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ settings: { http: { timeoutMs: 30_000, sslVerification: false } } })],
    };
    const onOpenContainerSettings = vi.fn();
    renderSettings({ kind: 'folder', entityUid: 'fld00001', onOpenContainerSettings });
    // The inherited value reads as the placeholder (no own value, no
    // dot); the switch shows the inherited state.
    expect(timeoutKnob().value).toBe('');
    // rc-select renders the placeholder as a sibling span, not an
    // input attribute.
    expect(screen.getByText('30 s')).toBeTruthy();
    expect(sslSwitch('request').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByTestId('oh-setting-modified-dot')).toBeNull();
    const notes = screen.getAllByTestId('oh-inherited-setting-note');
    expect(notes.map((note) => note.getAttribute('data-key'))).toEqual(['sslVerification', 'timeoutMs']);
    expect(notes[1].textContent).toContain('Inherited from Collection ‘Payments’');
    fireEvent.click(within(notes[1]).getByTestId('oh-inherited-setting-edit-in-parent'));
    expect(onOpenContainerSettings).toHaveBeenCalledWith('collection', 'col00001', 'Payments');
    expect(headerButton('Saved').disabled).toBe(true);

    // The collection's HTTP slice says nothing to the WebSocket rows.
    fireEvent.click(screen.getByRole('tab', { name: 'WebSocket' }));
    expect(screen.queryByTestId('oh-inherited-setting-note')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'HTTP · GraphQL' }));

    // The folder's own timeout shadows the collection's — the line
    // turns into the overrides reading, naming the value it shadows;
    // Save writes the one knob through the folder client.
    fireEvent.change(timeoutKnob(), { target: { value: '5s' } });
    fireEvent.blur(timeoutKnob());
    expect(timeoutKnob().value).toBe('5 s');
    const after = screen.getAllByTestId('oh-inherited-setting-note');
    expect(after.map((n) => `${n.getAttribute('data-key')}:${n.getAttribute('data-reading')}`)).toEqual([
      'sslVerification:inherited',
      'timeoutMs:overrides',
    ]);
    expect(after[1].textContent).toContain('Overrides Collection ‘Payments’ (30 s)');
    // One level above sets it — no chain to list.
    expect(within(after[1]).queryByTestId('oh-inherited-setting-chain')).toBeNull();
    fireEvent.click(await findSaveButton());
    await waitFor(() => expect(applyRequestFolderSetSettings).toHaveBeenCalledTimes(1));
    expect(applyRequestFolderSetSettings).toHaveBeenCalledWith(
      { folderUid: 'fld00001', updates: [{ kind: 'http', key: 'timeoutMs', value: 5000 }] },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
    expect(applyRequestCollectionSetSettings).not.toHaveBeenCalled();
  });

  it('a collection’s rows read the runtime defaults — no inherited line anywhere', () => {
    renderSettings();
    expect(screen.getByText('No limit')).toBeTruthy();
    expect(screen.queryByTestId('oh-inherited-setting-note')).toBeNull();
  });
});

describe('RequestContainerEditor — the empty state', () => {
  it('a transparent collection shows the type card grid; a card mints the default entry, Save writes it', async () => {
    renderEditor({ section: 'authorization' });
    const empty = screen.getByTestId('oh-auth-pool-empty');
    expect(empty.textContent).toContain('No auth configured');
    expect(empty.textContent).toContain('in this collection');
    expect(headerButton('Saved').disabled).toBe(true);
    const cards = screen.getAllByTestId('oh-auth-type-card');
    expect(cards.map((c) => c.getAttribute('data-type'))).toEqual([
      'api-key',
      'basic',
      'bearer',
      'digest',
      'hawk',
      'http-signature',
      'jwt',
      'oauth1',
      'oauth2',
      'aws-sigv4',
      'edgegrid',
      'asap',
      'none',
    ]);
    const sections = screen.getAllByTestId('oh-auth-type-section');
    expect(sections.map((s) => s.querySelectorAll('[data-testid="oh-auth-type-card"]').length)).toEqual([9, 3, 1]);
    fireEvent.click(cards.find((c) => c.getAttribute('data-type') === 'bearer') as HTMLElement);

    expect(screen.queryByTestId('oh-auth-pool-empty')).toBeNull();
    expect(entryRows()).toHaveLength(1);
    expect(entryRows()[0].textContent).toContain('Bearer Token');
    expect(entryRows()[0].textContent).toContain('Default');
    expect(screen.getByTestId('oh-auth-entry-heading').textContent).toBe('Bearer Token');

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

  it('a folder with nothing set above shows the folder subtitle and writes through the folder client', async () => {
    renderEditor({ kind: 'folder', entityUid: 'fld00001', section: 'authorization' });
    expect(screen.getByTestId('oh-auth-pool-empty').textContent).toContain('in this folder');
    expect(screen.queryByTestId('oh-auth-pool-change')).toBeNull();
    const noneCard = screen.getAllByTestId('oh-auth-type-card').find((c) => c.getAttribute('data-type') === 'none');
    fireEvent.click(noneCard as HTMLElement);
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
  it('lists the entries with the Default tag, selects the default for the pane, and a click selects another', () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [ADMIN, USER], defaultAuthUid: 'admin001' })],
    };
    renderEditor({ section: 'authorization' });
    const rows = entryRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Admin token');
    expect(rows[0].textContent).toContain('Default');
    expect(rows[1].textContent).not.toContain('Default');
    expect(screen.getByTestId('oh-auth-entry-heading').textContent).toBe('Admin token');
    expect(screen.getByTestId('oh-auth-entry-type').textContent).toContain('Bearer Token');
    fireEvent.click(rows[1]);
    expect(screen.getByTestId('oh-auth-entry-heading').textContent).toBe('User token');
    expect(screen.queryByTestId('oh-auth-inherited-form')).toBeNull();
  });

  it('the Auth types title’s (i) lists every type the + offers, in its order, with its summary', () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [ADMIN], defaultAuthUid: 'admin001' })],
    };
    renderEditor({ section: 'authorization' });
    fireEvent.click(screen.getByLabelText('About Auth types'));
    const popover = document.querySelector('.oh-info-popover');
    if (!popover) throw new Error('no popover');
    expect(popover.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Authorization');
    expect(popover.querySelector('.oh-info-popover-title')?.textContent).toBe('Auth types');
    expect(
      Array.from(popover.querySelectorAll('.oh-info-popover-section-item-label')).map((el) => el.textContent),
    ).toEqual([
      'API Key',
      'Basic Auth',
      'Bearer Token',
      'Digest Auth',
      'Hawk Authentication',
      'HTTP Message Signature',
      'JWT Bearer',
      'OAuth 1.0',
      'OAuth 2.0',
      'AWS Signature v4',
      'Akamai EdgeGrid',
      'ASAP (Atlassian)',
      'No Auth',
    ]);
    // The list carries no example card — a type's card needs a
    // concrete config, and the entry's Auth Type row keeps it.
    expect(popover.querySelector('.oh-info-eg')).toBeNull();
    expect(popover.querySelectorAll('.oh-info-popover-section-item-desc')[2]?.textContent).toBe(
      'The token is sent verbatim after the Bearer scheme in the Authorization header on every send.',
    );
  });

  it('+ offers the types; a pick appends a seeded entry, selected, and Save writes the whole pool', async () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [ADMIN], defaultAuthUid: 'admin001' })],
    };
    renderEditor({ section: 'authorization' });
    await pickMenuItem(screen.getByTestId('oh-auth-pool-add'), 'Basic Auth');
    expect(entryRows()).toHaveLength(2);
    expect(entryRows()[1].textContent).toContain('Basic Auth');
    expect(screen.getByTestId('oh-auth-entry-heading').textContent).toBe('Basic Auth');
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
            name: '',
            config: { type: 'basic', username: '', password: '' },
            appliesTo: '*.openheaders.io',
          },
        ],
        defaultAuthUid: 'admin001',
      },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
  });

  it('the Auth type row re-seeds the config and relabels an unnamed row; a named row keeps its name', async () => {
    const unnamed: AuthPoolEntry = { uid: 'plain001', name: '', config: { type: 'bearer', token: 'x' } };
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [unnamed, ADMIN], defaultAuthUid: 'plain001' })],
    };
    renderEditor({ section: 'authorization' });
    expect(entryRows()[0].textContent).toContain('Bearer Token');
    await pickSelectOption('oh-auth-entry-type', 'Basic Auth');
    expect(entryRows()[0].textContent).toContain('Basic Auth');
    expect(screen.getByTestId('oh-auth-entry-heading').textContent).toBe('Basic Auth');

    fireEvent.click(entryRows()[1]);
    await pickSelectOption('oh-auth-entry-type', 'API Key');
    expect(entryRows()[1].textContent).toContain('Admin token');

    fireEvent.click(await findSaveButton());
    await waitFor(() => expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledTimes(1));
    expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledWith(
      {
        collectionUid: 'col00001',
        auths: [
          { uid: 'plain001', name: '', config: { type: 'basic', username: '', password: '' } },
          { uid: 'admin001', name: 'Admin token', config: { type: 'api-key', key: '', value: '', in: 'header' } },
        ],
        defaultAuthUid: 'plain001',
      },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
  });

  it('⋯ renames inline, makes default, and deletes; deleting the last entry returns to the empty state', async () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [ADMIN, USER], defaultAuthUid: 'admin001' })],
    };
    renderEditor({ section: 'authorization' });
    const actionsOf = (row: number) => screen.getAllByTestId('oh-auth-pool-entry-actions')[row];

    await pickMenuItem(actionsOf(1), 'Rename');
    const rename = screen.getByTestId('oh-auth-pool-rename') as HTMLInputElement;
    expect(rename.value).toBe('User token');
    fireEvent.change(rename, { target: { value: 'Service token' } });
    fireEvent.keyDown(rename, { key: 'Enter' });
    expect(entryRows()[1].textContent).toContain('Service token');

    await pickMenuItem(actionsOf(1), 'Make default');
    expect(entryRows()[0].textContent).not.toContain('Default');
    expect(entryRows()[1].textContent).toContain('Default');

    await pickMenuItem(actionsOf(0), 'Delete');
    expect(entryRows()).toHaveLength(1);
    expect(entryRows()[0].textContent).toContain('Service token');
    await pickMenuItem(actionsOf(0), 'Delete');
    expect(screen.getByTestId('oh-auth-pool-empty')).toBeTruthy();

    fireEvent.click(await findSaveButton());
    await waitFor(() => expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledTimes(1));
    expect(applyRequestCollectionSetAuthPool).toHaveBeenCalledWith(
      { collectionUid: 'col00001', auths: [], defaultAuthUid: undefined },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );
  });

  it('a legacy single auth edits as the default entry and Save re-mints its reserved uid', async () => {
    requestsState = { ...requestsState, collections: [makeCollection({ auth: BEARER })] };
    renderEditor({ section: 'authorization' });
    expect(entryRows()).toHaveLength(1);
    expect(entryRows()[0].textContent).toContain('Bearer Token');
    await pickSelectOption('oh-auth-entry-type', 'Basic Auth');
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
});

describe('RequestContainerEditor — a folder inheriting', () => {
  it('lists the nearest ancestor pool read-only, tags the entry Inherited, and Edit in parent opens the source', () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [ADMIN, USER], defaultAuthUid: 'user0001' })],
    };
    const onOpenContainerAuth = vi.fn();
    renderEditor({ kind: 'folder', entityUid: 'fld00001', section: 'authorization', onOpenContainerAuth });
    expect(screen.queryByTestId('oh-auth-pool-empty')).toBeNull();
    const rows = entryRows();
    expect(rows).toHaveLength(2);
    expect(rows[1].textContent).toContain('Default');
    expect(screen.queryAllByTestId('oh-auth-pool-entry-actions')).toHaveLength(0);
    expect(screen.queryByTestId('oh-auth-pool-add')).toBeNull();
    expect(screen.getByTestId('oh-auth-pool-change')).toBeTruthy();
    expect(screen.getByTestId('oh-auth-entry-heading').textContent).toBe('User token');
    expect(screen.getByTestId('oh-auth-entry-inherited-tag').textContent).toBe('Inherited');
    expect(screen.getByTestId('oh-auth-inherited-form').hasAttribute('inert')).toBe(true);
    fireEvent.click(rows[0]);
    expect(screen.getByTestId('oh-auth-entry-heading').textContent).toBe('Admin token');
    expect(screen.getByTestId('oh-auth-pool-edit-in-source').textContent).toContain('Edit in parent');
    fireEvent.click(screen.getByTestId('oh-auth-pool-edit-in-source'));
    expect(onOpenContainerAuth).toHaveBeenCalledWith('collection', 'col00001', 'Payments');
    expect(headerButton('Saved').disabled).toBe(true);
  });

  it('the nearest ancestor wins — a folder under a folder with its own pool inherits that folder', () => {
    const collection = makeCollection({ auths: [ADMIN], defaultAuthUid: 'admin001' });
    const SUB = { schemaVersion: 5, uid: 'fld00002', path: 'requests/payments-col00001/cards/eu', name: 'EU' };
    requestsState = {
      collections: [collection],
      folders: [{ ...FOLDER, auths: [USER], defaultAuthUid: 'user0001' }, SUB],
      collectionTrees: [
        {
          ...collection,
          tree: [
            {
              type: 'folder',
              uid: FOLDER.uid,
              name: FOLDER.name,
              path: FOLDER.path,
              children: [{ type: 'folder', uid: SUB.uid, name: SUB.name, path: SUB.path, children: [] }],
            },
          ],
        },
      ],
    };
    const onOpenContainerAuth = vi.fn();
    renderEditor({ kind: 'folder', entityUid: 'fld00002', section: 'authorization', onOpenContainerAuth });
    expect(entryRows()).toHaveLength(1);
    expect(entryRows()[0].textContent).toContain('User token');
    fireEvent.click(screen.getByTestId('oh-auth-pool-edit-in-source'));
    expect(onOpenContainerAuth).toHaveBeenCalledWith('folder', 'fld00001', 'Cards');
  });

  it("Change mints the folder's own first entry of the picked type; Reset returns to inherited", async () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [ADMIN], defaultAuthUid: 'admin001' })],
    };
    renderEditor({ kind: 'folder', entityUid: 'fld00001', section: 'authorization' });
    await pickMenuItem(screen.getByTestId('oh-auth-pool-change'), 'API Key');
    expect(entryRows()).toHaveLength(1);
    expect(entryRows()[0].textContent).toContain('API Key');
    expect(entryRows()[0].textContent).toContain('Default');
    expect(screen.queryByTestId('oh-auth-entry-inherited-tag')).toBeNull();
    expect(screen.queryByTestId('oh-auth-inherited-form')).toBeNull();
    expect(screen.getByTestId('oh-auth-pool-add')).toBeTruthy();
    fireEvent.click(await findSaveButton());
    await waitFor(() => expect(applyRequestFolderSetAuthPool).toHaveBeenCalledTimes(1));
    expect(applyRequestFolderSetAuthPool).toHaveBeenCalledWith(
      {
        folderUid: 'fld00001',
        auths: [
          {
            uid: expect.stringMatching(/^[a-z0-9]{8}$/),
            name: '',
            config: { type: 'api-key', key: '', value: '', in: 'header' },
          },
        ],
        defaultAuthUid: expect.stringMatching(/^[a-z0-9]{8}$/),
      },
      { workspaceId: 'ws00001', surfaceId: 'workbench' },
    );

    fireEvent.click(screen.getByTestId('oh-auth-pool-reset'));
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(screen.getByTestId('oh-auth-pool-change')).toBeTruthy());
    expect(entryRows()[0].textContent).toContain('Admin token');
    expect(screen.getByTestId('oh-auth-entry-inherited-tag')).toBeTruthy();
  });
});

describe('AuthorizationTab — the request-level Inherit pane', () => {
  it('names the resolved entry with the Inherited tag, the Edit-in opener, and the form inert', () => {
    const onOpen = vi.fn();
    render(
      <AuthorizationTab
        auth={{ type: 'inherit' }}
        onChange={vi.fn()}
        inheritedFrom={{
          auth: BEARER,
          source: { kind: 'collection', uid: 'col00001', name: 'Payments', entryName: '' },
        }}
        onOpenContainerAuth={onOpen}
      />,
    );
    const pane = screen.getByTestId('oh-auth-transparent-state');
    expect(screen.getByTestId('oh-auth-inherit-heading').textContent).toBe('Bearer Token');
    expect(screen.getByTestId('oh-auth-inherited-tag').textContent).toBe('Inherited');
    expect(screen.getByTestId('oh-auth-inherited-form').hasAttribute('inert')).toBe(true);
    expect(pane.querySelector('.ant-typography-warning')).toBeNull();
    expect(screen.getByTestId('oh-auth-edit-in-source').textContent).toContain('Edit in parent');
    fireEvent.click(screen.getByTestId('oh-auth-edit-in-source'));
    expect(onOpen).toHaveBeenCalledWith('collection', 'col00001', 'Payments');
  });

  it('a named entry heads the pane by its name', () => {
    render(
      <AuthorizationTab
        auth={{ type: 'inherit', authUid: 'admin001' }}
        onChange={vi.fn()}
        inheritedFrom={{
          auth: ADMIN.config,
          source: { kind: 'folder', uid: 'fld00001', name: 'Cards', entryName: 'Admin token' },
        }}
      />,
    );
    expect(screen.getByTestId('oh-auth-inherit-heading').textContent).toBe('Admin token');
    expect(screen.queryByTestId('oh-auth-edit-in-source')).toBeNull();
  });

  it('says so when nothing is set above the request — no tag, no form', () => {
    render(
      <AuthorizationTab
        auth={{ type: 'inherit' }}
        onChange={vi.fn()}
        inheritedFrom={{ auth: { type: 'none' }, source: null }}
      />,
    );
    const pane = screen.getByTestId('oh-auth-transparent-state');
    expect(screen.getByTestId('oh-auth-inherit-heading').textContent).toBe('Inherit auth from parent');
    expect(pane.textContent).toContain('No auth — nothing is set on the folder or the collection.');
    expect(screen.queryByTestId('oh-auth-inherited-tag')).toBeNull();
    expect(screen.queryByTestId('oh-auth-inherited-form')).toBeNull();
  });

  it('a ↺ beside Auth Type resets a pinned entry or an own config back to follow-the-default', () => {
    const onChange = vi.fn();
    const first = render(<AuthorizationTab auth={BEARER} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('oh-auth-reset-inherit'));
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit' });
    first.unmount();
    const second = render(<AuthorizationTab auth={{ type: 'inherit', authUid: 'admin001' }} onChange={vi.fn()} />);
    expect(screen.getByTestId('oh-auth-reset-inherit')).toBeTruthy();
    second.unmount();
    render(<AuthorizationTab auth={{ type: 'inherit' }} onChange={vi.fn()} />);
    expect(screen.queryByTestId('oh-auth-reset-inherit')).toBeNull();
  });

  it("Digest's disable-retry checkbox writes the opt-out and clears back to absent (node runtimes)", () => {
    // The retry leg runs on node runtimes only — the checkbox hides on
    // browser surfaces (this harness's default), like the second leg.
    registerCapability('requestRuntime', () => 'node');
    try {
      const onChange = vi.fn();
      const digest: AuthConfig = { type: 'digest', username: 'u', password: 'p' };
      const first = render(<AuthorizationTab auth={digest} onChange={onChange} />);
      expect(
        screen.getByText('The authorization header will be automatically generated when you send the request.'),
      ).toBeTruthy();
      fireEvent.click(screen.getByTestId('oh-auth-digest-disable-retry'));
      expect(onChange).toHaveBeenCalledWith({ type: 'digest', username: 'u', password: 'p', disableRetry: true });
      first.unmount();
      const on = render(<AuthorizationTab auth={{ ...digest, disableRetry: true }} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('oh-auth-digest-disable-retry'));
      expect(onChange).toHaveBeenLastCalledWith({ type: 'digest', username: 'u', password: 'p' });
      on.unmount();
    } finally {
      unregisterCapability('requestRuntime');
    }
  });

  it("Hawk's form carries the credential fields, the optional attributes, and the payload-hash opt-in", () => {
    const onChange = vi.fn();
    const hawk: AuthConfig = { type: 'hawk', authId: 'dh37fgj492je', authKey: 'k', algorithm: 'sha256' };
    const first = render(<AuthorizationTab auth={hawk} onChange={onChange} />);
    // Every runtime signs — the auto-generated note closes the form
    // with no browser caveat, unlike digest.
    expect(
      screen.getByText('The authorization header will be automatically generated when you send the request.'),
    ).toBeTruthy();
    expect(screen.getByTestId('oh-auth-hawk-algorithm').textContent).toContain('SHA-256');
    fireEvent.click(screen.getByTestId('oh-auth-hawk-payload-hash'));
    expect(onChange).toHaveBeenCalledWith({ ...hawk, includePayloadHash: true });
    first.unmount();
    render(<AuthorizationTab auth={{ ...hawk, includePayloadHash: true }} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('oh-auth-hawk-payload-hash'));
    expect(onChange).toHaveBeenLastCalledWith(hawk);
  });

  it("JWT Bearer's form follows the algorithm family and writes the base64 + lifetime opt-ins", () => {
    const onChange = vi.fn();
    const jwt: AuthConfig = {
      type: 'jwt',
      algorithm: 'HS256',
      secret: 's',
      privateKey: '',
      payload: '',
      addTo: 'header',
    };
    const hs = render(<AuthorizationTab auth={jwt} onChange={onChange} />);
    // HS family shows the secret + base64 opt-in; no private key row.
    expect(screen.getByText('Secret Base64 encoded')).toBeTruthy();
    expect(screen.queryByText('Private Key')).toBeNull();
    expect(
      screen.getByText('The authorization header will be automatically generated when you send the request.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId('oh-auth-jwt-secret-base64'));
    expect(onChange).toHaveBeenCalledWith({ ...jwt, secretBase64: true });
    hs.unmount();
    // An asymmetric family swaps in the private key row.
    const rs = render(<AuthorizationTab auth={{ ...jwt, algorithm: 'RS256' }} onChange={onChange} />);
    expect(screen.getByText('Private Key')).toBeTruthy();
    expect(screen.queryByText('Secret Base64 encoded')).toBeNull();
    rs.unmount();
    // The lifetime opt-in clears back to absent.
    render(<AuthorizationTab auth={{ ...jwt, expiresInSeconds: 600 }} onChange={onChange} />);
    const holder = screen.getByTestId('oh-auth-jwt-expires-in');
    const expires = holder.tagName === 'INPUT' ? holder : holder.querySelector('input');
    if (!expires) throw new Error('no expires input');
    fireEvent.change(expires, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(jwt);
  });

  it("OAuth 1.0's form follows the method family and writes the body-hash opt-in", () => {
    const onChange = vi.fn();
    const oauth1: AuthConfig = {
      type: 'oauth1',
      consumerKey: 'ck',
      consumerSecret: 'cs',
      signatureMethod: 'HMAC-SHA1',
      paramsLocation: 'header',
    };
    const hmac = render(<AuthorizationTab auth={oauth1} onChange={onChange} />);
    // HMAC family shows the secret pair; the body-hash opt-in and the
    // closing note ride.
    expect(screen.getByText('Consumer Secret')).toBeTruthy();
    expect(screen.getByText('Token Secret')).toBeTruthy();
    expect(screen.queryByText('Private Key')).toBeNull();
    expect(
      screen.getByText('The authorization header will be automatically generated when you send the request.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId('oh-auth-oauth1-body-hash'));
    expect(onChange).toHaveBeenCalledWith({ ...oauth1, includeBodyHash: true });
    hmac.unmount();
    // The RSA family signs with the private key alone — the secret
    // pair leaves the form.
    const rsa = render(<AuthorizationTab auth={{ ...oauth1, signatureMethod: 'RSA-SHA1' }} onChange={onChange} />);
    expect(screen.getByText('Private Key')).toBeTruthy();
    expect(screen.queryByText('Consumer Secret')).toBeNull();
    expect(screen.queryByText('Token Secret')).toBeNull();
    rsa.unmount();
    // PLAINTEXT has no digest — the body-hash opt-in hides.
    render(<AuthorizationTab auth={{ ...oauth1, signatureMethod: 'PLAINTEXT' }} onChange={onChange} />);
    expect(screen.queryByTestId('oh-auth-oauth1-body-hash')).toBeNull();
  });

  it('Basic Auth and Bearer Token close with the auto-generated note on every runtime', () => {
    const first = render(<AuthorizationTab auth={{ type: 'bearer', token: '' }} onChange={vi.fn()} />);
    expect(
      screen.getByText('The authorization header will be automatically generated when you send the request.'),
    ).toBeTruthy();
    first.unmount();
    render(<AuthorizationTab auth={{ type: 'basic', username: '', password: '' }} onChange={vi.fn()} />);
    expect(
      screen.getByText('The authorization header will be automatically generated when you send the request.'),
    ).toBeTruthy();
  });

  it('keeps the generic note for a scratch draft with no ancestry', () => {
    render(<AuthorizationTab auth={{ type: 'inherit' }} onChange={vi.fn()} />);
    expect(screen.getByTestId('oh-auth-transparent-state').textContent).toContain(
      "Edit the collection's Authorization tab to change it.",
    );
  });

  it('with ancestry the select lists the entries by name, the default tagged, then the own types', () => {
    const onChange = vi.fn();
    const ancestry = {
      collection: makeCollection({ auths: [ADMIN, USER], defaultAuthUid: 'admin001' }),
      folders: [],
    };
    render(<AuthorizationTab auth={{ type: 'inherit' }} onChange={onChange} ancestry={ancestry} />);
    expect(screen.getByTestId('oh-auth-type').textContent).toContain('Admin token');
    expect(screen.getByTestId('oh-auth-type').textContent).toContain('Default');
    const select = screen.getByTestId('oh-auth-type');
    const input = select.querySelector('input');
    if (!input) throw new Error('no select input');
    fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 40 });
    const groups = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-group')).map(
      (g) => g.textContent,
    );
    // The own offer rides sectioned: the labeled This-request group
    // holds the credential schemes; the vendor signature and No Auth
    // follow as label-less groups the popup draws as rules.
    expect(groups).toEqual(['Inherited', 'This request', '', '']);
    const options = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option'));
    expect(options[0].textContent).toBe('Admin tokenDefault');
    expect(options[1].textContent).toBe('User token');
    expect(options[2].textContent).toBe('API Key');
    expect(options[options.length - 4].textContent).toBe('AWS Signature v4');
    expect(options[options.length - 3].textContent).toBe('Akamai EdgeGrid');
    expect(options[options.length - 2].textContent).toBe('ASAP (Atlassian)');
    expect(options[options.length - 1].textContent).toBe('No Auth');
    fireEvent.click(options[1]);
    expect(onChange).toHaveBeenCalledWith({ type: 'inherit', authUid: 'user0001' });
  });

  it('a pinned default entry keeps its own value; two levels name their level on each row', () => {
    const ancestry = {
      collection: makeCollection({ auths: [ADMIN], defaultAuthUid: 'admin001' }),
      folders: [{ uid: 'fld00001', name: 'Cards', auths: [USER], defaultAuthUid: 'user0001' }],
    };
    render(<AuthorizationTab auth={{ type: 'inherit', authUid: 'user0001' }} onChange={vi.fn()} ancestry={ancestry} />);
    const select = screen.getByTestId('oh-auth-type');
    const input = select.querySelector('input');
    if (!input) throw new Error('no select input');
    fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 40 });
    const options = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option'));
    expect(options[0].textContent).toBe('User tokenFolder ‘Cards’Default');
    expect(options[0].classList.contains('ant-select-item-option-selected')).toBe(true);
    expect(options[1].textContent).toBe('Admin tokenCollection ‘Payments’');
  });
});

describe('AuthorizationTab — sectioned forms and the (i) popovers', () => {
  const openPopover = (name: string) => {
    fireEvent.click(screen.getByLabelText(name));
    const popover = document.querySelector('.oh-info-popover');
    if (!popover) throw new Error(`no popover for ${name}`);
    return popover;
  };
  const litTexts = (popover: Element): string[] =>
    Array.from(popover.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent ?? '');
  const closePopover = () => fireEvent.keyDown(document.body, { key: 'Escape' });

  it("Hawk's form reads as Credentials · Signing · Attributes; a fold hides its rows and survives a remount", () => {
    const hawk: AuthConfig = { type: 'hawk', authId: 'dh37fgj492je', authKey: 'k', algorithm: 'sha256' };
    const first = render(<AuthorizationTab auth={hawk} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Credentials' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Signing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Attributes' })).toBeTruthy();
    expect(screen.getByText('ext')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Attributes' }));
    expect(screen.queryByText('ext')).toBeNull();
    // An empty folded group carries no dot; a set field behind the
    // fold does (the Settings idiom), so nothing set disappears.
    expect(screen.queryByTestId('oh-setting-modified-dot')).toBeNull();
    first.unmount();
    // The fold is a session reading preference — it outlives the tab.
    const second = render(<AuthorizationTab auth={{ ...hawk, ext: 'x' }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Attributes' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('ext')).toBeNull();
    expect(screen.getByTestId('oh-setting-modified-dot')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Attributes' }));
    expect(screen.getByText('ext')).toBeTruthy();
    expect(screen.queryByTestId('oh-setting-modified-dot')).toBeNull();
    second.unmount();
  });

  it("a row's (i) lights its token of the type's wire shape — the Digest password lights response=", () => {
    render(<AuthorizationTab auth={{ type: 'digest', username: 'u', password: 'p' }} onChange={vi.fn()} />);
    const popover = openPopover('About Password');
    expect(popover.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Credentials');
    expect(popover.querySelector('.oh-info-popover-title')?.textContent).toBe('Password');
    expect(litTexts(popover)).toEqual(['response="a7e0f5c1…"']);
    expect(popover.textContent).toContain('Never rides');
    closePopover();
  });

  it("a group's (i) lights the union of its rows and shows their optional tokens — Hawk's Attributes", () => {
    render(
      <AuthorizationTab
        auth={{ type: 'hawk', authId: 'dh37fgj492je', authKey: 'k', algorithm: 'sha256' }}
        onChange={vi.fn()}
      />,
    );
    const popover = openPopover('About Attributes');
    expect(popover.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Hawk Authentication');
    expect(litTexts(popover)).toEqual(['ext="some-app-ext-data"', 'app="app_3c1f"', 'dlg="dlg_8e2a"']);
    closePopover();
  });

  it("the Auth Type (i) in the rail lights the header's scheme; the card follows the delivery choice", () => {
    const first = render(<AuthorizationTab auth={{ type: 'basic', username: '', password: '' }} onChange={vi.fn()} />);
    const basic = openPopover('About Basic Auth');
    expect(basic.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Authorization');
    expect(litTexts(basic)).toEqual(['Authorization: Basic']);
    closePopover();
    first.unmount();
    render(<AuthorizationTab auth={{ type: 'api-key', key: '', value: '', in: 'query' }} onChange={vi.fn()} />);
    const addTo = openPopover('About Add to');
    expect(litTexts(addTo)).toEqual(['query:', 'X-API-Key=8f3a91c2d4e6']);
    closePopover();
  });

  it('AWS Signature v4 reads as Credentials · Signing · Delivery; the card follows the delivery choice', () => {
    const onChange = vi.fn();
    const aws: AuthConfig = { type: 'aws-sigv4', accessKeyId: '', secretAccessKey: '', service: '', region: '' };
    // One popover per render — a closed popover stays in the DOM.
    const first = render(<AuthorizationTab auth={aws} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Credentials' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Signing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delivery' })).toBeTruthy();
    expect(screen.getByText('Session Token')).toBeTruthy();
    expect(screen.getByTestId('oh-auth-aws-add-to').textContent).toContain('Header');
    // The type (i) lights the header's scheme.
    const type = openPopover('About AWS Signature v4');
    expect(litTexts(type)).toEqual(['Authorization: AWS4-HMAC-SHA256']);
    closePopover();
    // Header delivery persists ABSENT; query lands on the config.
    const input = screen.getByTestId('oh-auth-aws-add-to').querySelector('input');
    if (!input) throw new Error('no select input');
    fireEvent.mouseDown(input);
    fireEvent.click(screen.getByText('Query Params'));
    expect(onChange).toHaveBeenLastCalledWith({ ...aws, addTo: 'query' });
    first.unmount();
    // The Secret Key lights the signature it derives (it never rides).
    const second = render(<AuthorizationTab auth={aws} onChange={onChange} />);
    const secret = openPopover('About Secret Key');
    expect(secret.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Credentials');
    expect(litTexts(secret)).toEqual(['Signature=5fa00fa3…']);
    closePopover();
    second.unmount();
    // The Signing group lights the credential scope both rows land in.
    const third = render(<AuthorizationTab auth={aws} onChange={onChange} />);
    const signing = openPopover('About Signing');
    expect(litTexts(signing)).toEqual(['Credential=AKIDEXAMPLE/20150830/us-east-1/execute-api/aws4_request']);
    closePopover();
    third.unmount();
    render(<AuthorizationTab auth={{ ...aws, addTo: 'query', service: 's3' }} onChange={onChange} />);
    const addTo = openPopover('About Add to');
    expect(litTexts(addTo)).toEqual(['query:', 'X-Amz-Algorithm=AWS4-HMAC-SHA256']);
    expect(addTo.textContent).toContain('X-Amz-Expires=86400');
    expect(addTo.textContent).toContain('X-Amz-Signature=');
    closePopover();
  });

  it('Akamai EdgeGrid reads as Credentials · Signing; the secret lights the signature, the list its header', () => {
    const onChange = vi.fn();
    const edgegrid: AuthConfig = { type: 'edgegrid', clientToken: '', accessToken: '', clientSecret: '' };
    const first = render(<AuthorizationTab auth={edgegrid} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Credentials' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Signing' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delivery' })).toBeNull();
    expect(screen.getByText('Headers to Sign')).toBeTruthy();
    const type = openPopover('About Akamai EdgeGrid');
    expect(litTexts(type)).toEqual(['Authorization: EG1-HMAC-SHA256']);
    closePopover();
    first.unmount();
    const second = render(<AuthorizationTab auth={edgegrid} onChange={onChange} />);
    const secret = openPopover('About Client Secret');
    expect(secret.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Credentials');
    expect(litTexts(secret)).toEqual(['signature=tL+y4hxyHxgW…']);
    closePopover();
    second.unmount();
    // The header list's popover forces its signed line into view.
    render(<AuthorizationTab auth={edgegrid} onChange={onChange} />);
    const list = openPopover('About Headers to Sign');
    expect(litTexts(list)).toEqual(['x-test1:test-simple-header']);
    expect(list.textContent).not.toContain('content hash');
    closePopover();
  });

  it('ASAP reads as Signing · Token; the private key lights the signature, the claims their token', () => {
    const onChange = vi.fn();
    const asap: AuthConfig = {
      type: 'asap',
      algorithm: 'RS256',
      issuer: '',
      audience: '',
      keyId: '',
      privateKey: '',
    };
    const first = render(<AuthorizationTab auth={asap} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Signing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Token' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delivery' })).toBeNull();
    expect(screen.getByTestId('oh-auth-asap-algorithm').textContent).toContain('RS256');
    const type = openPopover('About ASAP (Atlassian)');
    expect(litTexts(type)).toEqual(['Authorization: Bearer']);
    closePopover();
    first.unmount();
    const second = render(<AuthorizationTab auth={asap} onChange={onChange} />);
    const key = openPopover('About Private Key');
    expect(key.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Signing');
    expect(litTexts(key)).toEqual(['signature ← private key']);
    closePopover();
    second.unmount();
    // The Additional Claims popover forces its token into the JWT line.
    render(<AuthorizationTab auth={{ ...asap, expiresInSeconds: 600 }} onChange={onChange} />);
    const claims = openPopover('About Additional Claims');
    expect(litTexts(claims)).toEqual(['scope: read']);
    expect(claims.textContent).toContain('jti: 6f1c2a0e-…');
    expect(claims.textContent).toContain('exp: 1353832834');
    closePopover();
  });

  it('HTTP Message Signature reads as Signing · Coverage · Parameters; the type (i) lights both headers, the rows their parameters', () => {
    const onChange = vi.fn();
    const sig: AuthConfig = {
      type: 'http-signature',
      algorithm: 'rsa-pss-sha512',
      privateKey: '',
      secret: '',
      components: '@method @target-uri',
    };
    const first = render(<AuthorizationTab auth={sig} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Signing' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Coverage' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Parameters' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delivery' })).toBeNull();
    expect(screen.getByTestId('oh-auth-http-signature-algorithm').textContent).toContain('rsa-pss-sha512');
    expect(screen.getByTestId('oh-auth-http-signature-components').textContent).toBe('@method @target-uri');
    // The asymmetric default shows the private key row, never the secret.
    expect(screen.getByText('Private Key')).toBeTruthy();
    expect(screen.queryByText('Shared Secret')).toBeNull();
    const type = openPopover('About HTTP Message Signature');
    expect(litTexts(type)).toEqual(['Signature-Input:', 'Signature:']);
    expect(type.textContent).toContain('("@method" "@target-uri")');
    expect(type.textContent).toContain('created=1618884473');
    closePopover();
    first.unmount();
    // The Covered Components (i) sits under Coverage and lights the list and the signed lines.
    const second = render(<AuthorizationTab auth={sig} onChange={onChange} />);
    const covered = openPopover('About Covered Components');
    expect(covered.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Coverage');
    expect(litTexts(covered)).toEqual([
      '("@method" "@target-uri")',
      '"@method": POST',
      '"@target-uri": https://api.openheaders.com/v1/users',
      '"@signature-params": ("@method" "@target-uri")…',
    ]);
    closePopover();
    second.unmount();
    // The Nonce (i) forces its parameter into the Signature-Input line; the Content Digest (i) its header line.
    const third = render(<AuthorizationTab auth={sig} onChange={onChange} />);
    const nonce = openPopover('About Nonce');
    expect(nonce.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Parameters');
    expect(litTexts(nonce)).toEqual(['nonce="b3k2pp5k7z-50gnwp.yemd"']);
    closePopover();
    third.unmount();
    render(<AuthorizationTab auth={{ ...sig, algorithm: 'hmac-sha256' }} onChange={onChange} />);
    expect(screen.getByText('Shared Secret')).toBeTruthy();
    expect(screen.getByTestId('oh-auth-http-signature-secret-base64')).toBeTruthy();
    const digest = openPopover('About Content Digest');
    expect(litTexts(digest)).toEqual(['Content-Digest:', 'sha-256=:X48E9qOokqqrvdts…:']);
    closePopover();
  });

  it("the pool entry pane's type select opens the compact sectioned popup — every type in view, two dividers", async () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [ADMIN], defaultAuthUid: 'admin001' })],
    };
    renderEditor({ section: 'authorization' });
    const input = screen.getByTestId('oh-auth-entry-type').querySelector('input');
    if (!input) throw new Error('no select input');
    fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 40 });
    await waitFor(() => expect(document.querySelector('.oh-auth-type-popup')).toBeTruthy());
    const popup = document.querySelector('.oh-auth-type-popup');
    if (!popup) throw new Error('no popup');
    // No virtual window: all thirteen types are in the DOM at once; the
    // two label-less groups are the section dividers (vendor, none).
    expect(popup.querySelectorAll('.ant-select-item-option')).toHaveLength(13);
    expect(popup.querySelectorAll('.ant-select-item-group')).toHaveLength(2);
    const labels = Array.from(popup.querySelectorAll('.ant-select-item-option')).map((el) => el.textContent);
    expect(labels[0]).toBe('API Key');
    expect(labels[5]).toBe('HTTP Message Signature');
    expect(labels[9]).toBe('AWS Signature v4');
    expect(labels[10]).toBe('Akamai EdgeGrid');
    expect(labels[11]).toBe('ASAP (Atlassian)');
    expect(labels[12]).toBe('No Auth');
    fireEvent.keyDown(input, { key: 'Escape' });
  });

  it("the pool entry pane's Auth Type row carries the same type (i)", () => {
    requestsState = {
      ...requestsState,
      collections: [makeCollection({ auths: [ADMIN], defaultAuthUid: 'admin001' })],
    };
    renderEditor({ section: 'authorization' });
    expect(screen.getByTestId('oh-auth-entry-type').textContent).toContain('Bearer Token');
    const popover = openPopover('About Bearer Token');
    expect(litTexts(popover)).toEqual(['Authorization: Bearer']);
    closePopover();
  });
});

describe('AuthorizationTab — the OAuth 2.0 editor on the sectioned anatomy', () => {
  const oauth2: AuthConfig = {
    type: 'oauth2',
    credentialRef: 'oauth2-cred-abc12345',
    flow: 'authorization-code-pkce',
    tokenEndpoint: '',
    clientId: '',
    scopes: [],
  };
  const renderTab = (auth: AuthConfig) =>
    render(
      <App>
        <AuthorizationTab auth={auth} onChange={vi.fn()} />
      </App>,
    );
  const openPopover = (name: string) => {
    fireEvent.click(screen.getByLabelText(name));
    const popover = document.querySelector('.oh-info-popover');
    if (!popover) throw new Error(`no popover for ${name}`);
    return popover;
  };
  const litTexts = (popover: Element): string[] =>
    Array.from(popover.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent ?? '');
  const closePopover = () => fireEvent.keyDown(document.body, { key: 'Escape' });
  const bundles = (overrides: Partial<OAuthBundlesContextValue>): OAuthBundlesContextValue => ({
    tokens: {},
    isReady: true,
    redirectUri: null,
    discover: vi.fn(),
    authorize: vi.fn(),
    clientCredentials: vi.fn(),
    passwordCredentials: vi.fn(),
    jwtBearer: vi.fn(),
    deviceStart: vi.fn(),
    deviceCancel: vi.fn(),
    deviceStates: {},
    refresh: vi.fn(),
    revoke: vi.fn(),
    ...overrides,
  });
  const ISSUER = 'https://idp.openheaders.io';
  const METADATA = {
    issuer: ISSUER,
    authorizationEndpoint: `${ISSUER}/authorize`,
    tokenEndpoint: `${ISSUER}/token`,
    deviceAuthorizationEndpoint: `${ISSUER}/device`,
    scopesSupported: ['openid', 'email'],
    grantTypesSupported: ['authorization_code', 'client_credentials'],
    tokenEndpointAuthMethodsSupported: ['client_secret_basic'],
    codeChallengeMethodsSupported: ['S256'],
  };
  const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
  const factLines = () =>
    Array.from(screen.getByTestId('oh-oauth2-discovery-facts').querySelectorAll('li')).map((li) => li.textContent);

  it('Discover fills the endpoint rows from the issuer’s metadata and lists what the document says', async () => {
    const onChange = vi.fn();
    const discover = vi.fn(async () => ({ success: true, metadata: METADATA, url: DISCOVERY_URL }));
    const withIssuer: AuthConfig = { ...oauth2, issuer: ISSUER };
    render(
      <App>
        <OAuthBundlesContext.Provider value={bundles({ discover })}>
          <AuthorizationTab auth={withIssuer} onChange={onChange} />
        </OAuthBundlesContext.Provider>
      </App>,
    );
    expect((screen.getByTestId('oh-oauth2-issuer') as HTMLInputElement).value).toBe(ISSUER);
    fireEvent.click(screen.getByTestId('oh-oauth2-discover'));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(discover).toHaveBeenCalledWith(ISSUER);
    expect(onChange).toHaveBeenCalledWith({
      ...withIssuer,
      authorizationEndpoint: `${ISSUER}/authorize`,
      deviceAuthorizationEndpoint: `${ISSUER}/device`,
      tokenEndpoint: `${ISSUER}/token`,
    });
    const facts = screen.getByTestId('oh-oauth2-discovery-facts');
    expect(facts.className).toContain('ant-alert-info');
    expect(facts.textContent).toContain(`Discovered from ${DISCOVERY_URL}`);
    expect(factLines()).toEqual([
      'Filled Auth URL, Device Authorization URL, Access Token URL',
      'Grant authorization_code is listed by the provider',
      'PKCE S256 is listed by the provider',
      'Scopes offered: openid, email — suggested in the Scope row',
    ]);
    expect(await screen.findByText('OAuth: endpoints discovered')).toBeTruthy();
  });

  it('a pick the document does not list reads as a warning fact — nothing is rewritten', async () => {
    const onChange = vi.fn();
    const discover = vi.fn(async () => ({ success: true, metadata: METADATA, url: DISCOVERY_URL }));
    const secret: AuthConfig = { ...oauth2, issuer: ISSUER, flow: 'client-credentials', clientSecret: 's3cret' };
    render(
      <App>
        <OAuthBundlesContext.Provider value={bundles({ discover })}>
          <AuthorizationTab auth={secret} onChange={onChange} />
        </OAuthBundlesContext.Provider>
      </App>,
    );
    fireEvent.click(screen.getByTestId('oh-oauth2-discover'));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(onChange.mock.calls[0][0]).toMatchObject({ flow: 'client-credentials', clientSecret: 's3cret' });
    expect(onChange.mock.calls[0][0].clientAuthentication).toBeUndefined();
    const facts = screen.getByTestId('oh-oauth2-discovery-facts');
    expect(facts.className).toContain('ant-alert-warning');
    expect(factLines()).toEqual([
      'Filled Auth URL, Device Authorization URL, Access Token URL',
      'Client authentication client_secret_post is not listed — the provider lists client_secret_basic',
      'Grant client_credentials is listed by the provider',
      'Scopes offered: openid, email — suggested in the Scope row',
    ]);
  });

  it('a refused discovery toasts the step-tagged error and fills nothing', async () => {
    const onChange = vi.fn();
    const discover = vi.fn(async () => ({
      success: false,
      error: 'discovery: the metadata document names issuer "https://other.openheaders.io"',
    }));
    render(
      <App>
        <OAuthBundlesContext.Provider value={bundles({ discover })}>
          <AuthorizationTab auth={{ ...oauth2, issuer: ISSUER }} onChange={onChange} />
        </OAuthBundlesContext.Provider>
      </App>,
    );
    fireEvent.click(screen.getByTestId('oh-oauth2-discover'));
    expect(
      await screen.findByText(
        'Discovery failed: discovery: the metadata document names issuer "https://other.openheaders.io"',
      ),
    ).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('oh-oauth2-discovery-facts')).toBeNull();
  });

  it('Discover parks without an issuer and the Issuer URL (i) lights the two endpoints it fills', () => {
    renderTab(oauth2);
    expect((screen.getByTestId('oh-oauth2-discover') as HTMLButtonElement).disabled).toBe(true);
    const popover = openPopover('About Issuer URL');
    expect(popover.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Grant');
    expect(litTexts(popover).length).toBeGreaterThan(0);
    closePopover();
  });

  it('reads as Token · Grant · Advanced, Advanced folded by default over the refresh rows', () => {
    renderTab(oauth2);
    expect(screen.getByRole('button', { name: 'Token' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Grant' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Advanced' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Client Authentication')).toBeTruthy();
    expect(screen.queryByText('Refresh Token URL')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.getByText('Refresh Token URL')).toBeTruthy();
    expect(screen.getByText('Token Request')).toBeTruthy();
    // Fold it back — the session store outlives this test.
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.queryByText('Refresh Token URL')).toBeNull();
  });

  it('Header Prefix edits onto the config; empty shows the Bearer placeholder', () => {
    const onChange = vi.fn();
    render(
      <App>
        <AuthorizationTab auth={oauth2} onChange={onChange} />
      </App>,
    );
    const input = screen.getByPlaceholderText('Bearer') as HTMLInputElement;
    expect(input.readOnly).toBe(false);
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: 'Token' } });
    expect(onChange).toHaveBeenCalledWith({ ...oauth2, headerPrefix: 'Token' });
  });

  it('Token Binding offers None and DPoP; DPoP writes the binding and reveals Proof Algorithm', () => {
    const onChange = vi.fn();
    render(
      <App>
        <AuthorizationTab auth={oauth2} onChange={onChange} />
      </App>,
    );
    expect(screen.getByText('Token Binding')).toBeTruthy();
    expect(screen.queryByText('Proof Algorithm')).toBeNull();
    fireEvent.mouseDown(screen.getByText('None (bearer)'));
    const options = Array.from(document.querySelectorAll('.ant-select-item-option-content')).map(
      (el) => el.textContent,
    );
    expect(options).toEqual(['None (bearer)', 'DPoP']);
    fireEvent.click(screen.getByText('DPoP'));
    expect(onChange).toHaveBeenCalledWith({ ...oauth2, tokenBinding: 'dpop' });
  });

  it('under DPoP the Proof Algorithm row shows the pick; None drops the binding and the algorithm together', () => {
    const onChange = vi.fn();
    render(
      <App>
        <AuthorizationTab auth={{ ...oauth2, tokenBinding: 'dpop', dpopAlgorithm: 'ES384' }} onChange={onChange} />
      </App>,
    );
    expect(screen.getByText('Proof Algorithm')).toBeTruthy();
    expect(screen.getByText('ES384')).toBeTruthy();
    fireEvent.mouseDown(screen.getByText('DPoP'));
    fireEvent.click(screen.getByText('None (bearer)'));
    expect(onChange).toHaveBeenLastCalledWith(oauth2);
  });

  it('the Token Binding (i) lights the proof on the token POST, the DPoP scheme on the send, and the proof anatomy', () => {
    renderTab({ ...oauth2, tokenBinding: 'dpop' });
    const popover = openPopover('About Token Binding');
    const lit = litTexts(popover);
    expect(lit.some((text) => text.startsWith('DPoP: eyJ'))).toBe(true);
    expect(lit).toContain('DPoP');
    expect(lit).toContain('typ: dpop+jwt');
    expect(lit).toContain('htm: GET');
    expect(lit).toContain('ath: SHA-256(access_token)');
    closePopover();
  });

  it('the Proof Algorithm (i) lights the alg of the proof', () => {
    renderTab({ ...oauth2, tokenBinding: 'dpop' });
    const popover = openPopover('About Proof Algorithm');
    expect(litTexts(popover)).toEqual(['alg: ES256']);
    closePopover();
  });

  it('without a stored bundle the Token group closes on the out-of-band note', () => {
    renderTab(oauth2);
    expect(screen.getByText(/out-of-band, use Bearer Token auth/)).toBeTruthy();
  });

  it('Authorize using browser renders only on the node runtime — checked, locked, with its (i)', () => {
    const browser = renderTab(oauth2);
    expect(screen.queryByText('Authorize using browser')).toBeNull();
    browser.unmount();
    registerCapability('requestRuntime', () => 'node');
    try {
      renderTab(oauth2);
      const box = screen.getByRole('checkbox', { name: /Authorize using browser/ }) as HTMLInputElement;
      expect(box.checked).toBe(true);
      expect(box.disabled).toBe(true);
      const popover = openPopover('About Authorize using browser');
      expect(popover.textContent).toContain('default browser');
      expect(popover.textContent).toContain('backend port');
      closePopover();
    } finally {
      unregisterCapability('requestRuntime');
    }
  });

  it("the Client Secret (i) lights the token request's body field, or the Basic header per Client Authentication", () => {
    const body = renderTab(oauth2);
    const bodyPopover = openPopover('About Client Secret');
    expect(bodyPopover.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Grant');
    expect(litTexts(bodyPopover)).toEqual(['client_secret=cs_71b0']);
    closePopover();
    body.unmount();
    renderTab({ ...oauth2, clientAuthentication: 'basic-header' });
    const basicPopover = openPopover('About Client Secret');
    expect(litTexts(basicPopover)).toEqual(['Authorization: Basic base64(ck_9f3a:cs_71b0)']);
    closePopover();
  });

  it('Grant type offers six grants and Client Authentication four methods', () => {
    renderTab(oauth2);
    fireEvent.mouseDown(screen.getByText('Authorization Code (With PKCE)'));
    const grants = Array.from(document.querySelectorAll('.ant-select-item-option-content')).map((el) => el.textContent);
    expect(grants).toEqual([
      'Authorization Code (With PKCE)',
      'Authorization Code',
      'Client Credentials',
      'Password Credentials',
      'JWT Bearer',
      'Device Code',
    ]);
    closePopover();
    fireEvent.mouseDown(screen.getByText('Send client credentials in body'));
    const methods = Array.from(document.querySelectorAll('.ant-select-item-option-content'))
      .map((el) => el.textContent)
      .filter((text) => text?.startsWith('Send'));
    expect(methods).toEqual([
      'Send client credentials in body',
      'Send as Basic Auth header',
      'Send a signed JWT (private_key_jwt)',
      'Send an HMAC JWT (client_secret_jwt)',
    ]);
  });

  it('a JWT client authentication opens the Signing group; the secret method hides its Private Key row', () => {
    const plain = renderTab(oauth2);
    expect(screen.queryByRole('button', { name: 'Signing' })).toBeNull();
    plain.unmount();
    const privateKey = renderTab({ ...oauth2, clientAuthentication: 'private-key-jwt' });
    expect(screen.getByRole('button', { name: 'Signing' }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Private Key')).toBeTruthy();
    expect(screen.getByText('Lifetime (seconds)')).toBeTruthy();
    expect((screen.getByTestId('oh-oauth2-assertion-lifetime') as HTMLInputElement).placeholder).toBe('300');
    expect(screen.getByText('Audience')).toBeTruthy();
    privateKey.unmount();
    renderTab({ ...oauth2, clientAuthentication: 'client-secret-jwt' });
    expect(screen.getByRole('button', { name: 'Signing' })).toBeTruthy();
    expect(screen.queryByText('Private Key')).toBeNull();
    expect(screen.getByText('HS256')).toBeTruthy();
  });

  it('the Client Secret (i) under client-secret-jwt lights the client_assertion and the signing family', () => {
    renderTab({ ...oauth2, clientAuthentication: 'client-secret-jwt' });
    const popover = openPopover('About Client Secret');
    // The token line's pair, the JWT line's family, the refresh line's assertion.
    expect(litTexts(popover)).toEqual([
      'client_assertion_type=…:jwt-bearer',
      'client_assertion=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb2huLmRvZSJ9.SflKxw…',
      'alg: HS256',
      'client_assertion=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb2huLmRvZSJ9.SflKxw…',
    ]);
    closePopover();
  });

  it("the JWT Bearer grant renders the assertion's own rows, no callback / secret, and its (i) lights the grant assertion", () => {
    renderTab({ ...oauth2, flow: 'jwt-bearer', grantType: 'jwt-bearer', assertionIssuer: 'svc@openheaders.io' });
    expect(screen.getByText('Issuer')).toBeTruthy();
    expect(screen.getByText('Subject')).toBeTruthy();
    expect(screen.getByText('Additional Claims')).toBeTruthy();
    expect(screen.queryByText('Callback URL')).toBeNull();
    expect(screen.queryByText('Client Secret')).toBeNull();
    expect(screen.getByRole('button', { name: 'Signing' })).toBeTruthy();
    const popover = openPopover('About Grant type');
    expect(litTexts(popover)).toEqual([
      'grant_type=…:jwt-bearer',
      'assertion=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb2huLmRvZSJ9.SflKxw…',
    ]);
    expect(popover.textContent).toContain('iss: svc@openheaders.io');
    closePopover();
  });

  it('the Device Code grant renders its endpoint row, no callback / auth URL / PKCE / state, and its (i) lights the device leg', () => {
    const onChange = vi.fn();
    const device: AuthConfig = { ...oauth2, flow: 'device-code', grantType: 'device-code' };
    render(
      <App>
        <AuthorizationTab auth={device} onChange={onChange} />
      </App>,
    );
    expect(screen.getByText('Device Authorization URL')).toBeTruthy();
    expect(screen.getByText('Access Token URL')).toBeTruthy();
    expect(screen.getByText('Client Secret')).toBeTruthy();
    expect(screen.queryByText('Callback URL')).toBeNull();
    expect(screen.queryByText('Auth URL')).toBeNull();
    expect(screen.queryByText('Code Verifier')).toBeNull();
    expect(screen.queryByText('State')).toBeNull();
    expect(screen.queryByTestId('oh-oauth2-device-pending')).toBeNull();
    fireEvent.change(screen.getByTestId('oh-oauth2-device-auth-url'), {
      target: { value: 'https://auth.openheaders.io/device' },
    });
    expect(onChange).toHaveBeenCalledWith({
      ...device,
      deviceAuthorizationEndpoint: 'https://auth.openheaders.io/device',
    });
    const popover = openPopover('About Device Authorization URL');
    expect(popover.querySelector('.oh-info-popover-kicker')?.textContent).toBe('Grant');
    expect(litTexts(popover)).toEqual([
      'POST https://idp.openheaders.com/device',
      '→ user_code=WDJB-MJHT',
      'verification_uri=…/activate',
    ]);
    expect(popover.textContent).toContain('grant_type=…:device_code');
    expect(popover.textContent).toContain('authorization_pending');
    closePopover();
  });

  it('a pending device authorization shows the code, Open, Cancel and the countdown, and parks Get new access token', async () => {
    const device: AuthConfig = { ...oauth2, flow: 'device-code', grantType: 'device-code' };
    const deviceCancel = vi.fn(async () => true);
    const opened: string[] = [];
    registerCapability('openExternalUrl', async (url: string) => {
      opened.push(url);
      return { ok: true };
    });
    const pending: OAuthBundlesContextValue = {
      tokens: {},
      isReady: true,
      redirectUri: null,
      discover: vi.fn(),
      authorize: vi.fn(),
      clientCredentials: vi.fn(),
      passwordCredentials: vi.fn(),
      jwtBearer: vi.fn(),
      deviceStart: vi.fn(),
      deviceCancel,
      deviceStates: {
        [device.credentialRef]: {
          state: 'pending',
          approval: {
            userCode: 'WDJB-MJHT',
            verificationUri: 'https://auth.openheaders.io/activate',
            verificationUriComplete: 'https://auth.openheaders.io/activate?user_code=WDJB-MJHT',
            expiresAt: Date.now() + 90_000,
            intervalSeconds: 5,
          },
          startedAt: Date.now(),
        },
      },
      refresh: vi.fn(),
      revoke: vi.fn(),
    };
    try {
      render(
        <App>
          <OAuthBundlesContext.Provider value={pending}>
            <AuthorizationTab auth={device} onChange={vi.fn()} />
          </OAuthBundlesContext.Provider>
        </App>,
      );
      expect(screen.getByText('Waiting for you to approve on auth.openheaders.io')).toBeTruthy();
      expect(screen.getByTestId('oh-oauth2-device-user-code').textContent).toContain('WDJB-MJHT');
      expect(screen.getByTestId('oh-oauth2-device-countdown').textContent).toMatch(/Expires in 1m · Checking every 5s/);
      expect(screen.queryByText(/out-of-band, use Bearer Token auth/)).toBeNull();
      expect((screen.getByRole('button', { name: 'Get new access token' }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(screen.getByTestId('oh-oauth2-device-open'));
      expect(opened).toEqual(['https://auth.openheaders.io/activate?user_code=WDJB-MJHT']);
      fireEvent.click(screen.getByTestId('oh-oauth2-device-cancel'));
      await waitFor(() => expect(deviceCancel).toHaveBeenCalledWith(device.credentialRef));
    } finally {
      unregisterCapability('openExternalUrl');
    }
  });

  it('the Auto-refresh fact reads the grant: on for a renewable grant without a bundle, off for a code grant', () => {
    // The Token group's one checkbox on the browser runtime (the node
    // runtime adds the Authorize-using-browser box under the callback).
    const autoRefresh = () => document.querySelector('.ant-checkbox-input') as HTMLInputElement;
    const code = renderTab(oauth2);
    expect(autoRefresh().checked).toBe(false);
    code.unmount();
    renderTab({ ...oauth2, flow: 'jwt-bearer', grantType: 'jwt-bearer' });
    expect(autoRefresh().checked).toBe(true);
  });

  it("the rail's Add-to (i) lights the send's Authorization header, or the query slot when sent on the URL", () => {
    const header = renderTab(oauth2);
    const headerPopover = openPopover('About Add authorization data to');
    expect(headerPopover.querySelector('.oh-info-popover-kicker')?.textContent).toBe('OAuth 2.0');
    expect(litTexts(headerPopover)).toEqual(['Authorization:', 'Bearer']);
    closePopover();
    header.unmount();
    renderTab({ ...oauth2, sendAs: 'query' });
    const queryPopover = openPopover('About Add authorization data to');
    expect(litTexts(queryPopover)).toEqual([
      'query:',
      'access_token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb2huLmRvZSJ9.SflKxw…',
    ]);
    closePopover();
  });
});
