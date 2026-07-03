/**
 * Per-envelope workspace-variables post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant).
 * Renderer-side write helpers need the live variable uids before they
 * can emit matching `removeFromSet` envelopes (variable identity = name).
 */

import type { SyncWorkspaceVariablesPostState } from '@openheaders/core/protocol';
import {
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
  WORKSPACE_VARIABLES_PATH,
} from '@openheaders/core/sync';
import { projectWorkspaceVariables } from '@openheaders/core/sync-builders/projections/workspace-variables-projection';
import { makeSingletonEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from '../oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncWorkspaceVariablesPostState>({
  entityType: WORKSPACE_VARIABLES_ENTITY_TYPE,
  entityId: WORKSPACE_VARIABLES_ID,
  compose: (materialized, oracle) => {
    const workspaceVariables = projectWorkspaceVariables(materialized);
    if (!workspaceVariables) return null;
    const varUids = oracle
      .liveSetItems(WORKSPACE_VARIABLES_ENTITY_TYPE, WORKSPACE_VARIABLES_ID, WORKSPACE_VARIABLES_PATH)
      .map((entry) => entry.itemId);
    return { workspaceVariables, varUids };
  },
});

export const projectWorkspaceVariablesPostState = projectors.projectPostState;
export const projectWorkspaceVariablesSingleton = projectors.projectSingleton;
