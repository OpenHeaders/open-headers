/**
 * Commit signatures (`signature-ops`) — the read behind the log's GPG
 * Signature column: which commits of a list are signed, and what git
 * makes of each signature. Real git in a scratch repo, signing with an
 * SSH key made for the test: a signer the allowed list holds verifies,
 * one it does not is unvouched for, a signature with no allowed list at
 * all still reads as signed (git's own letter says "none" there), and a
 * history with no signature asks nothing of the verifier.
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { ensureWorkspaceRepo, localHeadSha } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';
import { parseSignedShas, readCommitSignatures, signatureState } from '../../src/git/signature-ops';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};

let rootDir: string;
let keyDir: string;
let run: GitRunner;
/** Every invocation's arguments, in order — what a read asked of git. */
let calls: (readonly string[])[];

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-signatures-'));
  keyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-signature-keys-'));
  calls = [];
  const base = createGitExec({ audit: () => undefined });
  run = (args, options) => {
    calls.push(args);
    return base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...IDENTITY_ENV, ...options.env },
    });
  };
  await ensureWorkspaceRepo(run, rootDir);
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
  await fs.rm(keyDir, { recursive: true, force: true });
});

async function git(...args: string[]): Promise<number> {
  return (await run([...repoArgs(rootDir), ...args], { cwd: rootDir })).code;
}

async function head(): Promise<string> {
  const sha = await localHeadSha(run, rootDir);
  if (sha === null) throw new Error('no head');
  return sha;
}

/** An empty commit; signed with `signingKey` (a public key's path) when one is given. */
async function commit(message: string, signingKey?: string): Promise<string> {
  const signed = signingKey === undefined ? [] : ['-c', `user.signingkey=${signingKey}`];
  const code = await git(
    ...signed,
    'commit',
    ...(signingKey === undefined ? [] : ['-S']),
    '--allow-empty',
    '-m',
    message,
  );
  if (code !== 0) throw new Error(`commit failed: ${message}`);
  return head();
}

/** An SSH key pair made for the test; answers the public key's path and its `<type> <key>` text. */
async function sshKey(name: string): Promise<{ pub: string; line: string }> {
  const file = path.join(keyDir, name);
  await promisify(execFile)('ssh-keygen', [
    '-q',
    '-t',
    'ed25519',
    '-N',
    '',
    '-C',
    `${name}@openheaders.io`,
    '-f',
    file,
  ]);
  const [type, key] = (await fs.readFile(`${file}.pub`, 'utf-8')).trim().split(' ');
  return { pub: `${file}.pub`, line: `${type} ${key}` };
}

describe('signatureState', () => {
  it('reads git’s letter for a signed commit', () => {
    expect(signatureState('G')).toBe('good');
    expect(signatureState('B')).toBe('bad');
    expect(signatureState('R')).toBe('bad');
    for (const letter of ['U', 'X', 'Y', 'E', 'N']) expect(signatureState(letter)).toBe('unverified');
  });
});

describe('parseSignedShas', () => {
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);
  const c = 'c'.repeat(40);

  it('lists the commits whose headers carry a signature', () => {
    const raw = [
      `commit ${a}\ntree ${c}\nauthor John Doe <john@openheaders.io> 1 +0000\ngpgsig -----BEGIN SSH SIGNATURE-----\n AAAA\n -----END SSH SIGNATURE-----\n\n    signed\n`,
      `commit ${b}\ntree ${c}\nauthor John Doe <john@openheaders.io> 1 +0000\n\n    plain\n`,
      `commit ${c}\ntree ${c}\ngpgsig-sha256 -----BEGIN PGP SIGNATURE-----\n AAAA\n\n    signed in a sha-256 repo\n`,
    ].join('\0');
    expect(parseSignedShas(raw)).toEqual([a, c]);
  });

  it('does not take a message that speaks of a signature for one', () => {
    const raw = `commit ${a}\ntree ${c}\n\n    gpgsig is a header\n\ngpgsig at the start of a body line\n`;
    expect(parseSignedShas(raw)).toEqual([]);
    expect(parseSignedShas('')).toEqual([]);
  });
});

describe('readCommitSignatures', () => {
  it('lists nothing for unsigned commits and asks git for no verification', async () => {
    const first = await commit('plain one');
    const second = await commit('plain two');
    calls.length = 0;
    expect(await readCommitSignatures(run, rootDir, [second, first])).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls.flat().some((arg) => arg.includes('%G?'))).toBe(false);
    expect(await readCommitSignatures(run, rootDir, [])).toEqual([]);
  });

  it('refuses a short sha, an expression and a commit the repo does not hold', async () => {
    const sha = await commit('plain');
    expect(await readCommitSignatures(run, rootDir, [sha.slice(0, 8)])).toBeNull();
    expect(await readCommitSignatures(run, rootDir, [sha, 'HEAD~1'])).toBeNull();
    expect(await readCommitSignatures(run, rootDir, ['1'.padStart(40, '0')])).toBeNull();
  });

  it('reads a signed commit by what the allowed signers say of its key', async () => {
    const john = await sshKey('john');
    const dana = await sshKey('dana');
    await git('config', 'gpg.format', 'ssh');
    const plain = await commit('plain');
    const johns = await commit('signed by john', john.pub);
    const danas = await commit('signed by dana', dana.pub);

    // No allowed list: git cannot check and says "none" — the header still says signed.
    expect(await readCommitSignatures(run, rootDir, [danas, johns, plain])).toEqual([
      { sha: danas, state: 'unverified' },
      { sha: johns, state: 'unverified' },
    ]);

    const allowed = path.join(keyDir, 'allowed');
    await fs.writeFile(allowed, `john@openheaders.io ${john.line}\n`, 'utf-8');
    await git('config', 'gpg.ssh.allowedSignersFile', allowed);
    const read = await readCommitSignatures(run, rootDir, [plain, danas, johns]);
    expect(read?.map((signature) => [signature.sha, signature.state, signature.signer])).toEqual([
      [danas, 'unverified', undefined],
      [johns, 'good', 'john@openheaders.io'],
    ]);
    expect(read?.every((signature) => signature.key?.startsWith('SHA256:'))).toBe(true);
  });
});
