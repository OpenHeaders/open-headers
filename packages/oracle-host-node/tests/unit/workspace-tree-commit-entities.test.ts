/**
 * The read that names a commit's files by what they belonged to there
 * (`commit-entities`): an entity from its manifest in the commit, a file
 * the commit removes from its first parent, a sibling file by the
 * manifest of its directory, the collection and folders above it
 * outermost first, a name as the commit held it, and nothing for a file
 * that belongs to no entity. Real git in a scratch repo.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { commitWorkspaceTree, ensureWorkspaceRepo, localHeadSha } from '../../src/git/repo';
import { readCommitEntities } from '../../src/workspace-tree/commit-entities';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};

const COLLECTION = 'requests/orders-col00001';
const FOLDER = `${COLLECTION}/reads-fld00001`;
const LIST = `${FOLDER}/list-orders-req00004`;
const CREATE = `${COLLECTION}/create-order-req00003`;

let rootDir: string;
let run: GitRunner;

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-commit-entities-'));
  const base = createGitExec({ audit: () => undefined });
  run = (args, options) =>
    base(args, { ...options, env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...options.env } });
  await ensureWorkspaceRepo(run, rootDir);
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const target = path.join(rootDir, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
}

async function commit(message: string): Promise<string> {
  const result = await commitWorkspaceTree({ run, rootDir, message, identityEnv: IDENTITY_ENV });
  if (!result.ok || !result.committed) throw new Error(`commit failed: ${message}`);
  const sha = await localHeadSha(run, rootDir);
  if (sha === null) throw new Error('no head');
  return sha;
}

async function seed(): Promise<string> {
  await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
  await write(`${COLLECTION}/_collection.yaml`, 'schemaVersion: 5\nuid: col00001\nname: Orders\n');
  await write(`${FOLDER}/_folder.yaml`, 'schemaVersion: 5\nuid: fld00001\nname: Reads\n');
  await write(`${LIST}/request.yaml`, 'schemaVersion: 5\nuid: req00004\nname: List Orders\nmethod: GET\n');
  await write(`${CREATE}/request.yaml`, 'schemaVersion: 5\nuid: req00003\nname: Create Order\nmethod: POST\n');
  await write(`${CREATE}/body.json`, '{}\n');
  await write('environments/staging-env00001.yaml', 'schemaVersion: 5\nuid: env00001\nname: Staging\n');
  await write('notes/orders.md', 'notes\n');
  return commit('seed');
}

const ORDERS = { kind: 'collection', tree: 'requests', uid: 'col00001', name: 'Orders' };
const READS = { kind: 'folder', tree: 'requests', uid: 'fld00001', name: 'Reads' };

describe('readCommitEntities', () => {
  it('names a file by the manifest the commit holds, with the collection and folders above it outermost first', async () => {
    const sha = await seed();
    expect(await readCommitEntities(run, rootDir, sha, [`${LIST}/request.yaml`])).toEqual([
      {
        path: `${LIST}/request.yaml`,
        entity: { kind: 'request', tree: 'requests', uid: 'req00004', name: 'List Orders', method: 'GET' },
        containers: [ORDERS, READS],
      },
    ]);
  });

  it('a sibling file is its directory’s entity; a collection and an environment have nothing above them', async () => {
    const sha = await seed();
    const read = await readCommitEntities(run, rootDir, sha, [
      `${CREATE}/body.json`,
      `${COLLECTION}/_collection.yaml`,
      'environments/staging-env00001.yaml',
    ]);
    expect(read?.map((file) => [file.path, file.entity.uid, file.containers.map((held) => held.uid)])).toEqual([
      [`${CREATE}/body.json`, 'req00003', ['col00001']],
      [`${COLLECTION}/_collection.yaml`, 'col00001', []],
      ['environments/staging-env00001.yaml', 'env00001', []],
    ]);
  });

  it('a file the commit removes is named from its first parent — the folder it removes with it too', async () => {
    await seed();
    await fs.rm(path.join(rootDir, FOLDER), { recursive: true });
    const sha = await commit('delete the reads folder');
    expect(await readCommitEntities(run, rootDir, sha, [`${LIST}/request.yaml`, `${FOLDER}/_folder.yaml`])).toEqual([
      {
        path: `${LIST}/request.yaml`,
        entity: { kind: 'request', tree: 'requests', uid: 'req00004', name: 'List Orders', method: 'GET' },
        containers: [ORDERS, READS],
      },
      { path: `${FOLDER}/_folder.yaml`, entity: READS, containers: [ORDERS] },
    ]);
  });

  it('reads the name the commit held, not the one before it', async () => {
    await seed();
    await write(`${CREATE}/request.yaml`, 'schemaVersion: 5\nuid: req00003\nname: Place Order\nmethod: POST\n');
    const sha = await commit('rename');
    const read = await readCommitEntities(run, rootDir, sha, [`${CREATE}/request.yaml`, `${CREATE}/body.json`]);
    expect(read?.map((file) => file.entity.name)).toEqual(['Place Order', 'Place Order']);
  });

  it('leaves out a file that belongs to no entity, and a directory with no manifest to read', async () => {
    const sha = await seed();
    expect(
      await readCommitEntities(run, rootDir, sha, [
        'notes/orders.md',
        'workspace.yaml',
        'requests/gone-col00009/ping-req00009/request.yaml',
        'requests/gone-col00009/ping-req00009/body.json',
      ]),
    ).toEqual([]);
  });

  it('the first commit has no parent to read from; an unknown commit answers null', async () => {
    const sha = await seed();
    expect(await readCommitEntities(run, rootDir, sha, [`${CREATE}/pre-request.js`])).toEqual([
      expect.objectContaining({ path: `${CREATE}/pre-request.js`, containers: [ORDERS] }),
    ]);
    expect(await readCommitEntities(run, rootDir, '0'.repeat(40), [`${CREATE}/request.yaml`])).toBeNull();
  });
});
