/**
 * Per-envelope script-package post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Packages are fully
 * flat-scalar — no set-modeled paths, so the projection carries only
 * the projected `ScriptPackage`.
 */

import type { SyncScriptPackagePostState } from '@openheaders/core/protocol';
import { SCRIPT_PACKAGE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectScriptPackage } from '@openheaders/core/sync-builders/projections/script-package-projection';
import type { ScriptPackage } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne'>;

const projectors = makeFlatEntityProjectors<Reads, ScriptPackage, SyncScriptPackagePostState>({
  entityType: SCRIPT_PACKAGE_ENTITY_TYPE,
  project: projectScriptPackage,
  composeResult: (scriptPackage) => ({ scriptPackage }),
});

export const projectScriptPackagePostState = projectors.projectPostState;
export const projectScriptPackageByUid = projectors.projectByUid;
