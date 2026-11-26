/**
 * A run's resolver for a template that sits outside a request (the
 * workflow runs plan, The model): an `expect`'s address, a criterion's
 * value. One resolver per run, built at the first template it is asked
 * for, over the scopes a workflow has — the vault, the run's
 * environment, the workspace's variables, live values, and the run's
 * captures, kept by reference so a capture made later is read.
 *
 * A workflow lives in no collection, so no collection scope answers
 * here. No secret-manager entry is resolved, so nothing prompts.
 *
 * A reference no scope answers fails the step: a value compared as
 * written would be a verdict on the wrong thing.
 */

import type { TemplateResolver } from '@openheaders/core/live';
import { resolveTemplate } from '@openheaders/core/variables';
import { buildResolver } from './resolver-scope';
import { unresolvedReferenceLines } from './unresolved-references';

export function createChainTemplateResolver(): TemplateResolver {
  let built: ReturnType<typeof buildResolver> | null = null;
  return async (template, stepCaptures, context) => {
    built ??= buildResolver(context.workspaceId, stepCaptures, undefined, context.environmentId);
    const { resolver } = await built;
    const scope = { environmentId: context.environmentId };
    const resolved = resolveTemplate(
      template,
      (name) => resolver.resolve(name, scope),
      (name, namespace) => resolver.resolveScopedWithDiagnostics(name, namespace, scope),
      // The hint names the run's environment, not the workbench's active one.
      { activeEnvironmentId: context.environmentId, defaultEnvironmentId: null },
    );
    if (resolved.errors.length > 0) throw new Error(unresolvedReferenceLines(resolved.errors).join(' '));
    return resolved.result;
  };
}
