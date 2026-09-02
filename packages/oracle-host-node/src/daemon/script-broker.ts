/**
 * Script broker — the node hosts' composition of the host-neutral
 * broker (`@openheaders/core/scripts/broker`): the same broker every
 * host runs, with the one node-side read filled in — the active
 * workspace's script packages for `oh.require`, off the in-memory sync
 * cache. The desktop wires two of these (the hidden sandboxed renderer
 * and the full-Node `utilityProcess` worker); the standalone daemon
 * wires one over its permission-restricted fork.
 */

import type { ScriptPackageModule } from '@openheaders/core/scripts';
import {
  type ScriptBrokerDeps as CoreScriptBrokerDeps,
  createScriptBroker as createCoreScriptBroker,
  type ScriptBroker,
} from '@openheaders/core/scripts/broker';
import type { ScriptPackageCache } from '@openheaders/oracle/sync/caches/script-package-cache';
import { SCRIPT_PACKAGE_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import { getActiveCacheForRegistration } from '@openheaders/oracle/sync/service';

export type {
  RunScriptOptions,
  SandboxTransport,
  ScriptBroker,
  ScriptHostRequestHandler,
} from '@openheaders/core/scripts/broker';

export interface ScriptBrokerDeps extends Omit<CoreScriptBrokerDeps, 'listScriptPackages'> {
  /** Workspace script packages for `oh.require` (active workspace).
   *  Defaults to the live sync-cache read. */
  listScriptPackages?: () => ScriptPackageModule[];
}

export function createScriptBroker(deps: ScriptBrokerDeps): ScriptBroker {
  return createCoreScriptBroker({
    createTransport: deps.createTransport,
    handleHostRequest: deps.handleHostRequest,
    listScriptPackages: deps.listScriptPackages ?? listActiveScriptPackages,
  });
}

/**
 * Snapshot the ACTIVE workspace's script packages for `oh.require` —
 * same workspace posture as the host RPCs (variables / vault). Reads
 * the in-memory sync cache; an unhydrated or missing service yields
 * no packages rather than blocking the execution.
 */
function listActiveScriptPackages(): ScriptPackageModule[] {
  const cache = getActiveCacheForRegistration<ScriptPackageCache>(SCRIPT_PACKAGE_REGISTRATION);
  if (!cache) return [];
  return cache.getScriptPackages().map((p) => ({ name: p.name, source: p.source }));
}
