/**
 * The renderer scope a page-realm session's script hooks answer
 * against — what the page host's `oh.*` servicing reads in place of
 * the oracle mirrors a node host has: variables through the renderer
 * resolver's full scope walk, the workspace variables for `set`, the
 * vault mirror for `vault.get`, the Package Library for `oh.require`.
 * Built per Connect by the session editors' page-session factories
 * (`ws-page-session.ts`, `mqtt-page-session.ts`) from the same resolver
 * the templates resolve through.
 */

import type { ScriptPackageModule } from '@openheaders/core/scripts';
import type { Vault, WorkspaceVariables } from '@openheaders/core/types';
import type {
  buildRendererResolver,
  RendererResolverInputs,
} from '@openheaders/ui/shared/hooks/variables/useVariableResolver';

/** The resolver one Connect resolves through — the renderer's. */
type PageResolver = ReturnType<typeof buildRendererResolver>;

export interface PageScriptScope {
  workspaceId: string | null;
  /** The renderer resolver's read of one name — the full scope walk;
   *  `null` when nothing in scope defines it. */
  resolveVariable(name: string): string | null;
  workspaceVariables: WorkspaceVariables;
  vault: Vault;
  packages: ScriptPackageModule[];
}

/** The scope off one Connect's resolver and the renderer inputs it
 *  was built from. `context` is the resolve context the templates ride
 *  (the collection scope off the tree ancestry). */
export function buildPageScriptScope(
  resolver: PageResolver,
  context: { collectionId?: string },
  inputs: RendererResolverInputs,
  workspaceId: string | null,
  packages: readonly ScriptPackageModule[],
): PageScriptScope {
  return {
    workspaceId,
    resolveVariable: (name) => {
      const result = resolver.resolveTemplate(`{{${name}}}`, context);
      return result.variables.every((v) => v.resolved) ? result.result : null;
    },
    workspaceVariables: inputs.workspaceVariables,
    vault: inputs.vault,
    packages: [...packages],
  };
}
