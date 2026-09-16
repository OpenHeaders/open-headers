/**
 * deriveWorkspaceServer — the `workspace-server` role's live state from
 * the workspace's Org binding: the bound record read as a place by the
 * place law (the desktop app's loopback port from a browser host is
 * never a server), its name by the label / group / host ladder, its
 * wire by the record's enabled flag and sync slot; the home Org and a
 * gone record yield none.
 */

import type { IdentitySnapshot } from '@openheaders/core/identity';
import type { BackendConnection } from '@openheaders/core/types';
import { deriveWorkspaceServer } from '@openheaders/ui/workbench/execution-place/useWorkspaceServer';
import { describe, expect, it } from 'vitest';

const SNAPSHOT = {
  orgs: new Map([['org-acme', { name: 'Acme' }]]),
} as unknown as IdentitySnapshot;

function record(overrides: Partial<BackendConnection>): BackendConnection {
  return {
    id: 'backend-1',
    url: 'wss://sync.openheaders.io',
    label: '',
    enabled: true,
    ...overrides,
  } as BackendConnection;
}

const BINDINGS = new Map([['org-acme', 'backend-1']]);

describe('deriveWorkspaceServer', () => {
  it('reads the bound server record as a connected place named by its label', () => {
    expect(
      deriveWorkspaceServer('extension', 'org-acme', SNAPSHOT, BINDINGS, [record({ label: 'Acme prod' })], {
        'backend-1': { state: 'green', message: '' },
      }),
    ).toEqual({ backendId: 'backend-1', name: 'Acme prod', connected: true });
  });

  it('names a label-less server by the Org group it provides', () => {
    expect(
      deriveWorkspaceServer('extension', 'org-acme', SNAPSHOT, BINDINGS, [record({})], {
        'backend-1': { state: 'green', message: '' },
      })?.name,
    ).toBe('Acme');
  });

  it('is disconnected without a green slot or with the record off', () => {
    expect(deriveWorkspaceServer('extension', 'org-acme', SNAPSHOT, BINDINGS, [record({})], {})?.connected).toBe(false);
    expect(
      deriveWorkspaceServer('extension', 'org-acme', SNAPSHOT, BINDINGS, [record({})], {
        'backend-1': { state: 'yellow', message: '' },
      })?.connected,
    ).toBe(false);
    expect(
      deriveWorkspaceServer('extension', 'org-acme', SNAPSHOT, BINDINGS, [record({ enabled: false })], {
        'backend-1': { state: 'green', message: '' },
      })?.connected,
    ).toBe(false);
  });

  it('yields none for the home Org, an unbound Org, or a bound record that is gone', () => {
    expect(deriveWorkspaceServer('extension', null, SNAPSHOT, BINDINGS, [record({})], {})).toBeNull();
    expect(deriveWorkspaceServer('extension', 'org-other', SNAPSHOT, BINDINGS, [record({})], {})).toBeNull();
    expect(deriveWorkspaceServer('extension', 'org-acme', SNAPSHOT, BINDINGS, [], {})).toBeNull();
  });

  it('never reads the desktop app on this device as the workspace server (the place law)', () => {
    expect(
      deriveWorkspaceServer('extension', 'org-acme', SNAPSHOT, BINDINGS, [record({ url: 'ws://127.0.0.1:8137' })], {
        'backend-1': { state: 'green', message: '' },
      }),
    ).toBeNull();
  });
});
