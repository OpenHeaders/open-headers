/**
 * The §6.3 HEAD stamp vocabulary: a branch name is itself, a detached
 * HEAD is `@{<sha>}`, nothing is `''` — and the reader gives each back.
 */

import { describe, expect, it } from 'vitest';
import { DETACHED_HEAD_STAMP_PREFIX, detachedHeadStamp, readHeadStamp } from '../../src/workspace-tree';

const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('head stamp', () => {
  it('a detached stamp opens with a sequence no ref name may contain and closes the brace', () => {
    expect(detachedHeadStamp(SHA)).toBe(`@{${SHA}}`);
    expect(detachedHeadStamp(SHA).startsWith(DETACHED_HEAD_STAMP_PREFIX)).toBe(true);
  });

  it('reads a branch name as a branch', () => {
    expect(readHeadStamp('main')).toEqual({ kind: 'branch', name: 'main' });
    expect(readHeadStamp('feature/auth-headers')).toEqual({ kind: 'branch', name: 'feature/auth-headers' });
  });

  it('reads a detached stamp back to its sha', () => {
    expect(readHeadStamp(detachedHeadStamp(SHA))).toEqual({ kind: 'detached', sha: SHA });
  });

  it('reads the empty stamp as no HEAD', () => {
    expect(readHeadStamp('')).toEqual({ kind: 'none' });
  });
});
