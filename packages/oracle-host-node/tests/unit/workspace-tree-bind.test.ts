/**
 * Bind / unbind — exclusivity + identity (the git-sync plan §3.5): lockfile
 * refusal with holder identity, uuid-collision vs identity-mismatch on
 * a foreign manifest, init authoring of workspace.yaml + .gitignore —
 * each at its own name, never through a link standing there, the
 * sidecar a directory of its own with its ignore file — and unbind
 * leaving the tree a valid workspace folder. Adopt (gap K):
 * the pre-flight over a real clone of a bare remote reserves the tree
 * with its manifest identity, refuses the collision / the unreadable
 * manifest / a folder with no manifest / a foreign lock, the
 * ordinary bind of the minted uid re-enters the reservation, and a
 * sidecar another engine left has its records dropped under the lock.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Workspace } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git';
import {
  bindWorkspaceTree,
  probeWorkspaceTree,
  reserveWorkspaceTreeForAdopt,
  unbindWorkspaceTree,
} from '../../src/workspace-tree/bind';

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

/** Isolate every invocation from the developer's global/system git config. */
const git: GitRunner = (args, options) =>
  createGitExec()(args, {
    ...options,
    env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...options.env },
  });

async function run(cwd: string, ...args: string[]): Promise<string> {
  const result = await git(args, { cwd });
  if (result.code !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

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
    expect(manifest).not.toContain('orgId');
    const gitignore = await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf-8');
    expect(gitignore).toBe('.oh/\n*.secret.yaml\n');

    const probe = await probeWorkspaceTree(tmpDir);
    expect(probe).toEqual({ present: true, workspaceUid: 'wsaaaaaa', name: 'Probe Workspace' });
  });

  it("a folder's own .gitignore and .gitattributes keep their lines; the missing ignore entries are appended", async () => {
    await fs.writeFile(path.join(tmpDir, '.gitignore'), 'node_modules/\n.env\n', 'utf-8');
    await fs.writeFile(path.join(tmpDir, '.gitattributes'), '*.png binary\n', 'utf-8');
    const result = await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' });
    expect(result).toEqual({ ok: true, initialized: true });
    expect(await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf-8')).toBe(
      'node_modules/\n.env\n.oh/\n*.secret.yaml\n',
    );
    expect(await fs.readFile(path.join(tmpDir, '.gitattributes'), 'utf-8')).toBe('*.png binary\n');
  });

  it('a folder whose .gitignore is a link binds with the authored file in its place, and nothing written where it pointed', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-bind-outside-'));
    try {
      await fs.symlink(path.join(outside, 'ignore'), path.join(tmpDir, '.gitignore'));
      const result = await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' });
      expect(result).toEqual({ ok: true, initialized: true });
      expect((await fs.lstat(path.join(tmpDir, '.gitignore'))).isFile()).toBe(true);
      expect(await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf-8')).toBe('.oh/\n*.secret.yaml\n');
      expect(await fs.readdir(outside)).toEqual([]);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('the sidecar holds an ignore file of its own from the bind on', async () => {
    await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' });
    expect(await fs.readFile(path.join(tmpDir, '.oh', '.gitignore'), 'utf-8')).toBe('*\n');
  });

  it('a folder whose .oh is a link binds with a sidecar of its own: the lock is taken in it, nothing where the link pointed', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-bind-outside-'));
    try {
      await fs.symlink(outside, path.join(tmpDir, '.oh'));
      const result = await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' });
      expect(result).toEqual({ ok: true, initialized: true });
      expect((await fs.lstat(path.join(tmpDir, '.oh'))).isDirectory()).toBe(true);
      expect((await fs.readdir(path.join(tmpDir, '.oh'))).sort()).toEqual(['.gitignore', 'lock']);
      expect(await fs.readdir(outside)).toEqual([]);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('a workspace.yaml that is a link to nothing is no manifest: the manifest is written in its place, nothing where it pointed', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-bind-outside-'));
    try {
      await fs.symlink(path.join(outside, 'manifest.yaml'), path.join(tmpDir, 'workspace.yaml'));
      const result = await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' });
      expect(result).toEqual({ ok: true, initialized: true });
      expect((await fs.lstat(path.join(tmpDir, 'workspace.yaml'))).isFile()).toBe(true);
      expect(await fs.readFile(path.join(tmpDir, 'workspace.yaml'), 'utf-8')).toContain('uid: wsaaaaaa');
      expect(await fs.readdir(outside)).toEqual([]);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('a directory at workspace.yaml refuses the bind with what stands there, and the lock is given back', async () => {
    await fs.mkdir(path.join(tmpDir, 'workspace.yaml'));
    expect(await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' })).toEqual({
      ok: false,
      reason: 'invalid-manifest',
      message: '"workspace.yaml" is not a file',
    });
    expect(await fs.readdir(path.join(tmpDir, '.oh'))).toEqual([]);
    expect((await fs.lstat(path.join(tmpDir, 'workspace.yaml'))).isDirectory()).toBe(true);
  });

  it('a folder with a directory at .gitignore binds all the same: the directory stands', async () => {
    await fs.mkdir(path.join(tmpDir, '.gitignore'));
    const result = await bindWorkspaceTree({ rootDir: tmpDir, workspace: makeWorkspace(), hostId: 'desktop-1' });
    expect(result).toEqual({ ok: true, initialized: true });
    expect((await fs.lstat(path.join(tmpDir, '.gitignore'))).isDirectory()).toBe(true);
    expect(await fs.readFile(path.join(tmpDir, '.gitattributes'), 'utf-8')).toBe('*.yaml text eol=lf\n');
  });

  it('the probe carries the manifest description when the workspace has one', async () => {
    await bindWorkspaceTree({
      rootDir: tmpDir,
      workspace: makeWorkspace({ description: 'Team rules' }),
      hostId: 'desktop-1',
    });
    const probe = await probeWorkspaceTree(tmpDir);
    expect(probe).toEqual({
      present: true,
      workspaceUid: 'wsaaaaaa',
      name: 'Probe Workspace',
      description: 'Team rules',
    });
  });

  it('the probe of a folder that is not there names what a bind would create, as this host resolves it, and creates nothing', async () => {
    const missing = path.join(tmpDir, 'whatever', 'maybe');
    expect(await probeWorkspaceTree(missing)).toEqual({ present: false, missingFolder: missing });
    expect(await probeWorkspaceTree(path.relative(process.cwd(), missing))).toEqual({
      present: false,
      missingFolder: missing,
    });
    expect(await fs.readdir(tmpDir)).toEqual([]);
  });

  it('the probe names no folder to create where one stands, where a link to nothing or a file has its name, or a file is on the way', async () => {
    expect(await probeWorkspaceTree(tmpDir)).toEqual({ present: false });
    await fs.symlink(path.join(tmpDir, 'nowhere'), path.join(tmpDir, 'dangling'));
    expect(await probeWorkspaceTree(path.join(tmpDir, 'dangling'))).toEqual({ present: false });
    await fs.writeFile(path.join(tmpDir, 'notes.txt'), 'x', 'utf-8');
    expect(await probeWorkspaceTree(path.join(tmpDir, 'notes.txt'))).toEqual({ present: false });
    expect(await probeWorkspaceTree(path.join(tmpDir, 'notes.txt', 'under', 'it'))).toEqual({ present: false });
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
    expect(result).toEqual({
      ok: false,
      reason: 'identity-mismatch',
      treeWorkspaceUid: 'wsother1',
      treeWorkspaceName: 'Probe Workspace',
    });
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

describe('reserveWorkspaceTreeForAdopt', () => {
  /** A bare remote seeded by one engine, then a fresh clone of it — the teammate's onboarding tree. */
  async function cloneOfSeededRemote(): Promise<string> {
    const seedDir = path.join(tmpDir, 'seed');
    const remoteDir = path.join(tmpDir, 'remote.git');
    const cloneDir = path.join(tmpDir, 'clone');
    await bindWorkspaceTree({
      rootDir: seedDir,
      workspace: makeWorkspace({ uid: 'wsremote', name: 'Team Workspace', description: 'Shared rules' }),
      hostId: 'seed-host',
    });
    await unbindWorkspaceTree(seedDir, 'seed-host');
    await run(seedDir, 'init', '-q', '-b', 'main');
    await run(seedDir, 'add', '-A');
    await run(seedDir, '-c', 'user.name=Seed', '-c', 'user.email=seed@openheaders.io', 'commit', '-q', '-m', 'seed');
    await run(tmpDir, 'clone', '-q', '--bare', seedDir, remoteDir);
    await run(tmpDir, 'clone', '-q', `file://${remoteDir}`, cloneDir);
    return cloneDir;
  }

  it('reserves a fresh clone with its manifest identity and the ordinary bind of that uid re-enters the lock', async () => {
    const cloneDir = await cloneOfSeededRemote();
    const reserved = await reserveWorkspaceTreeForAdopt({
      rootDir: cloneDir,
      knownWorkspaceUids: ['wsaaaaaa'],
      hostId: 'desktop-1',
    });
    expect(reserved).toEqual({
      ok: true,
      identity: { workspaceUid: 'wsremote', name: 'Team Workspace', description: 'Shared rules' },
    });
    // The reservation holds the tree against another engine…
    const foreign = await bindWorkspaceTree({
      rootDir: cloneDir,
      workspace: makeWorkspace({ uid: 'wsremote' }),
      hostId: 'daemon-1',
    });
    expect(foreign.ok).toBe(false);
    if (foreign.ok || foreign.reason !== 'locked') throw new Error('expected locked refusal');
    expect(foreign.holder.hostId).toBe('desktop-1');
    // …and the minting engine binds through it without re-initializing.
    const bound = await bindWorkspaceTree({
      rootDir: cloneDir,
      workspace: makeWorkspace({ uid: 'wsremote', name: 'Team Workspace' }),
      knownWorkspaceUids: ['wsaaaaaa'],
      hostId: 'desktop-1',
    });
    expect(bound).toEqual({ ok: true, initialized: false });
    expect(await run(cloneDir, 'status', '--porcelain')).toBe('');
  });

  it('refuses a clone whose uid this host already holds (the §3.5 collision) and takes no lock', async () => {
    const cloneDir = await cloneOfSeededRemote();
    const reserved = await reserveWorkspaceTreeForAdopt({
      rootDir: cloneDir,
      knownWorkspaceUids: ['wsaaaaaa', 'wsremote'],
      hostId: 'desktop-1',
    });
    expect(reserved).toEqual({ ok: false, reason: 'uuid-collision', treeWorkspaceUid: 'wsremote' });
    await expect(fs.stat(path.join(cloneDir, '.oh', 'lock'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('refuses a folder with no manifest and an unreadable one', async () => {
    expect(
      await reserveWorkspaceTreeForAdopt({ rootDir: tmpDir, knownWorkspaceUids: [], hostId: 'desktop-1' }),
    ).toEqual({ ok: false, reason: 'not-a-workspace' });
    await fs.writeFile(path.join(tmpDir, 'workspace.yaml'), 'uid: [broken\n', 'utf-8');
    const broken = await reserveWorkspaceTreeForAdopt({ rootDir: tmpDir, knownWorkspaceUids: [], hostId: 'desktop-1' });
    expect(broken.ok).toBe(false);
    if (broken.ok) throw new Error('unreachable');
    expect(broken.reason).toBe('invalid-manifest');
  });

  it('refuses a tree another engine holds, and a released reservation frees it', async () => {
    const cloneDir = await cloneOfSeededRemote();
    await bindWorkspaceTree({ rootDir: cloneDir, workspace: makeWorkspace({ uid: 'wsremote' }), hostId: 'daemon-1' });
    const held = await reserveWorkspaceTreeForAdopt({ rootDir: cloneDir, knownWorkspaceUids: [], hostId: 'desktop-1' });
    expect(held.ok).toBe(false);
    if (held.ok || held.reason !== 'locked') throw new Error('expected locked refusal');
    expect(held.holder.hostId).toBe('daemon-1');
    await unbindWorkspaceTree(cloneDir, 'daemon-1');

    const reserved = await reserveWorkspaceTreeForAdopt({
      rootDir: cloneDir,
      knownWorkspaceUids: [],
      hostId: 'desktop-1',
    });
    expect(reserved.ok).toBe(true);
    // A failed mint releases the reservation the same way unbind does.
    await unbindWorkspaceTree(cloneDir, 'desktop-1');
    const other = await bindWorkspaceTree({
      rootDir: cloneDir,
      workspace: makeWorkspace({ uid: 'wsremote' }),
      hostId: 'daemon-1',
    });
    expect(other).toEqual({ ok: true, initialized: false });
  });

  it('drops what a sidecar another engine left records of the folder’s files, under the lock it takes — and nothing while that engine holds the folder', async () => {
    const cloneDir = await cloneOfSeededRemote();
    const sidecar = path.join(cloneDir, '.oh');
    const records = ['materialized-index.json', 'quarantined-files.json', 'unknown-fields.json'];
    await bindWorkspaceTree({ rootDir: cloneDir, workspace: makeWorkspace({ uid: 'wsremote' }), hostId: 'daemon-1' });
    for (const file of records) {
      await fs.writeFile(path.join(sidecar, file), '{"rules/api-col0000a/_collection.yaml":"00"}', 'utf-8');
    }

    const held = await reserveWorkspaceTreeForAdopt({ rootDir: cloneDir, knownWorkspaceUids: [], hostId: 'desktop-1' });
    expect(held).toMatchObject({ ok: false, reason: 'locked' });
    expect((await fs.readdir(sidecar)).sort()).toEqual(['.gitignore', 'lock', ...records].sort());

    await unbindWorkspaceTree(cloneDir, 'daemon-1');
    expect((await fs.readdir(sidecar)).sort()).toEqual(['.gitignore', ...records].sort());
    const reserved = await reserveWorkspaceTreeForAdopt({
      rootDir: cloneDir,
      knownWorkspaceUids: [],
      hostId: 'desktop-1',
    });
    expect(reserved.ok).toBe(true);
    expect((await fs.readdir(sidecar)).sort()).toEqual(['.gitignore', 'lock']);
  });
});
