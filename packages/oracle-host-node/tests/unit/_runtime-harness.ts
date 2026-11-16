/**
 * The REAL workspace-tree runtime for a unit test: `createWorkspaceTreeRuntime`
 * bound to a temp folder it makes a repo of, its engine on in-memory
 * persistence (the boot of `mcp-runtime-tools.test.ts`), real watchers,
 * real git isolated from the machine's config. What the host logged and
 * every status frame it sent are kept for the test to wait on.
 *
 * Leading underscore: not a test file.
 */

import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { type HostLogger, setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import { __initGlobalSyncServiceForTests, disposeGlobal } from '@openheaders/oracle/sync/global-service';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import {
  bootstrap as bootstrapWorkspaces,
  bridgeExtensionWorkspaceSyncEngine,
  getActiveWorkspaceId,
  peekActiveWorkspaceId,
  __resetForTests as resetWorkspaceStore,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { createGitExec } from '../../src/git/git-exec';
import {
  createWorkspaceTreeRuntime,
  type WorkspaceTreeGitStatusRpcResult,
  type WorkspaceTreeRuntime,
} from '../../src/workspace-tree/runtime';
import { createHostStorageFake } from './_host-storage-fake';

const run = promisify(execFile);

const IDENTITY_ENV = {
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};

export interface RuntimeHarness {
  readonly rootDir: string;
  readonly workspaceId: string;
  readonly runtime: WorkspaceTreeRuntime;
  /** Every line the host logged, as `level scope text`. */
  readonly logged: string[];
  /** Every status frame the runtime sent, oldest first. */
  readonly frames: WorkspaceTreeGitStatusRpcResult[];
  /** A plain git in the bound folder, as from a terminal; answers its trimmed output. */
  git(...args: string[]): Promise<string>;
  dispose(): Promise<void>;
}

/** Poll `check` until it holds; throws naming `what` when it does not within `withinMs`. */
export async function until(what: string, check: () => boolean | Promise<boolean>, withinMs: number): Promise<void> {
  const deadline = Date.now() + withinMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`not within ${withinMs} ms: ${what}`);
    await delay(25);
  }
}

export async function openRuntimeHarness(): Promise<RuntimeHarness> {
  const logged: string[] = [];
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
  const workspaceId = getActiveWorkspaceId();
  __initSyncServiceForTests(workspaceId);

  const rootDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-')));
  const frames: WorkspaceTreeGitStatusRpcResult[] = [];
  const base = createGitExec({ audit: () => undefined });
  const runtime = createWorkspaceTreeRuntime({
    hostId: 'host-harness',
    gitRunner: (args, options) => base(args, { ...options, env: { ...IDENTITY_ENV, ...options.env } }),
    onGitStatus: (_workspaceId, status) => frames.push(status),
  });
  const bound = await runtime.bind(workspaceId, rootDir);
  if (!bound.ok) throw new Error(`the harness could not bind ${rootDir}: ${bound.reason}`);

  return {
    rootDir,
    workspaceId,
    runtime,
    logged,
    frames,
    git: async (...args) =>
      (await run('git', args, { cwd: rootDir, env: { ...process.env, ...IDENTITY_ENV } })).stdout.trim(),
    dispose: async () => {
      await runtime.dispose();
      disposeSyncService();
      disposeGlobal();
      resetWorkspaceStore();
      await fs.rm(rootDir, { recursive: true, force: true });
    },
  };
}
