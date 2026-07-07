/**
 * Per-envelope environment post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts`. Renderer-side write
 * helpers (`buildRenameEnvVarBatch`, etc.) need to know the live
 * variable names before they can emit the matching `removeFromSet`
 * envelope (variable identity = name; see
 * `mutators/environment/types.ts`).
 */

import type { SyncEnvironmentPostState } from '@openheaders/core/protocol';
import { ENV_VARS_PATH, ENVIRONMENT_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectEnvironment } from '@openheaders/core/sync-builders/projections/env-projection';
import type { Environment } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, buildVarNamesExtras, makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, Environment, SyncEnvironmentPostState>({
  entityType: ENVIRONMENT_ENTITY_TYPE,
  project: projectEnvironment,
  composeResult: (environment, oracle, uid) => ({
    environment,
    ...buildVarNamesExtras(oracle, ENVIRONMENT_ENTITY_TYPE, uid, ENV_VARS_PATH),
    // Per-uid order keys at the vars set — the env editor's Save reads
    // these to preserve row position on content edits and to mint
    // `keyBetween` positions on reorder/insert (§23.5).
    setOrderKeys: buildSetMembersExtras(oracle, ENVIRONMENT_ENTITY_TYPE, uid, [ENV_VARS_PATH]).setOrderKeys,
  }),
});

export const projectEnvironmentPostState = projectors.projectPostState;
export const projectEnvironmentByUid = projectors.projectByUid;
