/**
 * Daemon script runtime — composition root. Registers ONE capability,
 * Safe mode, over the host-neutral broker and `oh.*` servicing from
 * `@openheaders/oracle-host-node/daemon` with the permission-model
 * fork transport. The daemon NEVER runs Developer mode — there is no
 * chooser surface for it and no developer registration here; forwarded
 * web-tab sends and daemon-local dispatches all resolve Safe (the
 * spine's `resolveScriptRunner` never reads the mode slot for either).
 *
 * Distribution honesty:
 *   • The SEA single binary (also the Docker image) registers NOTHING:
 *     a SEA re-exec cannot carry the `--permission` flag today, and a
 *     weaker runtime must not ship under the Safe label — those
 *     distributions keep the "scripts don't run here" posture.
 *   • A dev run from `src/` has no built runner bundle beside its
 *     entry; it also registers nothing rather than forking un-isolated.
 */

import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { isSea } from 'node:sea';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  createScriptBroker,
  handleScriptHostRequest,
  setHostScriptCapabilities,
} from '@openheaders/oracle-host-node/daemon';
import { createForkTransport } from './fork-transport';

const SCOPE = 'script-runtime';

export interface ScriptRuntimeHandle {
  dispose(): void;
}

/**
 * The self-contained runner bundle ships beside the daemon entries
 * (`dist/script-runner.js`) — anchored on the entry script exactly like
 * the static web root, because the bundler places this module in a
 * chunk while both entries sit beside the staged file.
 */
function resolveRunnerPath(): string | null {
  const entryScript = process.argv[1];
  if (entryScript === undefined) return null;
  const runner = path.join(path.dirname(path.resolve(entryScript)), 'script-runner.js');
  return existsSync(runner) ? runner : null;
}

/** Install the Safe runtime, or return null where it cannot honor the
 *  Safe promise (SEA binary, runner bundle absent). */
export function installScriptRuntime(): ScriptRuntimeHandle | null {
  if (isSea()) {
    logger.info(SCOPE, 'single-binary build — scripts stay off on this distribution');
    return null;
  }
  const runnerPath = resolveRunnerPath();
  if (runnerPath === null) {
    logger.warn(SCOPE, 'script-runner.js not found beside the daemon entry — scripts stay off');
    return null;
  }
  const broker = createScriptBroker({
    createTransport: createForkTransport(runnerPath),
    handleHostRequest: handleScriptHostRequest,
  });
  setHostScriptCapabilities({
    safe: { mode: 'safe', runScript: (opts) => broker.runScript(opts) },
  });
  logger.info(SCOPE, `safe script runtime installed (${runnerPath})`);
  return {
    dispose(): void {
      setHostScriptCapabilities(null);
      broker.dispose();
    },
  };
}
