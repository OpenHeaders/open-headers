/**
 * Pick pass on real tmp repos (`workspace-tree/pick.ts`): Cherry-Pick
 * and Revert of ONE commit, converged through the mutator seam and
 * recorded as a one-parent commit the operator authors — `git
 * cherry-pick` / `git revert` never run. Pins that only the commit's
 * own change travels (the branch's edit to the same document
 * survives), the message rules, the order of the pass (a refusal
 * writes nothing, the local work commits before the pick), the
 * own-files rule, and every typed refusal. The answered-conflict
 * describe pins the second call: the refusal's files and token, the
 * pick recorded with the document as answered, a token the branch
 * moved away from, and an answer that does not read. The last describe
 * pins a conflict no file shows: the branch's document stands, named.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { MutatorContext } from '@openheaders/core/sync';
import type { EmissionBatch } from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import type { Environment, Rule, Workspace } from '@openheaders/core/types';
import type { WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { commitWorkspaceTree, countDirtyFiles, ensureWorkspaceRepo } from '../../src/git/repo';
import { WorkspaceTreeMaterializer } from '../../src/workspace-tree/materializer';
import {
  type ApplyCommitMode,
  type ApplyCommitResolution,
  type ApplyCommitResolve,
  type ApplyWorkspaceCommitResult,
  applyWorkspaceCommit,
  COMMIT_CONFLICT_MAX_CHARS,
} from '../../src/workspace-tree/pick';

const ORG_ID = '019637a2-7b9a-7b9a-8b9a-1234567890ab';
const RULE_FILE = 'rules/block-probes-aaaaaaaa/rule.yaml';

const OPERATOR_ENV = {
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};
const DANA_ENV = {
  GIT_AUTHOR_NAME: 'Dana Reyes',
  GIT_AUTHOR_EMAIL: 'dana@openheaders.io',
  GIT_COMMITTER_NAME: 'Dana Reyes',
  GIT_COMMITTER_EMAIL: 'dana@openheaders.io',
};

function isolated(base: GitRunner): GitRunner {
  return (args, options) =>
    base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...options.env },
    });
}

function makeWorkspace(): Workspace {
  return { schemaVersion: 5, uid: 'wsaaaaaa', name: 'Probe Workspace', orgId: ORG_ID };
}

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    schemaVersion: 5,
    uid: 'aaaaaaaa',
    path: 'rules/block-probes-aaaaaaaa',
    name: 'Block probes',
    type: 'block',
    enabled: true,
    conditions: [],
    action: {},
    ...overrides,
  } as Rule;
}

function emptyState(): WorkspaceTreeState {
  return {
    workspace: makeWorkspace(),
    rules: [],
    collections: [],
    folders: [],
    requests: [],
    grpcRequests: [],
    websocketRequests: [],
    mqttRequests: [],
    graphqlRequests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    environments: [],
    workspaceVariables: null,
    vault: null,
    trustedRoots: null,
    specs: [],
    liveWorkflows: [],
    liveVariables: [],
  };
}

let tmpDir: string;
let local: string;
let peer: string;
let state: WorkspaceTreeState;
let hlcMs: number;
let run: GitRunner;
let materializer: WorkspaceTreeMaterializer;
let initialSha: string;

const nextCtx = (): MutatorContext => {
  hlcMs += 1_000;
  return {
    workspaceId: 'wsaaaaaa',
    orgId: ORG_ID,
    hlc: { physicalMs: hlcMs, logical: 0, nodeId: 'node-tree' },
    surfaceId: 'tree',
    deviceId: 'device-a',
  };
};

const raw = (dir: string, ...args: string[]) =>
  run(['--git-dir', path.join(dir, '.git'), '--work-tree', dir, ...args], { cwd: dir });

async function git(dir: string, ...args: string[]): Promise<string> {
  const result = await raw(dir, ...args);
  if (result.code !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

async function write(dir: string, rel: string, content: string): Promise<void> {
  const target = path.join(dir, ...rel.split('/'));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
}

const read = (dir: string, rel: string): Promise<string> => fs.readFile(path.join(dir, ...rel.split('/')), 'utf-8');

async function peerReplace(rel: string, find: string, replacement: string): Promise<void> {
  const content = await read(peer, rel);
  if (!content.includes(find)) throw new Error(`"${find}" not in ${rel}:\n${content}`);
  await write(peer, rel, content.replace(find, replacement));
}

/** Commit the peer's tree as Dana and hand the commit to the local repo's object store — not to its branch. */
async function peerCommit(message: string, identityEnv = DANA_ENV): Promise<string> {
  const result = await commitWorkspaceTree({ run, rootDir: peer, message, identityEnv });
  if (!result.ok || !result.committed) throw new Error('peer commit failed');
  await git(local, 'fetch', '--quiet', peer, 'main');
  return result.sha;
}

/** A change of the engine's, materialized and committed on the local branch. */
async function localCommit(message: string, next: Partial<WorkspaceTreeState>): Promise<string> {
  state = { ...state, ...next };
  await materializer.flush();
  const result = await commitWorkspaceTree({ run, rootDir: local, message, identityEnv: OPERATOR_ENV });
  if (!result.ok || !result.committed) throw new Error('local commit failed');
  return result.sha;
}

interface Trace {
  applied: EmissionBatch[];
  order: string[];
}

function apply(
  sha: string,
  mode: ApplyCommitMode,
  trace: Trace,
  onApply?: () => void,
  resolution?: ApplyCommitResolution,
): Promise<ApplyWorkspaceCommitResult> {
  return applyWorkspaceCommit({
    run,
    rootDir: local,
    sha,
    mode,
    ...(resolution !== undefined ? { resolution } : {}),
    workspaceUid: 'wsaaaaaa',
    readSnapshot: async () => state,
    nextCtx,
    liveSetEntries: () => [],
    apply: async (batches) => {
      trace.order.push('apply');
      trace.applied.push(...batches);
      onApply?.();
    },
    flush: () => materializer.flush(),
    commitLocalWork: async () => {
      trace.order.push('local');
      const result = await commitWorkspaceTree({
        run,
        rootDir: local,
        message: 'Local work',
        identityEnv: OPERATOR_ENV,
      });
      return result.ok ? { ok: true } : { ok: false, detail: result.detail };
    },
    identityEnv: OPERATOR_ENV,
    bypassHooks: false,
  });
}

const trace = (): Trace => ({ applied: [], order: [] });
const bodies = (t: Trace) => t.applied.flatMap((entry) => entry.batch.mutations.map((m) => m.body));

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-pick-'));
  local = path.join(tmpDir, 'local');
  peer = path.join(tmpDir, 'peer');
  state = emptyState();
  state.rules = [makeRule()];
  hlcMs = 1_000;
  run = isolated(createGitExec());

  await fs.mkdir(local, { recursive: true });
  materializer = new WorkspaceTreeMaterializer({ rootDir: local, readSnapshot: async () => ({ state }) });
  await write(local, '.gitignore', '.oh/\n*.secret.yaml\n');
  await materializer.flush();
  await ensureWorkspaceRepo(run, local);
  await raw(local, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const initial = await commitWorkspaceTree({
    run,
    rootDir: local,
    message: 'Initial tree',
    identityEnv: OPERATOR_ENV,
  });
  if (!initial.ok || !initial.committed) throw new Error('initial commit failed');
  initialSha = initial.sha;
  await run(['clone', '--quiet', local, peer], { cwd: tmpDir });
});

afterEach(async () => {
  materializer.dispose();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('applyWorkspaceCommit — cherry-pick', () => {
  it("lands only the commit's own change — the branch's rename of the same rule survives", async () => {
    await peerReplace(RULE_FILE, 'enabled: true', 'enabled: false');
    const picked = await peerCommit('Disable the probe rule\n\nIt fires on the health check.');
    const before = await localCommit('Rename locally', { rules: [makeRule({ name: 'Local name' })] });

    const t = trace();
    const result = await apply(picked, 'pick', t, () => {
      state = { ...state, rules: [makeRule({ name: 'Local name', enabled: false })] };
    });
    expect(result).toMatchObject({ ok: true, skipped: [] });

    expect(bodies(t)).toContainEqual({
      kind: 'setField',
      type: 'rule',
      id: 'aaaaaaaa',
      path: 'enabled',
      value: false,
    });
    expect(bodies(t).some((body) => 'path' in body && body.path === 'name')).toBe(false);

    const rule = await read(local, RULE_FILE);
    expect(rule).toContain('name: Local name');
    expect(rule).toContain('enabled: false');
    expect(await git(local, 'rev-list', '--parents', '-n', '1', 'HEAD')).toBe(
      `${result.ok ? result.sha : ''} ${before}`,
    );
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it('the operator authors the pick; the message keeps the source and closes with the pick line and its author', async () => {
    await peerReplace(RULE_FILE, 'enabled: true', 'enabled: false');
    const picked = await peerCommit('Disable the probe rule\n\nIt fires on the health check.');

    const result = await apply(picked, 'pick', trace(), () => {
      state = { ...state, rules: [makeRule({ enabled: false })] };
    });
    expect(result.ok).toBe(true);
    expect(await git(local, 'log', '-1', '--format=%an <%ae> | %cn')).toBe('John Doe <john@openheaders.io> | John Doe');
    expect(await git(local, 'log', '-1', '--format=%B')).toBe(
      [
        'Disable the probe rule',
        '',
        'It fires on the health check.',
        '',
        `(cherry picked from commit ${picked})`,
        'Co-Authored-By: Dana Reyes <dana@openheaders.io>',
      ].join('\n'),
    );
    expect(await git(local, 'log', '-1', '--format=%(trailers:key=Co-Authored-By,valueonly)')).toBe(
      'Dana Reyes <dana@openheaders.io>',
    );
  });

  it("a pick of the operator's own commit carries no co-author", async () => {
    await peerReplace(RULE_FILE, 'enabled: true', 'enabled: false');
    const own = await peerCommit('Disable on the side', OPERATOR_ENV);

    const result = await apply(own, 'pick', trace(), () => {
      state = { ...state, rules: [makeRule({ enabled: false })] };
    });
    expect(result.ok).toBe(true);
    expect(await git(local, 'log', '-1', '--format=%B')).toBe(
      `Disable on the side\n\n(cherry picked from commit ${own})`,
    );
  });

  it('a document both sides changed refuses with nothing written — not even the local work', async () => {
    await peerReplace(RULE_FILE, 'name: Block probes', 'name: Picked name');
    const picked = await peerCommit('Rename on the peer');
    const before = await localCommit('Rename locally', { rules: [makeRule({ name: 'Local name' })] });
    await write(local, 'NOTES.md', 'uncommitted\n');

    const t = trace();
    const result = await apply(picked, 'pick', t);
    expect(result).toMatchObject({ ok: false, reason: 'conflicts', conflicts: [RULE_FILE], issues: [] });
    expect(t.order).toEqual([]);
    expect(await git(local, 'rev-parse', 'HEAD')).toBe(before);
    expect(await read(local, RULE_FILE)).toContain('name: Local name');
    expect(await git(local, 'status', '--porcelain')).toBe('?? NOTES.md');
  });

  it('local uncommitted work commits first, under its own commit', async () => {
    await peerReplace(RULE_FILE, 'enabled: true', 'enabled: false');
    const picked = await peerCommit('Disable the probe rule');
    await write(local, 'NOTES.md', 'uncommitted\n');

    const t = trace();
    const result = await apply(picked, 'pick', t, () => {
      state = { ...state, rules: [makeRule({ enabled: false })] };
    });
    expect(result.ok).toBe(true);
    expect(t.order).toEqual(['local', 'apply']);
    expect(await git(local, 'log', '-2', '--format=%s')).toBe('Disable the probe rule\nLocal work');
    expect(await git(local, 'show', '--name-only', '--format=', 'HEAD')).toBe(RULE_FILE);
  });

  it("the commit's own file lands; a file the branch also changed keeps its local bytes and is named", async () => {
    await write(peer, 'README.md', 'from the peer\n');
    await write(peer, 'NOTES.md', 'peer notes\n');
    const picked = await peerCommit('Add a readme and notes');
    await write(local, 'NOTES.md', 'local notes\n');
    await localCommit('Local notes', {});

    const result = await apply(picked, 'pick', trace());
    expect(result).toMatchObject({ ok: true, keptLocal: ['NOTES.md'] });
    expect(await read(local, 'README.md')).toBe('from the peer\n');
    expect(await read(local, 'NOTES.md')).toBe('local notes\n');
    expect(await git(local, 'show', '--name-only', '--format=', 'HEAD')).toBe('README.md');
  });

  it('a change the branch already holds answers empty and records nothing', async () => {
    await peerReplace(RULE_FILE, 'enabled: true', 'enabled: false');
    const picked = await peerCommit('Disable the probe rule');
    const first = await apply(picked, 'pick', trace(), () => {
      state = { ...state, rules: [makeRule({ enabled: false })] };
    });
    expect(first.ok).toBe(true);
    const head = await git(local, 'rev-parse', 'HEAD');

    const t = trace();
    expect(await apply(picked, 'pick', t)).toEqual({ ok: false, reason: 'empty', issues: [] });
    expect(t.applied).toEqual([]);
    expect(await git(local, 'rev-parse', 'HEAD')).toBe(head);
  });
});

describe('applyWorkspaceCommit — a conflict answered', () => {
  let picked: string;
  let before: string;

  /** Both sides renamed the rule; the local side also holds uncommitted work. */
  beforeEach(async () => {
    await peerReplace(RULE_FILE, 'name: Block probes', 'name: Picked name');
    picked = await peerCommit('Rename on the peer');
    before = await localCommit('Rename locally', { rules: [makeRule({ name: 'Local name' })] });
    await write(local, 'NOTES.md', 'uncommitted\n');
  });

  async function refusal(): Promise<ApplyCommitResolve> {
    const result = await apply(picked, 'pick', trace());
    if (result.ok || result.resolve === undefined) throw new Error('expected a conflicts refusal with files');
    return result.resolve;
  }

  it('the refusal carries the file three times over, at its path on the branch, and a token', async () => {
    const resolve = await refusal();
    expect(resolve.token).toMatch(/^[0-9a-f]{16,}$/);
    expect(resolve.files).toHaveLength(1);
    const [file] = resolve.files;
    expect(file.path).toBe(RULE_FILE);
    expect(file.base).toContain('name: Block probes\n');
    expect(file.theirs).toContain('name: Picked name\n');
    expect(file.mine).toContain('name: Local name\n');
    // The same branch and commit read the same way.
    expect((await refusal()).token).toBe(resolve.token);
  });

  it('texts over the cap refuse as too large — no files, no token, nothing written', async () => {
    const head = await localCommit('Grow locally', {
      rules: [makeRule({ name: 'L'.repeat(COMMIT_CONFLICT_MAX_CHARS) })],
    });
    const t = trace();
    const result = await apply(picked, 'pick', t);
    expect(result).toMatchObject({ ok: false, reason: 'conflicts', conflicts: [RULE_FILE], tooLarge: true });
    expect(result.ok === false && result.resolve).toBeUndefined();
    expect(t.order).toEqual([]);
    expect(await git(local, 'rev-parse', 'HEAD')).toBe(head);
  });

  it('the token with an answer records the pick, the document as answered', async () => {
    const resolve = await refusal();
    const answer = (resolve.files[0].mine ?? '').replace('name: Local name', 'name: Agreed name');

    const t = trace();
    const result = await apply(
      picked,
      'pick',
      t,
      () => {
        state = { ...state, rules: [makeRule({ name: 'Agreed name' })] };
      },
      { token: resolve.token, files: [{ path: RULE_FILE, content: answer }] },
    );
    expect(result).toMatchObject({ ok: true, skipped: [] });
    expect(t.order).toEqual(['local', 'apply']);
    expect(bodies(t)).toEqual([{ kind: 'setField', type: 'rule', id: 'aaaaaaaa', path: 'name', value: 'Agreed name' }]);
    expect(await read(local, RULE_FILE)).toContain('name: Agreed name');
    expect(await git(local, 'log', '-3', '--format=%s')).toBe('Rename on the peer\nLocal work\nRename locally');
    expect(await git(local, 'show', '--name-only', '--format=', 'HEAD')).toBe(RULE_FILE);
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it("the commit's text as the answer is the commit's value", async () => {
    const resolve = await refusal();
    const t = trace();
    const result = await apply(
      picked,
      'pick',
      t,
      () => {
        state = { ...state, rules: [makeRule({ name: 'Picked name' })] };
      },
      { token: resolve.token, files: [{ path: RULE_FILE, content: resolve.files[0].theirs ?? '' }] },
    );
    expect(result.ok).toBe(true);
    expect(await read(local, RULE_FILE)).toContain('name: Picked name');
  });

  it("the branch's text as the answer leaves nothing to record — empty, after the local work", async () => {
    const resolve = await refusal();
    const t = trace();
    const result = await apply(picked, 'pick', t, undefined, {
      token: resolve.token,
      files: [{ path: RULE_FILE, content: resolve.files[0].mine ?? '' }],
    });
    expect(result).toMatchObject({ ok: false, reason: 'empty' });
    expect(t.applied).toEqual([]);
    expect(await read(local, RULE_FILE)).toContain('name: Local name');
  });

  it('a token the branch moved away from refuses again, with the files as they stand now', async () => {
    const resolve = await refusal();
    state = { ...state, rules: [makeRule({ name: 'Moved on' })] };

    const t = trace();
    const result = await apply(picked, 'pick', t, undefined, {
      token: resolve.token,
      files: [{ path: RULE_FILE, content: resolve.files[0].theirs ?? '' }],
    });
    if (result.ok || result.resolve === undefined) throw new Error('expected a conflicts refusal with files');
    expect(result.reason).toBe('conflicts');
    expect(result.resolve.token).not.toBe(resolve.token);
    expect(result.resolve.files[0].mine).toContain('name: Moved on\n');
    expect(t.order).toEqual([]);
    expect(await git(local, 'rev-parse', 'HEAD')).toBe(before);
  });

  it('an answer that does not read, a missing one and a stray path refuse with nothing written', async () => {
    const resolve = await refusal();
    const t = trace();
    const unreadable = await apply(picked, 'pick', t, undefined, {
      token: resolve.token,
      files: [{ path: RULE_FILE, content: 'name: [unclosed\n' }],
    });
    expect(unreadable).toMatchObject({ ok: false, reason: 'resolution-invalid', file: RULE_FILE });

    const missing = await apply(picked, 'pick', t, undefined, { token: resolve.token, files: [] });
    expect(missing).toMatchObject({ ok: false, reason: 'resolution-invalid', file: RULE_FILE });

    const stray = await apply(picked, 'pick', t, undefined, {
      token: resolve.token,
      files: [
        { path: RULE_FILE, content: resolve.files[0].theirs ?? '' },
        { path: 'workspace.yaml', content: 'name: Hijacked\n' },
      ],
    });
    expect(stray).toMatchObject({ ok: false, reason: 'resolution-invalid', file: 'workspace.yaml' });

    expect(t.order).toEqual([]);
    expect(await git(local, 'rev-parse', 'HEAD')).toBe(before);
    expect(await git(local, 'status', '--porcelain')).toBe('?? NOTES.md');
  });

  it('a revert that meets a later edit is answered the same way', async () => {
    // The peer's rename is on the branch's own history here: pick it clean first.
    const resolve = await refusal();
    const landed = await apply(
      picked,
      'pick',
      trace(),
      () => {
        state = { ...state, rules: [makeRule({ name: 'Picked name' })] };
      },
      { token: resolve.token, files: [{ path: RULE_FILE, content: resolve.files[0].theirs ?? '' }] },
    );
    if (!landed.ok) throw new Error('pick did not land');
    await localCommit('Rename again', { rules: [makeRule({ name: 'Later name' })] });

    const refused = await apply(landed.sha, 'revert', trace());
    if (refused.ok || refused.resolve === undefined) throw new Error('expected a conflicts refusal with files');
    const [file] = refused.resolve.files;
    expect(file.base).toContain('name: Picked name\n');
    expect(file.theirs).toContain('name: Local name\n');
    expect(file.mine).toContain('name: Later name\n');

    const reverted = await apply(
      landed.sha,
      'revert',
      trace(),
      () => {
        state = { ...state, rules: [makeRule({ name: 'Local name' })] };
      },
      { token: refused.resolve.token, files: [{ path: RULE_FILE, content: file.theirs ?? '' }] },
    );
    expect(reverted.ok).toBe(true);
    expect(await read(local, RULE_FILE)).toContain('name: Local name');
  });
});

describe('applyWorkspaceCommit — revert', () => {
  it("undoes the commit's own change and keeps what the branch did after it", async () => {
    const renamed = await localCommit('Rename the probe rule', { rules: [makeRule({ name: 'Renamed' })] });
    await localCommit('Disable it', { rules: [makeRule({ name: 'Renamed', enabled: false })] });

    const t = trace();
    const result = await apply(renamed, 'revert', t, () => {
      state = { ...state, rules: [makeRule({ enabled: false })] };
    });
    expect(result.ok).toBe(true);
    expect(bodies(t)).toContainEqual({
      kind: 'setField',
      type: 'rule',
      id: 'aaaaaaaa',
      path: 'name',
      value: 'Block probes',
    });
    const rule = await read(local, RULE_FILE);
    expect(rule).toContain('name: Block probes');
    expect(rule).toContain('enabled: false');
    expect(await git(local, 'log', '-1', '--format=%B')).toBe(
      `Revert "Rename the probe rule"\n\nThis reverts commit ${renamed}.`,
    );
  });

  it('removes the own file the commit added', async () => {
    await write(local, 'README.md', 'added here\n');
    const added = await localCommit('Add a readme', {});
    const result = await apply(added, 'revert', trace());
    expect(result.ok).toBe(true);
    await expect(read(local, 'README.md')).rejects.toThrow();
    expect(await git(local, 'show', '--name-status', '--format=', 'HEAD')).toBe('D\tREADME.md');
  });
});

describe('applyWorkspaceCommit — refusals', () => {
  it('a sha the repo does not hold, and anything that is not a full sha', async () => {
    expect(await apply('f'.repeat(40), 'pick', trace())).toMatchObject({ ok: false, reason: 'unknown-commit' });
    expect(await apply('main', 'pick', trace())).toMatchObject({ ok: false, reason: 'unknown-commit' });
    expect(await apply(initialSha.slice(0, 8), 'pick', trace())).toMatchObject({ ok: false, reason: 'unknown-commit' });
  });

  it('the first commit and a merge commit have no single change to apply', async () => {
    expect(await apply(initialSha, 'pick', trace())).toMatchObject({
      ok: false,
      reason: 'unsupported-commit',
      detail: 'root',
    });

    await peerReplace(RULE_FILE, 'enabled: true', 'enabled: false');
    const other = await peerCommit('Disable the probe rule');
    const head = await localCommit('Rename locally', { rules: [makeRule({ name: 'Local name' })] });
    const merge = await run(
      [
        '--git-dir',
        path.join(local, '.git'),
        'commit-tree',
        `${head}^{tree}`,
        '-p',
        head,
        '-p',
        other,
        '-m',
        'a merge',
      ],
      { cwd: local, env: OPERATOR_ENV },
    );
    expect(await apply(merge.stdout.trim(), 'revert', trace())).toMatchObject({
      ok: false,
      reason: 'unsupported-commit',
      detail: 'merge',
    });
  });

  it('a git operation in progress holds the pass', async () => {
    await peerReplace(RULE_FILE, 'enabled: true', 'enabled: false');
    const picked = await peerCommit('Disable the probe rule');
    await write(local, '.git/CHERRY_PICK_HEAD', `${picked}\n`);
    expect(await apply(picked, 'pick', trace())).toMatchObject({
      ok: false,
      reason: 'op-in-progress',
      detail: 'CHERRY_PICK_HEAD',
    });
  });

  it('a commit whose touched document does not parse is refused, not read as a deletion', async () => {
    await write(peer, RULE_FILE, 'schemaVersion: 5\nuid: aaaaaaaa\nname: [unterminated\n');
    const broken = await peerCommit('Break the rule file');
    const head = await git(local, 'rev-parse', 'HEAD');

    const t = trace();
    const result = await apply(broken, 'pick', t);
    expect(result).toMatchObject({ ok: false, reason: 'foreign-invalid', detail: RULE_FILE });
    expect(t.order).toEqual([]);
    expect(await git(local, 'rev-parse', 'HEAD')).toBe(head);
  });
});

describe('applyWorkspaceCommit — a conflict no file shows', () => {
  const ENV_FILE = 'environments/staging-eeeeeeee.yaml';
  const staging = (secretName: string): Environment => ({
    schemaVersion: 5,
    uid: 'eeeeeeee',
    name: 'Staging',
    variables: [
      { uid: 'vvvvvvv1', name: 'host', value: 'staging.openheaders.io', type: 'default' },
      { uid: 'vvvvvvv2', name: secretName, value: 's3cret', type: 'secret' },
    ],
  });

  it("a secret row both sides renamed keeps the branch's name and is named as left out", async () => {
    await localCommit('Add staging', { environments: [staging('token')] });
    await git(peer, 'pull', '--quiet', local, 'main');
    await peerReplace(`${ENV_FILE.replace('.yaml', '.secret.yaml.template')}`, 'name: token', 'name: apiToken');
    const picked = await peerCommit('Rename the secret on the peer');
    const head = await localCommit('Rename the secret locally', { environments: [staging('authToken')] });

    const t = trace();
    const result = await apply(picked, 'pick', t);
    expect(result).toMatchObject({
      ok: false,
      reason: 'empty',
      skipped: [{ uid: 'eeeeeeee', path: ENV_FILE, reason: 'conflict-unshown' }],
    });
    expect(state.environments[0].variables[1].name).toBe('authToken');
    expect(await git(local, 'rev-parse', 'HEAD')).toBe(head);
  });
});
