/**
 * The client's per-workspace HEAD tracker (the git-sync plan §3.5): the
 * first SYNCED for a workspace records silently, an identical stamp is
 * silence, a different stamp is ONE change, and a frame without a
 * stamp forgets the workspace so a later rebind starts over.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { foldScopeGitHead, resetScopeGitHeadTrackerForTests } from '../../../src/sync/client/scope-git-head-tracker';

describe('foldScopeGitHead', () => {
  beforeEach(() => {
    resetScopeGitHeadTrackerForTests();
  });

  it('is silent on the first frame for a workspace', () => {
    expect(foldScopeGitHead('ws-1', 'main')).toBeNull();
  });

  it('is silent while the stamp holds', () => {
    foldScopeGitHead('ws-1', 'main');
    expect(foldScopeGitHead('ws-1', 'main')).toBeNull();
    expect(foldScopeGitHead('ws-1', 'main')).toBeNull();
  });

  it('reports a changed stamp once, then holds the new one', () => {
    foldScopeGitHead('ws-1', 'main');
    expect(foldScopeGitHead('ws-1', 'feature/auth-headers')).toEqual({
      workspaceId: 'ws-1',
      previous: 'main',
      gitHead: 'feature/auth-headers',
    });
    expect(foldScopeGitHead('ws-1', 'feature/auth-headers')).toBeNull();
  });

  it('tracks workspaces independently', () => {
    foldScopeGitHead('ws-1', 'main');
    foldScopeGitHead('ws-2', 'main');
    expect(foldScopeGitHead('ws-2', 'release')).toMatchObject({ workspaceId: 'ws-2', gitHead: 'release' });
    expect(foldScopeGitHead('ws-1', 'main')).toBeNull();
  });

  it('a frame without a stamp forgets the workspace — the next stamp is a first frame again', () => {
    foldScopeGitHead('ws-1', 'main');
    expect(foldScopeGitHead('ws-1', null)).toBeNull();
    expect(foldScopeGitHead('ws-1', 'release')).toBeNull();
    expect(foldScopeGitHead('ws-1', 'main')).toMatchObject({ previous: 'release', gitHead: 'main' });
  });

  it('a detached stamp and the empty stamp are identities like any other', () => {
    foldScopeGitHead('ws-1', 'main');
    expect(foldScopeGitHead('ws-1', '@{0123456789abcdef0123456789abcdef01234567}')).toMatchObject({
      previous: 'main',
    });
    expect(foldScopeGitHead('ws-1', '')).toMatchObject({ gitHead: '' });
  });
});
