/**
 * Script variable scope — what a script's `oh.variables.get(name)` and
 * `oh.vault.get(ref)` read: the SAME resolution the send itself rode,
 * never a second resolver built from bare mirrors. An HTTP send hands
 * the resolver it resolved the request with (its collection off the
 * tree index, the pinned environment, the step captures, the TOTP codes
 * computed for this send, the live registry, the file registry); a
 * live session hands the resolution it retains from Connect (the
 * oracle-side one, or the page realm's injected renderer closure). A
 * secret-manager entry the request's own templates never named is
 * asked of the host's broker on first read — the script named it, so
 * the ask is the author's, exactly as a `{{vault.X}}` in a header
 * would be.
 *
 * One builder over the two halves every resolution has — the async
 * pre-pass (`prepare`) and the synchronous template resolve into an
 * unresolved-reference collector — so the HTTP pipeline and the three
 * session executors produce one scope shape for the host's `oh.*`
 * servicing (`script-host/host-rpc.ts`, the extension's two hosts).
 */

import type { ScriptVariableScope } from '@openheaders/core/scripts';
import type { ResolutionContext, Vault } from '@openheaders/core/types';
import {
  collectTemplateVariableNames,
  collectUnresolvedReferences,
  createSecretManagerScope,
  resolveTemplate,
  type UnresolvedReferences,
  type VariableResolver,
} from '@openheaders/core/variables';
import { buildResolver } from './resolver-scope';
import { getSecretManagerBroker } from './secret-manager-broker';

/** The two halves a scope reads through — the session resolution's shape. */
export interface ScriptScopeResolution {
  /** The async pre-pass naming the entries the templates reference (a
   *  secret manager may prompt); `null` when nothing needs asking. */
  prepare(templates: readonly string[]): Promise<void> | null;
  /** Resolve one template; every miss lands in the collector. */
  resolve(template: string, unresolved: UnresolvedReferences): string;
}

/** The scope over one resolution: a reference reads as `{{reference}}`
 *  would, `null` when any part of it stays unresolved. */
export function createScriptVariableScope(resolution: ScriptScopeResolution): ScriptVariableScope {
  return {
    async readVariable(reference) {
      const template = `{{${reference}}}`;
      await resolution.prepare([template]);
      const unresolved: UnresolvedReferences = new Map();
      const result = resolution.resolve(template, unresolved);
      return unresolved.size > 0 || result === template ? null : result;
    },
  };
}

/**
 * The scope over a built resolver and the context one send resolves
 * with — the HTTP pipeline's. The secret-manager pre-pass rides the
 * host's installed broker (the values live in the resolver's registry
 * for this send alone, the Secret Providers plan's L1).
 */
export function scriptScopeOverResolver(
  resolver: VariableResolver,
  context: ResolutionContext,
  vault: Vault,
): ScriptVariableScope {
  const secrets = createSecretManagerScope(resolver, vault, (entries) =>
    getSecretManagerBroker().resolveBatch(entries),
  );
  return createScriptVariableScope({
    prepare: (templates) => secrets.ensure(collectTemplateVariableNames(templates)),
    resolve: (template, unresolved) => {
      const result = resolveTemplate(
        template,
        (name) => resolver.resolve(name, context),
        (name, ns) => resolver.resolveScopedWithDiagnostics(name, ns, context),
      );
      collectUnresolvedReferences(result.errors, unresolved);
      return result.result;
    },
  });
}

/**
 * The scope a run dispatched WITHOUT one falls back to — the runtime-
 * Active workspace's mirrors under the active environment pointer, no
 * collection, no step captures. Every executor hands its own scope;
 * this is the host servicing's honest answer for a script that reached
 * it another way.
 */
export async function activeWorkspaceScriptScope(): Promise<ScriptVariableScope> {
  const { resolver, context } = await buildResolver(undefined);
  return scriptScopeOverResolver(resolver, {}, context.vault);
}
