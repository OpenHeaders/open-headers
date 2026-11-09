/**
 * Push window model pins: the target line off the status frame (a
 * tracked branch splits its upstream into remote and branch, a branch
 * without one names the first-push rule, a detached HEAD and an
 * unborn or unbound tree each read typed), the title's folder name,
 * the Push verb's gate, and the target row's range base.
 */

import type {
  WorkspaceTreeGitStatusWire,
  WorkspaceTreeLogEntryWire,
  WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';
import {
  canPush,
  folderNameOf,
  pushTarget,
  rangeDiffBase,
} from '@openheaders/ui/workbench/components/panels/git/push/push-window-model';
import { describe, expect, it } from 'vitest';

function status(overrides: Partial<WorkspaceTreeGitStatusWire> = {}): WorkspaceTreeGitStatusWire {
  return {
    bound: true,
    git: { available: true, version: '2.45.0' },
    repo: true,
    branch: 'main',
    headSha: 'b55ab33c'.padEnd(40, '0'),
    branches: ['main'],
    dirtyFiles: 0,
    userIndexBusy: false,
    suggestedMessage: '',
    cadence: 'off',
    bypassHooks: false,
    upstream: 'origin/main',
    ahead: 1,
    behind: 0,
    autoPushOnCommit: false,
    forcePush: null,
    shallow: false,
    ...overrides,
  };
}

describe('pushTarget', () => {
  it('splits a tracked upstream into remote and branch at the first slash', () => {
    expect(pushTarget(status())).toEqual({
      kind: 'upstream',
      branch: 'main',
      remote: 'origin',
      remoteBranch: 'main',
      upstream: 'origin/main',
    });
    expect(pushTarget(status({ branch: 'feature/auth', upstream: 'origin/feature/auth' }))).toMatchObject({
      remote: 'origin',
      remoteBranch: 'feature/auth',
    });
  });

  it('a branch without an upstream names the first-push rule', () => {
    expect(pushTarget(status({ upstream: null, ahead: null, behind: null }))).toEqual({
      kind: 'new-upstream',
      branch: 'main',
    });
  });

  it('a detached HEAD, an unborn branch and an unbound tree read typed', () => {
    expect(pushTarget(status({ branch: null }))).toEqual({ kind: 'detached' });
    expect(pushTarget(status({ headSha: null }))).toEqual({ kind: 'none' });
    expect(pushTarget(status({ bound: false }))).toEqual({ kind: 'none' });
    expect(pushTarget(null)).toEqual({ kind: 'none' });
  });
});

describe('folderNameOf / canPush', () => {
  it('names the root folder with trailing separators trimmed', () => {
    expect(folderNameOf('/tmp/hold/repo/ws')).toBe('ws');
    expect(folderNameOf('/tmp/hold/repo/ws/')).toBe('ws');
    expect(folderNameOf('C:\\work\\ws\\')).toBe('ws');
    expect(folderNameOf(null)).toBe('');
  });

  it('push is live only on a branch with something to send', () => {
    expect(canPush(pushTarget(status()), 2)).toBe(true);
    expect(canPush(pushTarget(status()), 0)).toBe(false);
    expect(canPush(pushTarget(status({ upstream: null })), 3)).toBe(true);
    expect(canPush(pushTarget(status({ branch: null })), 3)).toBe(false);
  });
});

function entry(sha: string, files: Array<[string, string]>): WorkspaceTreeLogEntryWire {
  return {
    sha: sha.padEnd(40, '0'),
    parents: [],
    authorName: 'John Doe',
    authorEmail: 'john@openheaders.io',
    authoredAt: '2026-11-02T09:00:00Z',
    subject: sha,
    coAuthors: [],
    files: files.map(([path, status]) => ({ path, status })),
  };
}

describe('rangeDiffBase', () => {
  const refs: WorkspaceTreeRefWire[] = [
    { name: 'main', kind: 'local', sha: 'a'.repeat(40) },
    { name: 'origin/main', kind: 'remote', sha: 'd'.repeat(40) },
  ];

  it('a tracked branch diffs against the upstream ref row', () => {
    expect(rangeDiffBase(pushTarget(status()), [entry('c', [])], refs)).toBe('d'.repeat(40));
    expect(rangeDiffBase(pushTarget(status({ upstream: 'origin/other' })), [entry('c', [])], refs)).toBeNull();
  });

  it("a branch without an upstream diffs from the oldest outgoing commit's first parent", () => {
    const oldest = { ...entry('a', []), parents: ['9'.repeat(40)] };
    expect(rangeDiffBase(pushTarget(status({ upstream: null })), [entry('c', []), oldest], refs)).toBe('9'.repeat(40));
    expect(rangeDiffBase(pushTarget(status({ upstream: null })), [entry('c', [])], refs)).toBeNull();
    expect(rangeDiffBase(pushTarget(status({ branch: null })), [entry('c', [])], refs)).toBeNull();
  });
});
