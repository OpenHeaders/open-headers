/**
 * A scratch repo with a history of every shape the log's lists read: a
 * trunk, a side branch merged back with a merge commit, a tag on the
 * merge, a branch on a commit inside the trunk, linear runs between
 * them, an unmerged branch beside the checked-out commit, the trunk's
 * remote branch gone its own way, two authors, a file only the side
 * branch touches. Real git, isolated from the machine's config, a
 * minute between any two commands.
 *
 *   R  Remote hotfix                 (origin/trunk)      Jane   on E
 *   O  Unmerged spike                (other)                    on G
 *   H  Release notes                 (trunk, HEAD)
 *   G  Tidy the docs
 *   F2 Rename the collection
 *   F  Rename the request
 *   E  Add staging environment       (release)           Jane
 *   D  Document the API
 *   M  Merge the side branch         (tag v1)
 *   C  Bump version
 *   S2 More side work                (side)              Jane
 *   S1 Side work                                         Jane
 *   B  Fix response panel
 *   A  Add orders request
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { createGitStream, type GitStreamRunner } from '../../src/git/git-stream';
import { createGitObjectBatches, type GitObjectBatchOpener } from '../../src/git/object-batch';
import { ensureWorkspaceRepo } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';

const ISOLATED = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
export const JOHN = { name: 'John Doe', email: 'john.doe@openheaders.io' };
export const JANE = { name: 'Jane Doe', email: 'jane.doe@openheaders.io' };

const base = createGitExec();
export const run: GitRunner = (args, options) => base(args, { ...options, env: { ...ISOLATED, ...options.env } });
const real = createGitStream();
export const stream: GitStreamRunner = (args, options, read) =>
  real(args, { ...options, env: { ...ISOLATED, ...options.env } }, read);

const batches = createGitObjectBatches();
export const objects: GitObjectBatchOpener = (options) => batches({ ...options, env: { ...ISOLATED, ...options.env } });

/** Every ref and the checked-out commit — the revisions a whole history is walked from. */
export const EVERY_REF = ['--branches', '--tags', '--remotes', 'HEAD'];

export interface ScratchRepo {
  rootDir: string;
  /** The default branch's name on this machine's git. */
  trunk: string;
  /** Runs git in the repo, a minute after the command before it. */
  git(args: string[], author?: { name: string; email: string }): Promise<string>;
  commit(subject: string, file: string, author?: { name: string; email: string }): Promise<void>;
  /** The hashes git prints for `args`, a line each. */
  shas(...args: string[]): Promise<string[]>;
  /** The hash of the commit with this subject. */
  shaOf(subject: string): Promise<string>;
  /** The subject of each hash, in the order given. */
  subjects(shas: readonly string[]): Promise<string[]>;
  remove(): Promise<void>;
}

export async function openScratchRepo(prefix: string): Promise<ScratchRepo> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await ensureWorkspaceRepo(run, rootDir);
  let clock = 1_700_000_000;

  const git: ScratchRepo['git'] = async (args, author = JOHN) => {
    clock += 60;
    const stamp = `${clock} +0000`;
    const result = await run([...repoArgs(rootDir), ...args], {
      cwd: rootDir,
      env: {
        GIT_AUTHOR_NAME: author.name,
        GIT_AUTHOR_EMAIL: author.email,
        GIT_COMMITTER_NAME: author.name,
        GIT_COMMITTER_EMAIL: author.email,
        GIT_AUTHOR_DATE: stamp,
        GIT_COMMITTER_DATE: stamp,
      },
    });
    if (result.code !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout;
  };
  const shas: ScratchRepo['shas'] = async (...args) =>
    (await git(['rev-list', ...args])).split('\n').filter((line) => line.length > 0);
  const titles = async (): Promise<Map<string, string>> =>
    new Map(
      (await git(['log', '--format=%H %s', ...EVERY_REF]))
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => [line.slice(0, 40), line.slice(41)]),
    );

  return {
    rootDir,
    trunk: (await git(['symbolic-ref', '--short', 'HEAD'])).trim(),
    git,
    shas,
    commit: async (subject, file, author) => {
      await fs.appendFile(path.join(rootDir, file), `${subject}\n`, 'utf-8');
      await git(['add', '-A'], author);
      await git(['commit', '-m', subject], author);
    },
    shaOf: async (subject) => {
      for (const [sha, title] of await titles()) {
        if (title === subject) return sha;
      }
      throw new Error(`no commit titled ${subject}`);
    },
    subjects: async (list) => {
      const bySha = await titles();
      return list.map((sha) => bySha.get(sha) ?? sha);
    },
    remove: () => fs.rm(rootDir, { recursive: true, force: true }),
  };
}

/** The history drawn at the top of this file. */
export async function seedHistory(repo: ScratchRepo): Promise<void> {
  const { git, commit, trunk } = repo;
  await commit('Add orders request', 'orders.yaml');
  await commit('Fix response panel', 'panel.md');
  await git(['checkout', '-q', '-b', 'side']);
  await commit('Side work', 'side.txt', JANE);
  await commit('More side work', 'side.txt', JANE);
  await git(['checkout', '-q', trunk]);
  await commit('Bump version', 'version.txt');
  await git(['merge', '-q', '--no-ff', 'side', '-m', 'Merge the side branch']);
  await git(['tag', 'v1']);
  await commit('Document the API', 'docs.md');
  await commit('Add staging environment', 'env.yaml', JANE);
  await git(['branch', 'release']);
  await commit('Rename the request', 'orders.yaml');
  await commit('Rename the collection', 'orders.yaml');
  await commit('Tidy the docs', 'docs.md');
  await commit('Release notes', 'notes.md');
  await git(['checkout', '-q', '-b', 'other', 'HEAD~1']);
  await commit('Unmerged spike', 'spike.txt');
  await git(['checkout', '-q', '--detach', 'release']);
  await commit('Remote hotfix', 'hotfix.txt', JANE);
  await git(['update-ref', `refs/remotes/origin/${trunk}`, 'HEAD']);
  await git(['checkout', '-q', trunk]);
}
