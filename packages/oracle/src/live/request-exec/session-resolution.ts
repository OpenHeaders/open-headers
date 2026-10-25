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
 *     new attempt on its next reference. A batch that names a TOTP
 *     entry re-mints the TOTP registry here too — a code lives ~30s and
 *     a session outlives many windows, so a rider's `{{vault.otp}}` is
 *     the code of ITS moment, never Connect's.
 *   - `resolve(template, unresolved, totp?)` — synchronous as before;
 *     every miss lands in the collector with its reason and hint, so the
 *     gates name the fix beside the name (the HTTP gate's parity); every
 *     TOTP code the template carried lands on the batch's tracker when
 *     the caller hands one.
 *
 * The TOTP cooldown plane rides the resolution (`totp`): one tracker
 * per batch — Connect's, each rider's — so a rider's gate never re-checks
 * Connect's code; the gate and the record read this host's store. A
 * reconnect dial carries Connect's resolved strings and gates and
 * records nothing new; On message / After close reads are not a wire
 * usage.
 *
 * The oracle-side build reads the module mirrors (the node hosts and
 * the web tab); a page realm whose mirrors are empty injects the same
 * halves from its renderer scope instead (`options.resolution` +
 * `options.prepareResolution` + `options.totp` on each executor).
 */

import { referencesTotp, type TotpCooldownPlane, type TotpUsageTracker, totpNamesOf } from '@openheaders/core/totp';
import type { Vault } from '@openheaders/core/types';
import {
  collectTemplateVariableNames,
  collectUnresolvedReferences,
  createSecretManagerScope,
  referencesSecretManager,
  resolveTemplate,
  secretManagerNamesOf,
  type UnresolvedReferences,
} from '@openheaders/core/variables';
import { getActiveWorkspaceId } from '../../workspace/extension-workspace-store';
import { collectionUidForRequest } from './ancestor-chain';
import { buildResolver, buildTotpRegistry } from './resolver-scope';
import { getSecretManagerBroker } from './secret-manager-broker';
import { oracleTotpCooldownPlane } from './totp-usage';

/** Resolve one template; every unresolved reference lands in the
 *  collector with its reason, every TOTP code on the batch's tracker. */
export type SessionResolve = (
  template: string,
  unresolved: UnresolvedReferences,
  totp?: TotpUsageTracker | null,
) => string;
/** The async pre-pass before a batch of templates resolves; `null` when
 *  nothing needs asking, so the batch resolves synchronously as before. */
export type SessionPrepare = (templates: readonly string[]) => Promise<void> | null;
/** Whether a batch of templates names a secret-manager entry — the
 *  executor stamps what it recorded from them as secret-bearing (names
 *  only; the Secret Providers plan's L3), never by reading values. */
export type SessionReferencesSecret = (templates: readonly string[]) => boolean;

export interface SessionResolution {
  resolve: SessionResolve;
  prepare: SessionPrepare;
  referencesSecret: SessionReferencesSecret;
  /** The scope's vault — the TLS and dial policies' entry reads. */
  vault: Vault;
  /** The TOTP cooldown plane the session's batches gate and record through. */
  totp: TotpCooldownPlane;
}

export interface SessionResolutionOptions {
  /** `null` = the runtime-Active workspace via the module mirrors; a string pins that workspace's scopes. */
  workspaceId: string | null;
  /** Tri-state: string pins an env, explicit `null` resolves with no environment, absent defers to the active pointer. */
  environmentId: string | null | undefined;
}

/** Two pre-pass halves into one answer — `null` when neither asks. */
function joinPrepare(a: Promise<void> | null, b: Promise<void> | null): Promise<void> | null {
  if (a === null) return b;
  if (b === null) return a;
  return Promise.all([a, b]).then(() => undefined);
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
  const secretNames = secretManagerNamesOf(scope.vault);
  const totpNames = totpNamesOf(scope.vault);
  // The cooldown partition needs a concrete key — the pin the scope
  // resolved against, else the runtime-Active workspace (read lazily,
  // only when a code is in play).
  const workspaceKey = (): string => options.workspaceId ?? getActiveWorkspaceId();
  return {
    resolve: (template, unresolved, totp) => {
      const result = resolveTemplate(
        template,
        (name) => resolver.resolve(name, context),
        (name, ns) => resolver.resolveScopedWithDiagnostics(name, ns, context),
      );
      totp?.observe(result.variables);
      collectUnresolvedReferences(result.errors, unresolved);
      return result.result;
    },
    prepare: (templates) => {
      const names = collectTemplateVariableNames(templates);
      const remint = referencesTotp(names, totpNames)
        ? buildTotpRegistry(scope.vault).then((registry) => resolver.setTotpRegistry(registry))
        : null;
      return joinPrepare(secrets.ensure(names), remint);
    },
    referencesSecret: (templates) => referencesSecretManager(templates, secretNames),
    vault: scope.vault,
    totp: oracleTotpCooldownPlane(scope.vault, workspaceKey),
  };
}
