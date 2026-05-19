import type { AwarenessState, PresenceIdentity } from '@openheaders/core/protocol';
import { describe, expect, it } from 'vitest';
import { groupPresence, type PresenceTreeNode } from '@openheaders/ui/shared/awareness/presence-grouping';

function id(overrides: Partial<PresenceIdentity> = {}): PresenceIdentity {
  return {
    instanceId: 'inst-1',
    surfaceKind: 'workbench',
    appId: 'extension',
    label: 'Workbench',
    ...overrides,
  };
}

function state(identity: PresenceIdentity): AwarenessState {
  return {
    identity,
    entityFocus: null,
    fieldFocus: null,
    dirtyFields: [],
    lastActivityHlc: { physicalMs: 0, logical: 0, nodeId: identity.instanceId },
  };
}

const localId = id({ instanceId: 'local' });

function leafIds(nodes: PresenceTreeNode[]): string[] {
  const out: string[] = [];
  walk(nodes, (n) => {
    if (n.kind === 'leaf') out.push(n.state.identity.instanceId);
  });
  return out;
}

function walk(nodes: PresenceTreeNode[], visit: (n: PresenceTreeNode) => void): void {
  for (const n of nodes) {
    visit(n);
    if (n.kind === 'group') walk(n.children, visit);
  }
}

function asGroup(node: PresenceTreeNode): Extract<PresenceTreeNode, { kind: 'group' }> {
  if (node.kind !== 'group') throw new Error('expected group node');
  return node;
}

describe('groupPresence', () => {
  it('returns an empty tree for empty input', () => {
    expect(groupPresence([], localId)).toEqual([]);
  });

  it('Mode 1: all peers share undefined user/device/host → still renders all three header levels', () => {
    // Architectural choice: never collapse single-bucket levels. The
    // popover is the window into the identity model; communicating
    // user / device / host as independent axes from day one matters
    // even when they happen to be uniform today.
    const peers = [
      state(id({ instanceId: 'p1', surfaceKind: 'popup' })),
      state(id({ instanceId: 'p2', surfaceKind: 'devpanel' })),
    ];
    const tree = groupPresence(peers, localId);
    expect(tree).toHaveLength(1);
    const userNode = asGroup(tree[0]);
    expect(userNode.level).toBe('user');
    expect(userNode.label).toBe('Local');
    expect(userNode.isLocal).toBe(true);
    expect(userNode.children).toHaveLength(1);
    const deviceNode = asGroup(userNode.children[0]);
    expect(deviceNode.level).toBe('device');
    expect(deviceNode.label).toBe('This device');
    expect(deviceNode.isLocal).toBe(true);
    expect(deviceNode.children).toHaveLength(1);
    const hostNode = asGroup(deviceNode.children[0]);
    expect(hostNode.level).toBe('host');
    expect(hostNode.label).toBe('This browser');
    expect(hostNode.isLocal).toBe(true);
    expect(leafIds(hostNode.children)).toEqual(['p1', 'p2']);
  });

  it('Mode 2: same device, two browsers → user/device single-bucket headers + two host buckets', () => {
    const peers = [
      state(id({ instanceId: 'chr-1', browserContext: { browser: 'chrome' } })),
      state(id({ instanceId: 'chr-2', surfaceKind: 'popup', browserContext: { browser: 'chrome' } })),
      state(id({ instanceId: 'edge-1', browserContext: { browser: 'edge' } })),
    ];
    const tree = groupPresence(peers, id({ instanceId: 'local', browserContext: { browser: 'chrome' } }));
    const user = asGroup(tree[0]);
    const device = asGroup(user.children[0]);
    expect(device.children).toHaveLength(2);
    const chrome = asGroup(device.children[0]);
    const edge = asGroup(device.children[1]);
    expect(chrome.label).toBe('Chrome');
    expect(chrome.isLocal).toBe(true);
    expect(edge.label).toBe('Edge');
    expect(edge.isLocal).toBe(false);
    expect(leafIds(chrome.children)).toEqual(['chr-1', 'chr-2']);
    expect(leafIds(edge.children)).toEqual(['edge-1']);
  });

  it('Mode 2: extension surface in Chrome + desktop surface coexist as distinct host buckets', () => {
    // The case the docs call T2 (same user, same machine, ext+desktop
    // on localhost). Desktop surface has no browserContext and must
    // not get lumped into the extension's Chrome bucket.
    const peers = [
      state(id({ instanceId: 'ext', appId: 'extension', browserContext: { browser: 'chrome' } })),
      state(id({ instanceId: 'desk', appId: 'desktop' })),
    ];
    const tree = groupPresence(
      peers,
      id({ instanceId: 'local-ext', appId: 'extension', browserContext: { browser: 'chrome' } }),
    );
    const device = asGroup(asGroup(tree[0]).children[0]);
    expect(device.children).toHaveLength(2);
    const ext = asGroup(device.children[0]);
    const desk = asGroup(device.children[1]);
    expect(ext.label).toBe('Chrome');
    expect(ext.isLocal).toBe(true);
    expect(desk.label).toBe('Desktop app');
    expect(desk.isLocal).toBe(false);
    expect(leafIds(ext.children)).toEqual(['ext']);
    expect(leafIds(desk.children)).toEqual(['desk']);
  });

  it('future: openheaders.io web bundle in Chrome buckets separately from extension in Chrome', () => {
    const peers = [
      state(id({ instanceId: 'ext', appId: 'extension', browserContext: { browser: 'chrome' } })),
      state(id({ instanceId: 'web', appId: 'web', browserContext: { browser: 'chrome' } })),
    ];
    const tree = groupPresence(peers, localId);
    const device = asGroup(asGroup(tree[0]).children[0]);
    expect(device.children).toHaveLength(2);
    const ext = asGroup(device.children[0]);
    const web = asGroup(device.children[1]);
    expect(ext.label).toBe('Chrome');
    expect(web.label).toBe('Chrome (web)');
    expect(leafIds(ext.children)).toEqual(['ext']);
    expect(leafIds(web.children)).toEqual(['web']);
  });

  it('Mode 3: two users → top-level user buckets; per-user device + browser layers always render', () => {
    const peers = [
      // Alice: one device, one browser.
      state(id({ instanceId: 'a-1', userId: 'alice', deviceId: 'a-laptop' })),
      // Bob: two devices.
      state(id({ instanceId: 'b-1', userId: 'bob', deviceId: 'b-laptop' })),
      state(id({ instanceId: 'b-2', userId: 'bob', deviceId: 'b-desktop' })),
    ];
    const tree = groupPresence(peers, id({ instanceId: 'local', userId: 'alice', deviceId: 'a-laptop' }));
    expect(tree).toHaveLength(2);
    const alice = asGroup(tree[0]);
    const bob = asGroup(tree[1]);
    expect(alice.label).toBe('alice');
    expect(alice.isLocal).toBe(true);
    expect(bob.label).toBe('bob');
    expect(bob.isLocal).toBe(false);
    // Alice has one device — header still renders.
    expect(alice.children).toHaveLength(1);
    expect(asGroup(alice.children[0]).level).toBe('device');
    // Bob has two devices.
    expect(bob.children).toHaveLength(2);
    expect(bob.children.every((c) => c.kind === 'group' && c.level === 'device')).toBe(true);
    expect(leafIds(bob.children)).toEqual(['b-1', 'b-2']);
  });

  it('flags the local browser as isLocal when browser+profile match', () => {
    const local = id({
      instanceId: 'local',
      browserContext: { browser: 'chrome', profile: 'Work' },
    });
    const peers = [
      state(id({ instanceId: 'chr-work', browserContext: { browser: 'chrome', profile: 'Work' } })),
      state(id({ instanceId: 'chr-personal', browserContext: { browser: 'chrome', profile: 'Personal' } })),
    ];
    const tree = groupPresence(peers, local);
    const device = asGroup(asGroup(tree[0]).children[0]);
    expect(device.children).toHaveLength(2);
    const work = asGroup(device.children[0]);
    const personal = asGroup(device.children[1]);
    expect(work.label).toBe('Chrome (Work)');
    expect(work.isLocal).toBe(true);
    expect(personal.label).toBe('Chrome (Personal)');
    expect(personal.isLocal).toBe(false);
  });

  it('keeps insertion order of incoming presence within each host bucket', () => {
    const peers = [
      state(id({ instanceId: 'a', browserContext: { browser: 'chrome' } })),
      state(id({ instanceId: 'b', browserContext: { browser: 'edge' } })),
      state(id({ instanceId: 'c', browserContext: { browser: 'chrome' } })),
    ];
    const tree = groupPresence(peers, localId);
    const hosts = asGroup(asGroup(asGroup(tree[0]).children[0])).children;
    const chrome = asGroup(hosts[0]);
    const edge = asGroup(hosts[1]);
    expect(leafIds(chrome.children)).toEqual(['a', 'c']);
    expect(leafIds(edge.children)).toEqual(['b']);
  });
});
