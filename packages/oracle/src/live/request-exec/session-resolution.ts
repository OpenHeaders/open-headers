/**
 * Session resolution — the template resolution a live session
 * (WebSocket, gRPC, MQTT) retains from Connect to its last rider,
 * over the SAME 4-scope pipeline HTTP sends ride. Two halves the
 * executors call in order for every batch of templates:
 *
 *   - `prepare(templates)` — the async pre-pass (the Secret Providers
 *     plan's P2b): the secret-manager entries the templates reference
 *     that the session has not resolved yet are asked of the host's
 *     broker (a provider may prompt on this device) and merged into the
 *     retained registry. At Connect the entity's own strings; per rider
 *     the rider's. A value stays for the session; a failed entry is a
 *     new attempt on its next reference.
 *   - `resolve(template, unresolved)` — synchronous as before; every
 *     miss lands in the collector with its reason and hint, so the
 *     gates name the fix beside the name (the HTTP gate's parity).
 *
 * The oracle-side build reads the module mirrors (the node hosts and
 * the web tab); a page realm whose mirrors are empty injects the same
 * two halves from its renderer scope instead (`options.resolution` +
 * `options.prepareResolution` on each executor).
 */

import type { Vault } from '@openheaders/core/types';
import {
  collectTemplateVariableNames,
  collectUnresolvedReferences,
  createSecretManagerScope,
  resolveTemplate,
  type UnresolvedReferences,
} from '@openheaders/core/variables';
import { collectionUidForRequest } from './ancestor-chain';
import { buildResolver } from './resolver-scope';
import { getSecretManagerBroker } from './secret-manager-broker';

/** Resolve one template; every unresolved reference lands in the collector with its reason. */
export type SessionResolve = (template: string, unresolved: UnresolvedReferences) => string;
/** The async pre-pass before a batch of templates resolves; `null` when
 *  nothing needs asking, so the batch resolves synchronously as before. */
export type SessionPrepare = (templates: readonly string[]) => Promise<void> | null;

export interface SessionResolution {
  resolve: SessionResolve;
  prepare: SessionPrepare;
  /** The scope's vault — the TLS and dial policies' entry reads. */
  vault: Vault;
}

export interface SessionResolutionOptions {
  /** `null` = the runtime-Active workspace via the module mirrors; a string pins that workspace's scopes. */
  workspaceId: string | null;
  /** Tri-state: string pins an env, explicit `null` resolves with no environment, absent defers to the active pointer. */
  environmentId: string | null | undefined;
}

/**
 * The oracle-side resolution for one session — the module-mirror
 * resolver over the pinned (else the runtime-Active) workspace, the
 * collection scope off the tree index, the secret-manager scope over
 * the host's installed broker. Built with NO secret-manager entry
 * resolved: the executor's first `prepare` (the entity's own strings)
 * is the Connect-time pass, so nothing the session never references
 * can prompt.
 */
export async function buildOracleSessionResolution(
  request: { uid: string; path: string },
  options: SessionResolutionOptions,
): Promise<SessionResolution> {
  const { resolver, context: scope } = await buildResolver(options.workspaceId ?? undefined);
  const context = {
    collectionId: collectionUidForRequest(request, scope.workspaceId),
    environmentId: options.environmentId,
  };
  const secrets = createSecretManagerScope(resolver, scope.vault, (entries) =>
    getSecretManagerBroker().resolveBatch(entries),
  );
  return {
    resolve: (template, unresolved) => {
      const result = resolveTemplate(
        template,
        (name) => resolver.resolve(name, context),
        (name, ns) => resolver.resolveScopedWithDiagnostics(name, ns, context),
      );
      collectUnresolvedReferences(result.errors, unresolved);
      return result.result;
    },
    prepare: (templates) => secrets.ensure(collectTemplateVariableNames(templates)),
    vault: scope.vault,
  };
}
