/**
 * `renameEnvironment` — set the environment's display name.
 *
 * Semantically `setField('name', _)`; named for awareness/UI clarity
 * the same way `toggleEnabled` is on rules. The factory emits a
 * generic `setField` envelope; the oracle dispatches on the body kind
 * not the catalog name.
 */

import { mintBatch } from './envelope';
import { ENVIRONMENT_ENTITY_TYPE, type EnvironmentIntent, type EnvironmentMutatorContext } from './types';

export interface RenameEnvironmentArgs {
  envId: string;
  name: string;
}

export function renameEnvironment(
  ctx: EnvironmentMutatorContext,
  args: RenameEnvironmentArgs,
): EnvironmentIntent {
  return {
    batch: mintBatch(ctx, [
      { kind: 'setField', type: ENVIRONMENT_ENTITY_TYPE, id: args.envId, path: 'name', value: args.name },
    ]),
    sideEffects: [],
  };
}
