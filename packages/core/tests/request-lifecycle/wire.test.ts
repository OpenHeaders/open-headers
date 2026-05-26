import { describe, expect, it } from 'vitest';

import { LIFECYCLE_PORT_PREFIX, lifecyclePortName, parseLifecyclePortName } from '../../src/request-lifecycle/wire';

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

  it('rejects negative tab ids', () => {
    expect(parseLifecyclePortName('oh-lifecycle:-1')).toBeNull();
  });
});
