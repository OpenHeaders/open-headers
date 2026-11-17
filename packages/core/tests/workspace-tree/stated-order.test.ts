/**
 * Coverage for the order a tree states (`workspace-tree/stated-order.ts`)
 * — a manifest's `order:` read with the tree it stands in, and one
 * change laid over the branch's.
 *
 * The load-bearing properties:
 *   - a missing key is the empty order where the container holds no
 *     child, and no order at all where it holds one;
 *   - a place that holds no child is a list like any other: the change
 *     is laid entry by entry and nothing is counted;
 *   - a change that ends stating no order leaves the branch's as it is;
 *   - a branch that states none takes the order the change arrives at.
 */

import { describe, expect, it } from 'vitest';
import type { Collection, Folder, Request, Rule } from '../../src/types';
import type { WorkspaceTreeState } from '../../src/workspace-tree';
import { patchStatedOrder, readStatedOrder, type StatedOrder } from '../../src/workspace-tree/stated-order';
import type { PatchKeep, PatchTally } from '../../src/workspace-tree/three-way-patch';

const workspace = { schemaVersion: 5 as const, uid: 'wsaaaaaa', name: 'Stated Order' };

function state(overrides: Partial<WorkspaceTreeState> = {}): WorkspaceTreeState {
  return {
    workspace,
    rules: [],
    collections: [],
    folders: [],
    requests: [],
    grpcRequests: [],
    websocketRequests: [],
    mqttRequests: [],
    graphqlRequests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    environments: [],
    workspaceVariables: null,
    vault: null,
    trustedRoots: null,
    specs: [],
    liveWorkflows: [],
    liveVariables: [],
    ...overrides,
  };
}

const COL = 'rules/api-col0000a';
const REQUESTS = 'requests/api-rco0000a';

const collection = (uid: string, path: string, order?: string[]): Collection => ({
  schemaVersion: 5,
  uid,
  path,
  name: uid,
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
  ...(order ? { order } : {}),
});

const folder = (uid: string, path: string): Folder => ({ schemaVersion: 5, uid, path, name: uid });

const rule = (uid: string, path: string): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path,
    name: uid,
    type: 'block',
    enabled: true,
    conditions: [],
    action: {},
  }) as Rule;

const request = (uid: string, path: string): Request =>
  ({
    schemaVersion: 5,
    uid,
    path,
    name: uid,
    method: 'GET',
    url: 'https://api.openheaders.io/ping',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
  }) as unknown as Request;

describe('readStatedOrder', () => {
  it('a listed order is the order stated, whatever the tree holds there', () => {
    const listed = collection('col0000a', COL, ['b-rul0000b']);
    expect(readStatedOrder(state({ collections: [listed] }))(listed)).toEqual(['b-rul0000b']);
  });

  it('a container with no key and no child states the empty order', () => {
    const empty = collection('col0000a', COL);
    const elsewhere = rule('rul0000b', 'rules/other-col0000b/b-rul0000b');
    expect(readStatedOrder(state({ collections: [empty], rules: [elsewhere] }))(empty)).toEqual([]);
  });

  it('a container with no key that holds a leaf states none', () => {
    const holding = collection('col0000a', COL);
    expect(
      readStatedOrder(state({ collections: [holding], rules: [rule('rul0000b', `${COL}/b-rul0000b`)] }))(holding),
    ).toBeNull();
  });

  it('…or a folder, in any tree', () => {
    const holding = collection('col0000a', COL);
    const inner = folder('fol0000f', `${COL}/auth-fol0000f`);
    const stated = readStatedOrder(state({ collections: [holding], folders: [inner] }));
    expect(stated(holding)).toBeNull();
    expect(stated(inner)).toEqual([]);

    const api = collection('rco0000a', REQUESTS);
    const ping = request('req00001', `${REQUESTS}/ping-req00001`);
    expect(readStatedOrder(state({ requestCollections: [api], requests: [ping] }))(api)).toBeNull();
  });
});

function laid(current: StatedOrder, from: readonly string[] | undefined, to: StatedOrder, keep: PatchKeep = 'change') {
  const tally: PatchTally = { overridden: 0 };
  return { order: patchStatedOrder(current, from, to, tally, keep), overridden: tally.overridden };
}

describe('patchStatedOrder — a place that holds no child', () => {
  it('the change removes the last child, the branch added one: the branch’s own stays, nothing is counted', () => {
    expect(laid(['b', 'mine'], ['b'], [])).toEqual({ order: ['mine'], overridden: 0 });
  });

  it('the change adds beside one, the branch removed its last: the added one lands alone', () => {
    expect(laid([], ['b'], ['b', 'c'])).toEqual({ order: ['c'], overridden: 0 });
  });

  it('the change reorders, the branch removed them all: nothing is left to order', () => {
    expect(laid([], ['b', 'c'], ['c', 'b'])).toEqual({ order: [], overridden: 0 });
  });

  it('both removed the last child', () => {
    expect(laid([], ['b'], [])).toEqual({ order: [], overridden: 0 });
  });

  it('the change adds the first child beside the branch’s own', () => {
    expect(laid(['mine'], [], ['b'])).toEqual({ order: ['mine', 'b'], overridden: 0 });
  });
});

describe('patchStatedOrder — a place that states no order', () => {
  it('a change that ends stating none leaves the branch’s order as it is', () => {
    expect(laid(['b', 'mine'], ['b'], null)).toEqual({ order: ['b', 'mine'], overridden: 0 });
    expect(laid(['mine'], [], null)).toEqual({ order: ['mine'], overridden: 0 });
  });

  it('a change that ends at the order it started from leaves the branch’s as it is', () => {
    expect(laid(['mine', 'b'], ['b'], ['b'])).toEqual({ order: ['mine', 'b'], overridden: 0 });
    expect(laid(null, ['b'], ['b'])).toEqual({ order: [], overridden: 0 });
  });

  it('a start that lists none reads as empty', () => {
    expect(laid(['mine'], undefined, ['b'])).toEqual({ order: ['mine', 'b'], overridden: 0 });
    expect(laid(['mine'], undefined, [])).toEqual({ order: ['mine'], overridden: 0 });
  });

  it('a branch that states none takes the order the change arrives at, and nothing is counted', () => {
    expect(laid(null, ['b'], ['b', 'c'])).toEqual({ order: ['b', 'c'], overridden: 0 });
    expect(laid(null, ['b'], ['b', 'c'], 'current')).toEqual({ order: ['b', 'c'], overridden: 0 });
  });

  it('where all three state a list the change is laid entry by entry', () => {
    expect(laid(['mine', 'a', 'b', 'tail'], ['a', 'b'], ['b', 'new', 'a'])).toEqual({
      order: ['mine', 'b', 'new', 'a', 'tail'],
      overridden: 0,
    });
  });
});
