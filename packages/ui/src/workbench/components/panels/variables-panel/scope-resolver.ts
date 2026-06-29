/**
 * Build a `VariableResolver` wired to mirror the service worker's. Cheap
 * (array wiring only), so the presenter rebuilds it whenever any scope's
 * source changes rather than mutating a long-lived instance.
 */

import type { Environment, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { VariableResolver } from '@openheaders/core/variables';
import { type CollectionFamilies, feedCollectionVariablesToResolver } from '@openheaders/ui/shared/variables';
import type { LiveRegistry } from './live-registry';

export interface ScopeResolverInput {
  vault: Vault;
  environments: Environment[];
  activeEnvironmentId: string | null;
  defaultEnvironmentId: string | null;
  workspaceVariables: WorkspaceVariables;
  families: CollectionFamilies;
  liveRegistry: LiveRegistry;
}

export function buildScopeResolver(input: ScopeResolverInput): VariableResolver {
  const { vault, environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, families, liveRegistry } =
    input;
  const r = new VariableResolver();
  r.setVault(vault);
  r.setEnvironments(environments);
  r.setActiveEnvironmentId(activeEnvironmentId);
  r.setDefaultEnvironmentId(defaultEnvironmentId);
  r.setWorkspaceVariables(workspaceVariables);
  feedCollectionVariablesToResolver(r, families);
  r.setLiveRegistry(liveRegistry);
  return r;
}
