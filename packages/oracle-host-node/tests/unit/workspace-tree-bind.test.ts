/**
 * Bind / unbind — exclusivity + identity (GIT_PLAN.md §3.5): lockfile
 * refusal with holder identity, uuid-collision vs identity-mismatch on
 * a foreign manifest, init authoring of workspace.yaml + .gitignore,
 * and unbind leaving the tree a valid workspace folder.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Workspace } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bindWorkspaceTree, probeWorkspaceTree, unbindWorkspaceTree } from '../../src/workspace-tree/bind';

const ORG_ID = '019637a2-7b9a-7b9a-8b9a-1234567890ab';

function makeWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    schemaVersion: 5,
    uid: 'wsaaaaaa',
    name: 'Probe Workspace',
    orgId: ORG_ID,
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-bind-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('bindWorkspaceTree', () => {
  it('initializes an empty folder with workspace.yaml + .gitignore and holds the lock', async () => {
    const result = await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' });
    expect(result).toEqual({ ok: true, initialized: true });

    const manifest = await fs.readFile(path.join(tmpDir, 'workspace.yaml'), 'utf-8');
    expect(manifest).toContain('uid: wsaaaaaa');
    expect(manifest).toContain(`orgId: ${ORG_ID}`);
    const gitignore = await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(gitignore).toBe('.oh/\n*.secret.yaml\n');

    const probe = await probeWorkspaceTree(tmpDir);
    expect(probe).toEqual({ present: true, workspaceUid: 'wsaaaaaa', name: 'Probe Workspace' });
  });

  it('is re-entrant for the same host but refuses a second engine instance', async () => {
    expect((await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' })).ok).toBe(
      true,
    );
    expect((await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' })).ok).toBe(
      true,
    );

    const second = await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'daemon-1' });
    expect(second.ok).toBe(false);
    if (second.ok || second.reason !== 'locked') throw new Error('expected locked refusal');
    expect(second.holder.hostId).toBe('desktop-1');
  });

  it('replaces a stale lock whose holder process is gone', async () => {
    await fs.mkdir(path.join(tmpDir, '.oh'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.oh', 'lock'),
      JSON.stringify({ pid: 999_999_999, hostId: 'dead-host', acquiredAt: '2026-01-01T00:00:00.000Z' }),
      'utf-8',
    );
    const result = await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' });
    expect(result.ok).toBe(true);
  });

  it('refuses a tree already claimed by a workspace known on this host (clone collision)', async () => {
    await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace({ uid: 'wsother1' }), hostId: 'other' });
    await unbindWorkspaceTree(tmpDir, 'other');

    const result = await bindWorkspaceTree({
      rootDir: tmpDir,
      workspace: makeWorkspace(),
      knownWorkspaceUids: ['wsother1'],
      hostId: 'desktop-1',
    });
    expect(result).toEqual({ ok: false, reason: 'uuid-collision', treeWorkspaceUid: 'wsother1' });
  });

  it('refuses a tree that belongs to a different, unknown workspace', async () => {
    await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace({ uid: 'wsother1' }), hostId: 'other' });
    await unbindWorkspaceTree(tmpDir, 'other');

    const result = await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' });
    expect(result).toEqual({ ok: false, reason: 'identity-mismatch', treeWorkspaceUid: 'wsother1' });
  });

  it('refuses an unparseable manifest', async () => {
    await fs.writeFile(path.join(tmpDir, 'workspace.yaml'), 'uid: [broken\n', 'utf-8');
    const result = await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe('invalid-manifest');
  });

  it('unbind releases the lock so another engine can bind', async () => {
    await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' });
    await unbindWorkspaceTree(tmpDir, 'desktop-1');

    const rebind = await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'daemon-1' });
    expect(rebind).toEqual({ ok: true, initialized: false });
  });
});
