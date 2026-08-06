import { describe, expect, it } from 'vitest';

import {
  LIFECYCLE_PORT_PREFIX,
  lifecyclePortName,
  parseLifecyclePortName,
  parseQualifiedLifecyclePortName,
  parseReplayLifecyclePortName,
  qualifiedLifecyclePortName,
  REPLAY_LIFECYCLE_PORT_PREFIX,
  replayLifecyclePortName,
} from '../../src/request-lifecycle/wire';

describe('parseLifecyclePortName', () => {
  it('round-trips valid tab ids', () => {
    expect(parseLifecyclePortName(lifecyclePortName(0))).toBe(0);
    expect(parseLifecyclePortName(lifecyclePortName(42))).toBe(42);
  });

  it('returns null when the prefix does not match', () => {
    expect(parseLifecyclePortName('oh-page:7')).toBeNull();
    expect(parseLifecyclePortName('lifecycle:7')).toBeNull();
  });

  it('returns null for an empty suffix', () => {
    expect(parseLifecyclePortName(LIFECYCLE_PORT_PREFIX)).toBeNull();
  });

  it('rejects numeric-prefix-then-garbage suffixes', () => {
    expect(parseLifecyclePortName('oh-lifecycle:12abc')).toBeNull();
    expect(parseLifecyclePortName('oh-lifecycle:7 ')).toBeNull();
    expect(parseLifecyclePortName('oh-lifecycle:0x1f')).toBeNull();
    expect(parseLifecyclePortName('oh-lifecycle:1.5')).toBeNull();
  });

  it('accepts negative tab ids — reserved synthetic partitions (the proxy source)', () => {
    // The proxy capture source lives under the fixed negative sentinel
    // PROXY_LIFECYCLE_TAB_ID; the parser admits it and each acceptor
    // decides which partitions it serves (the extension refuses < 0).
    expect(parseLifecyclePortName('oh-lifecycle:-1')).toBe(-1);
    expect(parseLifecyclePortName('oh-lifecycle:-59210')).toBe(-59210);
    expect(parseLifecyclePortName(lifecyclePortName(-59210))).toBe(-59210);
  });

  it('rejects the peer-qualified shape — local acceptors never serve remote partitions', () => {
    expect(parseLifecyclePortName('oh-lifecycle:7@node-a')).toBeNull();
  });
});

describe('parseQualifiedLifecyclePortName', () => {
  it('round-trips tabId + nodeId', () => {
    expect(parseQualifiedLifecyclePortName(qualifiedLifecyclePortName(7, 'node-a'))).toEqual({
      tabId: 7,
      nodeId: 'node-a',
    });
    expect(parseQualifiedLifecyclePortName(qualifiedLifecyclePortName(-59210, 'x'))).toEqual({
      tabId: -59210,
      nodeId: 'x',
    });
  });

  it('returns null for the unqualified shape, bad tab parts, and empty nodeIds', () => {
    expect(parseQualifiedLifecyclePortName('oh-lifecycle:7')).toBeNull();
    expect(parseQualifiedLifecyclePortName('oh-lifecycle:@node-a')).toBeNull();
    expect(parseQualifiedLifecyclePortName('oh-lifecycle:7@')).toBeNull();
    expect(parseQualifiedLifecyclePortName('oh-lifecycle:12abc@node-a')).toBeNull();
    expect(parseQualifiedLifecyclePortName('oh-page:7@node-a')).toBeNull();
  });
});

describe('parseReplayLifecyclePortName', () => {
  it('round-trips archive ids (session directory basenames)', () => {
    const id = '2026-08-06T10-15-30-123Z-openheaders-io-cap-1';
    expect(parseReplayLifecyclePortName(replayLifecyclePortName(id))).toBe(id);
  });

  it('returns null for foreign prefixes and an empty id', () => {
    expect(parseReplayLifecyclePortName('oh-lifecycle:7')).toBeNull();
    expect(parseReplayLifecyclePortName(REPLAY_LIFECYCLE_PORT_PREFIX)).toBeNull();
  });

  it('refuses path-shaped ids — the archive id is a pure basename', () => {
    expect(parseReplayLifecyclePortName('oh-replay:../escape')).toBeNull();
    expect(parseReplayLifecyclePortName('oh-replay:a/b')).toBeNull();
    expect(parseReplayLifecyclePortName('oh-replay:a\\b')).toBeNull();
    expect(parseReplayLifecyclePortName('oh-replay:.hidden')).toBeNull();
  });
});
