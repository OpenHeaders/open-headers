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
import type { Environment } from '@openheaders/core/types';
import { projectEnvironment } from '@/shared/sync/env-projection';
import { buildVarNamesExtras, makeFlatEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, Environment, SyncEnvironmentPostState>({
  entityType: ENVIRONMENT_ENTITY_TYPE,
  project: projectEnvironment,
  composeResult: (environment, oracle, uid) => ({
    environment,
    ...buildVarNamesExtras(oracle, ENVIRONMENT_ENTITY_TYPE, uid, ENV_VARS_PATH),
  }),
});

export const projectEnvironmentPostState = projectors.projectPostState;
export const projectEnvironmentByUid = projectors.projectByUid;
