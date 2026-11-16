/**
 * The runtime's hold while git writes the tree — the REAL runtime on a
 * real (tmp) repo, its engine on in-memory persistence. Pins the wiring
 * no pass module's own test reaches: the watch of git's writes handed to
 * the sweep and to the flush, and the pass taken again once the hold's
 * wait is over, with nothing else to bring one.
 *
 * Another git process is stood in for by its lock: `index.lock`, made
 * by hand. Each leg waits the hold's five seconds once.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { type HostLogger, setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import type { Rule } from '@openheaders/core/types';
import { planWorkspaceTree } from '@openheaders/core/workspace-tree';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import { __initGlobalSyncServiceForTests, disposeGlobal } from '@openheaders/oracle/sync/global-service';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  snapshotRulePostStates,
} from '@openheaders/oracle/sync/service';
import {
  bootstrap as bootstrapWorkspaces,
  bridgeExtensionWorkspaceSyncEngine,
  getActiveWorkspaceId,
  peekActiveWorkspaceId,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec } from '../../src/git/git-exec';
import { createWorkspaceTreeRuntime, type WorkspaceTreeRuntime } from '../../src/workspace-tree/runtime';
import { createHostStorageFake } from './_host-storage-fake';

const IDENTITY_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};

const RULE_UID = 'aaaaaaaa';
const RULE_FILE = `rules/block-probes-${RULE_UID}/rule.yaml`;

/** Longer than the hold's wait (`OP_HOLD_RETRY_MS`), with the watcher's quiescence and a pass on top. */
const WITHIN_THE_HOLD_MS = 9_000;

let rootDir: string;
let workspaceId: string;
let runtime: WorkspaceTreeRuntime;
let logged: string[];

const ruleFile = (): string => path.join(rootDir, ...RULE_FILE.split('/'));
const lockFile = (): string => path.join(rootDir, '.git', 'index.lock');
const engineHoldsTheRule = (): boolean => snapshotRulePostStates(workspaceId).some(({ rule }) => rule.uid === RULE_UID);

async function until(what: string, check: () => boolean | Promise<boolean>, withinMs: number): Promise<void> {
  const deadline = Date.now() + withinMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`not within ${withinMs} ms: ${what}`);
    await delay(25);
  }
}

/** The lock as another git process takes it: created exclusively, never over one of the runtime's own passes. */
async function takeTheLockAsAnotherGit(): Promise<void> {
  await until(
    'the index lock free to take',
    async () => {
      try {
        await (await fs.open(lockFile(), 'wx')).close();
        return true;
      } catch {
        return false;
      }
    },
    5_000,
  );
}

/** A rule's file as the tree holds it, written by hand; answers once the engine has taken it in and the tree is at rest. */
async function seedRuleByHand(): Promise<string> {
  const rule = {
    schemaVersion: 5,
    uid: RULE_UID,
    path: `rules/block-probes-${RULE_UID}`,
    name: 'Block probes',
    type: 'block',
    enabled: true,
    conditions: [],
    action: {},
  } as Rule;
  const planned = planWorkspaceTree(
    {
      workspace: { schemaVersion: 5, uid: workspaceId, name: 'Probe Workspace' },
      rules: [rule],
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
    },
    {},
  ).find((file) => file.path === RULE_FILE);
  if (planned === undefined) throw new Error('the plan holds no file for the rule');
  await fs.mkdir(path.dirname(ruleFile()), { recursive: true });
  await fs.writeFile(ruleFile(), planned.content, 'utf-8');
  await until('the engine takes the hand-written rule in', engineHoldsTheRule, 5_000);
  // A commit runs on the chain behind the pass that took it in, and flushes first: the tree is at rest after.
  expect(await runtime.commit(workspaceId, 'seed')).toMatchObject({ ok: true });
  return fs.readFile(ruleFile(), 'utf-8');
}

beforeEach(async () => {
  logged = [];
  const capture =
    (level: string) =>
    (scope: string, ...args: unknown[]): void => {
      logged.push(`${level} ${scope} ${args.map(String).join(' ')}`);
    };
  const logger: HostLogger = {
    error: capture('error'),
    warn: capture('warn'),
    info: capture('info'),
    debug: capture('debug'),
  };
  setHostLogger(logger);
  setHostStorage(createHostStorageFake());
  resetWorkspaceStore();
  setOracleHostHooks({ getActiveWorkspaceId, peekActiveWorkspaceId });
  __initGlobalSyncServiceForTests();
  await bootstrapWorkspaces({ seedOnEmpty: true });
  await bridgeExtensionWorkspaceSyncEngine();
  workspaceId = getActiveWorkspaceId();
  __initSyncServiceForTests(workspaceId);

  rootDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-hold-')));
  const base = createGitExec({ audit: () => undefined });
  runtime = createWorkspaceTreeRuntime({
    hostId: 'host-hold',
    gitRunner: (args, options) => base(args, { ...options, env: { ...IDENTITY_ENV, ...options.env } }),
  });
  expect(await runtime.bind(workspaceId, rootDir)).toMatchObject({ ok: true });
});

afterEach(async () => {
  await runtime.dispose();
  disposeSyncService();
  disposeGlobal();
  resetWorkspaceStore();
  await fs.rm(rootDir, { recursive: true, force: true });
});

describe('the workspace-tree runtime while git writes the tree', () => {
  it('a file gone under another git’s lock is no deletion, and the sweep is taken again once the lock is given up', {
    timeout: 30_000,
  }, async () => {
    await seedRuleByHand();
    await takeTheLockAsAnotherGit();
    await fs.rm(ruleFile());

    await until('the sweep is held', () => logged.some((line) => line.includes('sweep held for')), 5_000);
    expect(engineHoldsTheRule()).toBe(true);

    // Nothing of the tree moves from here on: the hold's own wait alone brings the pass.
    await fs.rm(lockFile());
    await until('the sweep taken again reads the deletion', () => !engineHoldsTheRule(), WITHIN_THE_HOLD_MS);
  });

  it('a flush leaves a file to another git’s lock, and writes it once the lock is given up', {
    timeout: 30_000,
  }, async () => {
    const atRest = await seedRuleByHand();
    await takeTheLockAsAnotherGit();
    // A hand edit the engine reads the same: its sweep changes nothing and the flush after it owes the file its own bytes.
    await fs.writeFile(ruleFile(), `${atRest}# by hand\n`, 'utf-8');

    await until('the flush is held', () => logged.some((line) => line.includes('flush held for')), 5_000);
    expect(await fs.readFile(ruleFile(), 'utf-8')).toBe(`${atRest}# by hand\n`);

    await fs.rm(lockFile());
    await until(
      'the flush taken again writes the file',
      async () => (await fs.readFile(ruleFile(), 'utf-8')) === atRest,
      WITHIN_THE_HOLD_MS,
    );
  });
});
