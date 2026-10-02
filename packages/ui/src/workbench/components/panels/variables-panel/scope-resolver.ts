/**
 * Build a `VariableResolver` wired to mirror the service worker's. Cheap
 * (array wiring only), so the presenter rebuilds it whenever any scope's
 * source changes rather than mutating a long-lived instance.
 */

import type { Environment, Vault, WorkspaceVariables } from '@openheaders/core/types';
import {
  EMPTY_SECRET_MANAGER_REGISTRY,
  type SecretManagerFailures,
  VariableResolver,
} from '@openheaders/core/variables';
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
  /** The vault's secret-manager rows that cannot resolve on this
   *  device, by their typed reason — the standing the page learned. */
  secretManagerFailures: SecretManagerFailures;
}

/**
 * The panel reads a vault row the way the service worker's compile
 * will: a TOTP or secret-manager entry that exists resolves later,
 * elsewhere (deferred, never an error here), unless the page learned a
 * standing that says it cannot — then the row names its typed reason.
 */
export function buildScopeResolver(input: ScopeResolverInput): VariableResolver {
  const {
    vault,
    environments,
    activeEnvironmentId,
    defaultEnvironmentId,
    workspaceVariables,
    families,
    liveRegistry,
    secretManagerFailures,
  } = input;
  const r = new VariableResolver();
  r.setDeferredVaultMode('defer');
  r.setSecretManagerRegistry(EMPTY_SECRET_MANAGER_REGISTRY, secretManagerFailures);
  r.setVault(vault);
  r.setEnvironments(environments);
  r.setActiveEnvironmentId(activeEnvironmentId);
  r.setDefaultEnvironmentId(defaultEnvironmentId);
  r.setWorkspaceVariables(workspaceVariables);
  feedCollectionVariablesToResolver(r, families);
  r.setLiveRegistry(liveRegistry);
  return r;
}
